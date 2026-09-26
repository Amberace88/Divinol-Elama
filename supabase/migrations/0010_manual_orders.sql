-- 0010 — manual (admin) orders & invoices + automatic final invoice after a proforma is paid.
--
--   • orders.source ('web' | 'admin') — where the order came from (admin list shows an "Adminā" badge)
--   • admin_create_order(payload) — phone / e-mail / B2B orders entered by an administrator:
--       server-side totals with the same VAT / reverse-charge rounding as place_order(), tracked stock is
--       decremented exactly like place_order() does (order_items insert → order_item_stock_context() sets the
--       'order' ledger context → one UPDATE per variant → variant_log_changes() writes stock_movements), and the
--       document (proforma PR- / invoice ELA-) is issued with issue_invoice().
--   • ensure_final_invoice(order) — idempotent: when an order with a (non-void) proforma is paid and has no
--       (non-void) final invoice, issues ELA- as paid, referencing the proforma number in notes.
--       Serialised by a row lock on the order, so concurrent calls can never create two final invoices.
--   • trigger orders_payment_paid — on payment_status → 'paid': open proformas are marked paid and
--       ensure_final_invoice() runs (toggle: settings.invoice.auto_final_invoice, default true).

-- ───────────────────────── orders.source ─────────────────────────
alter table public.orders add column if not exists source text not null default 'web';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_source_chk') then
    alter table public.orders add constraint orders_source_chk check (source in ('web', 'admin'));
  end if;
end $$;
create index if not exists orders_source_idx on public.orders (source) where source <> 'web';

-- ───────────────────────── settings.invoice.auto_final_invoice ─────────────────────────
update public.settings set value = value || '{"auto_final_invoice": true}'::jsonb
 where key = 'invoice' and not (value ? 'auto_final_invoice');

-- ───────────────────────── final invoice after proforma payment ─────────────────────────
create or replace function public.ensure_final_invoice(p_order uuid, p_force boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_pr public.invoices%rowtype;
  v_number text;
  v_paid timestamptz;
  v_notes text;
begin
  -- the row lock serialises concurrent callers: the second one sees the invoice issued by the first
  select * into o from public.orders where id = p_order for update;
  if not found then return null; end if;
  if o.payment_status <> 'paid' or o.status = 'cancelled' then return null; end if;
  if not p_force and not coalesce((public.setting('invoice')->>'auto_final_invoice')::boolean, true) then return null; end if;
  if exists (select 1 from public.invoices where order_id = p_order and type = 'invoice' and status <> 'void') then return null; end if;

  select * into v_pr from public.invoices
   where order_id = p_order and type = 'proforma' and status <> 'void'
   order by created_at desc limit 1;
  if not found then return null; end if;

  v_paid := coalesce(o.paid_at, v_pr.paid_at, now());
  v_number := public.issue_invoice(p_order, 'invoice', 0);
  v_notes := concat_ws(E'\n',
    'Apmaksāts saskaņā ar avansa rēķinu ' || v_pr.number || ' (' || to_char(v_paid at time zone 'Europe/Riga', 'DD.MM.YYYY') || ').',
    nullif(trim(coalesce(public.setting('invoice')->>'notes', '')), ''));
  update public.invoices set status = 'paid', paid_at = v_paid, due_at = issued_at, notes = v_notes where number = v_number;
  update public.order_events set message = v_number || ' — automātiski pēc avansa rēķina ' || v_pr.number || ' apmaksas'
   where order_id = p_order and type = 'invoice' and message = v_number;
  return v_number;
end $$;
revoke execute on function public.ensure_final_invoice(uuid, boolean) from public, anon, authenticated;

create or replace function public.orders_payment_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.invoices set status = 'paid', paid_at = coalesce(new.paid_at, now())
   where order_id = new.id and type = 'proforma' and status = 'issued';
  perform public.ensure_final_invoice(new.id);
  return new;
end $$;
revoke execute on function public.orders_payment_paid() from public, anon, authenticated;

drop trigger if exists orders_payment_paid on public.orders;
create trigger orders_payment_paid after update of payment_status on public.orders
  for each row when (new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function public.orders_payment_paid();

-- ───────────────────────── admin_create_order ─────────────────────────
-- payload: {
--   user_id?, email, phone?, market (LV|EE|LT), locale (lv|en|et|lt|ru),
--   customer: { customer_type (private|business), name, company_name?, reg_no?, vat_no?, legal_address? },
--   billing_address?: {street, city, postal_code, country}, shipping_address?: {...}, shipping_point?: {name, ...},
--   shipping_method (pickup|parcel_locker|courier|freight), shipping_net (net, admin-entered),
--   payment_method (bank_transfer|invoice|card|cash_on_pickup), payment_status (unpaid|paid), status (new|confirmed),
--   discount_percent (order-level, applied to every line's unit price), reverse_charge (true|false|null = auto),
--   document (proforma|invoice|none), due_days, notes?, admin_notes?,
--   items: [{ variant_id, qty, unit_price_net?, name? } | { name, qty, unit?, sku?, unit_price_net }]
-- }
create or replace function public.admin_create_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_uid uuid := nullif(trim(coalesce(payload->>'user_id', '')), '')::uuid;
  v_profile public.profiles%rowtype;
  v_market text := coalesce(nullif(payload->>'market', ''), 'LV');
  v_locale text := coalesce(nullif(payload->>'locale', ''), 'lv');
  v_method text := coalesce(nullif(payload->>'shipping_method', ''), 'pickup');
  v_payment text := coalesce(nullif(payload->>'payment_method', ''), 'bank_transfer');
  v_email text := lower(trim(coalesce(payload->>'email', '')));
  v_doc text := coalesce(nullif(payload->>'document', ''), 'none');
  v_pay_status text := coalesce(nullif(payload->>'payment_status', ''), 'unpaid');
  v_status text := coalesce(nullif(payload->>'status', ''), 'new');
  v_due int := coalesce((payload->>'due_days')::int, 7);
  v_c jsonb := coalesce(payload->'customer', '{}'::jsonb);
  v_ctype text;
  v_name text;
  v_company text;
  v_vat_no text;
  v_b2b boolean := false;
  v_b2b_discount numeric := 0;
  v_discount numeric := coalesce((payload->>'discount_percent')::numeric, 0);
  v_vat numeric;
  v_reverse boolean;
  v_subtotal numeric := 0;
  v_ship_net numeric := round(coalesce((payload->>'shipping_net')::numeric, 0), 2);
  v_item jsonb;
  v_var record;
  v_qty int;
  v_unit numeric;
  v_line_name text;
  v_lines jsonb := '[]'::jsonb;
  v_vat_amount numeric;
  v_total numeric;
  v_order_id uuid;
  v_number text;
  v_invoice text;
  v_final text;
  v_customer jsonb;
  v_paid_at timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  if v_market not in ('LV', 'EE', 'LT') then raise exception 'invalid_market'; end if;
  if v_locale not in ('lv', 'en', 'et', 'lt', 'ru') then v_locale := 'lv'; end if;
  if v_method not in ('pickup', 'parcel_locker', 'courier', 'freight') then raise exception 'invalid_shipping'; end if;
  if v_payment not in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup') then raise exception 'invalid_payment'; end if;
  if v_doc not in ('proforma', 'invoice', 'none') then raise exception 'invalid_document'; end if;
  if v_pay_status not in ('unpaid', 'paid') then raise exception 'invalid_payment_status'; end if;
  if v_status not in ('new', 'confirmed') then raise exception 'invalid_status'; end if;
  if v_due < 0 or v_due > 120 then raise exception 'invalid_due_days'; end if;
  if v_discount < 0 or v_discount > 90 then raise exception 'invalid_discount'; end if;
  if v_ship_net < 0 or v_ship_net > 100000 then raise exception 'invalid_shipping_price'; end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'empty_cart'; end if;
  if jsonb_array_length(payload->'items') > 200 then raise exception 'too_many_items'; end if;

  -- linked customer → B2B discount / status from the profile
  if v_uid is not null then
    select * into v_profile from public.profiles where id = v_uid;
    if not found then raise exception 'customer_not_found'; end if;
    if v_profile.b2b_status = 'approved' then
      v_b2b := true;
      v_b2b_discount := coalesce(v_profile.discount_percent, 0);
    end if;
    if v_email = '' then v_email := lower(coalesce(v_profile.email, '')); end if;
  end if;

  v_ctype := case when v_c->>'customer_type' = 'business' then 'business' else 'private' end;
  v_name := nullif(left(trim(coalesce(v_c->>'name', '')), 200), '');
  v_company := case when v_ctype = 'business' then nullif(left(trim(coalesce(v_c->>'company_name', '')), 200), '') end;
  v_vat_no := nullif(upper(regexp_replace(coalesce(v_c->>'vat_no', ''), '\s', '', 'g')), '');
  if v_ctype = 'business' and v_company is null then raise exception 'company_required'; end if;
  if v_name is null and v_company is null then raise exception 'name_required'; end if;

  -- VAT: market rate; reverse charge for EU B2B outside LV with a VAT number (auto) or as set by the admin
  v_vat := coalesce((public.setting('vat')->>v_market)::numeric, 21);
  if jsonb_typeof(payload->'reverse_charge') = 'boolean' then
    v_reverse := (payload->>'reverse_charge')::boolean;
  else
    v_reverse := v_ctype = 'business' and v_market <> 'LV' and coalesce(v_vat_no, '') ~ '^[A-Z]{2}[0-9A-Z]{2,13}$' and left(v_vat_no, 2) <> 'LV';
  end if;
  if v_reverse and (v_market = 'LV' or v_vat_no is null) then raise exception 'reverse_charge_invalid'; end if;
  if v_reverse then v_vat := 0; end if;

  -- lines
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100000 then raise exception 'invalid_qty'; end if;

    if nullif(v_item->>'variant_id', '') is not null then
      select pv.id, pv.product_id, pv.sku, pv.size, pv.unit, pv.price_net, pv.image, p.i18n, p.images
        into v_var
        from public.product_variants pv join public.products p on p.id = pv.product_id
       where pv.id = (v_item->>'variant_id')::uuid;
      if not found then raise exception 'variant_not_found'; end if;
      v_unit := case when jsonb_typeof(v_item->'unit_price_net') = 'number' then round((v_item->>'unit_price_net')::numeric, 4)
                     else round(v_var.price_net * (1 - v_b2b_discount / 100), 4) end;
      if v_unit < 0 or v_unit > 1000000 then raise exception 'invalid_price'; end if;
      v_unit := round(v_unit * (1 - v_discount / 100), 4);
      v_line_name := coalesce(nullif(left(trim(coalesce(v_item->>'name', '')), 300), ''), v_var.i18n->'lv'->>'name', v_var.i18n->v_locale->>'name', 'Prece');
      v_lines := v_lines || jsonb_build_object(
        'product_id', v_var.product_id, 'variant_id', v_var.id, 'sku', v_var.sku, 'name', v_line_name,
        'pack_label', case when v_var.size is null then null
                           else trim(to_char(v_var.size, 'FM999990.###')) || case v_var.unit when 'kg' then ' kg' when 'l' then ' L' else '' end end,
        'image', coalesce(v_var.image, v_var.images[1]),
        'qty', v_qty, 'unit_price_net', v_unit, 'line_net', round(v_unit * v_qty, 2));
    else
      v_line_name := nullif(left(trim(coalesce(v_item->>'name', '')), 300), '');
      if v_line_name is null then raise exception 'line_name_required'; end if;
      if jsonb_typeof(v_item->'unit_price_net') is distinct from 'number' then raise exception 'invalid_price'; end if;
      v_unit := round((v_item->>'unit_price_net')::numeric, 4);
      if v_unit < 0 or v_unit > 1000000 then raise exception 'invalid_price'; end if;
      v_unit := round(v_unit * (1 - v_discount / 100), 4);
      v_lines := v_lines || jsonb_build_object(
        'product_id', null, 'variant_id', null, 'sku', nullif(left(trim(coalesce(v_item->>'sku', '')), 60), ''), 'name', v_line_name,
        'pack_label', nullif(left(trim(coalesce(v_item->>'unit', '')), 20), ''), 'image', null,
        'qty', v_qty, 'unit_price_net', v_unit, 'line_net', round(v_unit * v_qty, 2));
    end if;
    v_subtotal := v_subtotal + round(v_unit * v_qty, 2);
  end loop;

  v_vat_amount := round((v_subtotal + v_ship_net) * v_vat / 100, 2);
  v_total := round(v_subtotal + v_ship_net + v_vat_amount, 2);
  v_number := public.next_number('order', 'DIV', 5);
  v_paid_at := case when v_pay_status = 'paid' then now() end;

  v_customer := jsonb_strip_nulls(jsonb_build_object(
      'name', v_name,
      'company_name', v_company,
      'reg_no', case when v_ctype = 'business' then nullif(left(trim(coalesce(v_c->>'reg_no', '')), 50), '') end,
      'vat_no', case when v_ctype = 'business' then v_vat_no end,
      'legal_address', nullif(left(trim(coalesce(v_c->>'legal_address', '')), 300), ''),
      'order_discount_percent', nullif(v_discount, 0)))
    || jsonb_build_object('customer_type', v_ctype, 'b2b', v_b2b, 'discount_percent', v_b2b_discount);

  insert into public.orders (number, user_id, email, phone, customer, shipping_address, billing_address, market, locale, status,
    payment_method, payment_status, shipping_method, shipping_point, shipping_net, subtotal_net, discount_net, vat_rate, vat_amount,
    total_gross, reverse_charge, notes, admin_notes, paid_at, source)
  values (v_number, v_uid, v_email, nullif(left(trim(coalesce(payload->>'phone', '')), 50), ''), v_customer,
    case when jsonb_typeof(payload->'shipping_address') = 'object' then payload->'shipping_address' end,
    case when jsonb_typeof(payload->'billing_address') = 'object' then payload->'billing_address' end,
    v_market, v_locale, v_status, v_payment, v_pay_status, v_method,
    case when v_method = 'parcel_locker' and jsonb_typeof(payload->'shipping_point') = 'object' then payload->'shipping_point' end,
    v_ship_net, v_subtotal, 0, v_vat, v_vat_amount, v_total, v_reverse,
    nullif(left(trim(coalesce(payload->>'notes', '')), 2000), ''), nullif(left(trim(coalesce(payload->>'admin_notes', '')), 5000), ''),
    v_paid_at, 'admin')
  returning id into v_order_id;

  -- same stock path as place_order(): the order_items insert sets the 'order' ledger context (trigger),
  -- then tracked stock is decremented once per variant (aggregated, so repeated variants are not lost)
  insert into public.order_items (order_id, product_id, variant_id, sku, name, pack_label, image, qty, unit_price_net, line_net)
  select v_order_id, (l->>'product_id')::uuid, (l->>'variant_id')::uuid, l->>'sku', l->>'name', l->>'pack_label', l->>'image',
         (l->>'qty')::int, (l->>'unit_price_net')::numeric, (l->>'line_net')::numeric
    from jsonb_array_elements(v_lines) l;

  update public.product_variants pv set stock = greatest(0, pv.stock - x.qty)
    from (select (l->>'variant_id')::uuid as variant_id, sum((l->>'qty')::int)::int as qty
            from jsonb_array_elements(v_lines) l
           where l->>'variant_id' is not null
           group by 1) x
   where pv.id = x.variant_id and pv.stock is not null;
  perform public.inv_set_ctx(null, null, null);

  insert into public.order_events (order_id, type, message, created_by)
  values (v_order_id, 'created', 'Pasūtījums izveidots administrācijā', v_admin);
  if v_pay_status = 'paid' then
    insert into public.order_events (order_id, type, message, created_by) values (v_order_id, 'payment', 'Apmaksas statuss: Apmaksāts', v_admin);
  end if;

  if v_doc <> 'none' then
    v_invoice := public.issue_invoice(v_order_id, v_doc, v_due);
    if v_pay_status = 'paid' then
      update public.invoices set status = 'paid', paid_at = v_paid_at where number = v_invoice;
      if v_doc = 'proforma' then
        v_final := public.ensure_final_invoice(v_order_id);
      end if;
    end if;
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'invoice_number', v_invoice, 'final_invoice_number', v_final,
    'subtotal_net', v_subtotal, 'shipping_net', v_ship_net, 'vat_rate', v_vat, 'vat_amount', v_vat_amount,
    'total_gross', v_total, 'reverse_charge', v_reverse, 'payment_method', v_payment);
end $$;
revoke execute on function public.admin_create_order(jsonb) from public, anon;
grant execute on function public.admin_create_order(jsonb) to authenticated;
