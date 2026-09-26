-- 0011 — online payments via Montonio (bank links / cards / Apple Pay / Google Pay).
--
--   • orders.payment_method  + 'montonio_bank' | 'montonio_card'
--   • orders.payment_status  + 'pending' (waiting for the online payment) | 'failed' (abandoned / voided)
--   • orders.payment_provider ('montonio'), payment_ref (Montonio order uuid of the current attempt),
--     payment_meta (jsonb: method, preferred bank, attempts, bank name / sender reported by Montonio …)
--   • place_order(): online methods create the order with payment_status 'pending' and NO proforma;
--     bank transfer / B2B invoice / cash on pickup behave exactly as before.
--   • ensure_final_invoice(): an order paid online (no proforma) gets its final invoice (ELA-) issued as paid
--     directly; the proforma path is unchanged. Still idempotent (row lock + "already has a final invoice").
--   • payment_attach / payment_apply_status / payment_switch_to_transfer — used ONLY by the server
--     (Supabase service role: checkout action, Montonio webhook, return page, admin re-check).
--     Not executable by anon / authenticated, so a visitor can never mark an order paid.

-- ───────────────────────── columns & constraints ─────────────────────────
alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_ref text,
  add column if not exists payment_meta jsonb not null default '{}'::jsonb;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup', 'montonio_bank', 'montonio_card'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

alter table public.orders drop constraint if exists orders_payment_provider_chk;
alter table public.orders add constraint orders_payment_provider_chk
  check (payment_provider is null or payment_provider in ('montonio'));

create index if not exists orders_payment_ref_idx on public.orders (payment_ref) where payment_ref is not null;

-- several events written by one transaction (payment → final invoice) keep their real order in the timeline
alter table public.order_events alter column created_at set default clock_timestamp();

-- ───────────────────────── place_order (online methods) ─────────────────────────
-- Identical to 0003 except: the two montonio_* methods are accepted, stored with payment_status 'pending' +
-- payment_provider 'montonio', and no proforma is issued for them (the final invoice follows the payment).
create or replace function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_market text := coalesce(payload->>'market', 'LV');
  v_method text := payload->>'shipping_method';
  v_payment text := payload->>'payment_method';
  v_email text := lower(trim(payload->>'email'));
  v_b2b boolean := false;
  v_discount numeric := 0;
  v_vat numeric;
  v_reverse boolean := false;
  v_subtotal numeric := 0;
  v_max_item numeric := 0;
  v_ship jsonb;
  v_ship_cfg jsonb := public.setting('shipping');
  v_ship_net numeric := 0;
  v_threshold numeric;
  v_order_id uuid;
  v_number text;
  v_item jsonb;
  v_var record;
  v_qty int;
  v_unit numeric;
  v_lines jsonb := '[]'::jsonb;
  v_vat_amount numeric;
  v_total numeric;
  v_customer jsonb := coalesce(payload->'customer', '{}'::jsonb);
  v_invoice text;
  v_due int;
  v_online boolean := v_payment in ('montonio_bank', 'montonio_card');
begin
  if v_market not in ('LV', 'EE', 'LT') then raise exception 'invalid_market'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'empty_cart'; end if;
  if jsonb_array_length(payload->'items') > 100 then raise exception 'too_many_items'; end if;
  if v_payment is null or v_payment not in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup', 'montonio_bank', 'montonio_card') then raise exception 'invalid_payment'; end if;

  if v_uid is not null then
    select * into v_profile from public.profiles where id = v_uid;
    if found and v_profile.b2b_status = 'approved' then
      v_b2b := true;
      v_discount := v_profile.discount_percent;
    end if;
  end if;
  if v_payment = 'invoice' and not v_b2b then raise exception 'invoice_not_allowed'; end if;
  if v_payment = 'cash_on_pickup' and v_method <> 'pickup' then raise exception 'invalid_payment'; end if;

  v_vat := coalesce((public.setting('vat')->>v_market)::numeric, 21);
  if v_b2b and v_market <> 'LV' and coalesce(nullif(trim(v_profile.vat_no), ''), nullif(trim(v_customer->>'vat_no'), '')) is not null then
    v_reverse := true;
    v_vat := 0;
  end if;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := greatest(1, least(999, coalesce((v_item->>'qty')::int, 1)));
    select pv.id, pv.product_id, pv.sku, pv.size, pv.unit, pv.price_net, pv.image, pv.stock, p.i18n, p.images
      into v_var
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where p.slug = v_item->>'slug' and p.is_active and pv.is_active
       and (
         (v_item->>'sku' is not null and pv.sku = v_item->>'sku')
         or (v_item->>'sku' is null and pv.sku is null
             and coalesce(pv.size, 0) = coalesce((v_item->>'size')::numeric, 0) and pv.unit = coalesce(v_item->>'unit', pv.unit))
       )
     limit 1;
    if not found then raise exception 'product_not_found:%', v_item->>'slug'; end if;
    v_unit := round(v_var.price_net * (1 - v_discount / 100), 4);
    v_subtotal := v_subtotal + round(v_unit * v_qty, 2);
    v_max_item := greatest(v_max_item, coalesce(v_var.size, 0));
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_var.product_id, 'variant_id', v_var.id, 'sku', v_var.sku,
      'name', coalesce(v_var.i18n->(coalesce(payload->>'locale','lv'))->>'name', v_var.i18n->'lv'->>'name'),
      'pack_label', case when v_var.size is null then null
                         else trim(to_char(v_var.size, 'FM999990.###')) || case v_var.unit when 'kg' then ' kg' when 'l' then ' L' else '' end end,
      'image', coalesce(v_var.image, v_var.images[1]),
      'qty', v_qty, 'unit_price_net', v_unit, 'line_net', round(v_unit * v_qty, 2)
    );
  end loop;

  v_ship := v_ship_cfg->'methods'->v_method;
  if v_ship is null or not coalesce((v_ship->>'enabled')::boolean, true) then raise exception 'invalid_shipping'; end if;
  if not (v_ship->'markets' ? v_market) then raise exception 'shipping_not_available'; end if;
  if v_ship ? 'max_item' and v_max_item > (v_ship->>'max_item')::numeric then raise exception 'shipping_item_too_large'; end if;
  v_threshold := coalesce((v_ship_cfg->'free_threshold'->>v_market)::numeric, 99999);
  if v_ship->>'price_net' is null then
    v_ship_net := 0;
  elsif coalesce((v_ship->>'free_over')::boolean, false) and round(v_subtotal * (1 + v_vat / 100), 2) >= v_threshold then
    v_ship_net := 0;
  else
    v_ship_net := (v_ship->>'price_net')::numeric + coalesce((v_ship->'surcharge'->>v_market)::numeric, 0);
  end if;
  if v_method in ('parcel_locker') and coalesce(payload->'shipping_point'->>'id', payload->'shipping_point'->>'name', '') = '' then
    raise exception 'shipping_point_required';
  end if;
  if v_method in ('courier', 'freight') and coalesce(payload->'shipping_address'->>'street', '') = '' then
    raise exception 'address_required';
  end if;

  v_vat_amount := round((v_subtotal + v_ship_net) * v_vat / 100, 2);
  v_total := round(v_subtotal + v_ship_net + v_vat_amount, 2);
  v_number := public.next_number('order', 'DIV', 5);

  insert into public.orders (number, user_id, email, phone, customer, shipping_address, billing_address, market, locale,
    payment_method, payment_status, payment_provider, shipping_method, shipping_point, shipping_net, subtotal_net, discount_net,
    vat_rate, vat_amount, total_gross, reverse_charge, notes)
  values (v_number, v_uid, v_email, payload->>'phone',
    v_customer || jsonb_build_object('b2b', v_b2b, 'discount_percent', v_discount),
    payload->'shipping_address', payload->'billing_address', v_market, coalesce(payload->>'locale', 'lv'),
    v_payment, case when v_online then 'pending' else 'unpaid' end, case when v_online then 'montonio' end,
    v_method, payload->'shipping_point', v_ship_net, v_subtotal, 0, v_vat, v_vat_amount,
    v_total, v_reverse, left(payload->>'notes', 2000))
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, variant_id, sku, name, pack_label, image, qty, unit_price_net, line_net)
  select v_order_id, (l->>'product_id')::uuid, (l->>'variant_id')::uuid, l->>'sku', l->>'name', l->>'pack_label', l->>'image',
         (l->>'qty')::int, (l->>'unit_price_net')::numeric, (l->>'line_net')::numeric
    from jsonb_array_elements(v_lines) l;

  update public.product_variants pv set stock = greatest(0, pv.stock - (l->>'qty')::int)
    from jsonb_array_elements(v_lines) l
   where pv.id = (l->>'variant_id')::uuid and pv.stock is not null;

  insert into public.order_events (order_id, type, message) values (v_order_id, 'created', 'Pasūtījums izveidots');

  -- bank transfer → proforma, B2B invoice → invoice with payment terms; online payments → final invoice after payment
  if v_payment in ('bank_transfer', 'invoice') then
    v_due := case when v_payment = 'invoice' then greatest(v_profile.payment_terms_days, 7) else 7 end;
    v_invoice := public.issue_invoice(v_order_id, case when v_payment = 'invoice' then 'invoice' else 'proforma' end, v_due);
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'total_gross', v_total, 'subtotal_net', v_subtotal,
    'shipping_net', v_ship_net, 'vat_rate', v_vat, 'vat_amount', v_vat_amount, 'payment_method', v_payment,
    'invoice_number', v_invoice, 'reverse_charge', v_reverse);
end $$;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- ───────────────────────── final invoice (proforma OR online payment) ─────────────────────────
create or replace function public.payment_method_label(p_method text, p_meta jsonb default '{}'::jsonb) returns text
language sql immutable set search_path = public as $$
  select case p_method
    when 'montonio_bank' then 'bankas saite' || coalesce(' — ' || nullif(p_meta->>'provider_name', ''), '')
    when 'montonio_card' then 'maksājumu karte'
    when 'bank_transfer' then 'bankas pārskaitījums'
    else p_method end;
$$;
revoke execute on function public.payment_method_label(text, jsonb) from public, anon, authenticated;

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

  if not found then
    -- no proforma: only orders paid online (Montonio) get their final invoice automatically
    if o.payment_provider is distinct from 'montonio' then return null; end if;
    v_paid := coalesce(o.paid_at, now());
    v_number := public.issue_invoice(p_order, 'invoice', 0);
    v_notes := concat_ws(E'\n',
      'Apmaksāts tiešsaistē (Montonio, ' || public.payment_method_label(o.payment_method, o.payment_meta) || ') '
        || to_char(v_paid at time zone 'Europe/Riga', 'DD.MM.YYYY') || '.',
      nullif(trim(coalesce(public.setting('invoice')->>'notes', '')), ''));
    update public.invoices set status = 'paid', paid_at = v_paid, due_at = issued_at, notes = v_notes where number = v_number;
    update public.order_events set message = v_number || ' — automātiski pēc tiešsaistes maksājuma (Montonio)'
     where order_id = p_order and type = 'invoice' and message = v_number;
    return v_number;
  end if;

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

-- ───────────────────────── server-only payment RPCs ─────────────────────────
-- A new Montonio payment attempt was created for the order (first try or "pay again").
create or replace function public.payment_attach(p_order uuid, p_ref text, p_method text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_attempt int;
begin
  if p_method not in ('montonio_bank', 'montonio_card') then raise exception 'invalid_payment'; end if;
  if coalesce(trim(p_ref), '') = '' then raise exception 'invalid_ref'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;
  if o.payment_status not in ('pending', 'failed') or o.payment_method not in ('montonio_bank', 'montonio_card') then
    raise exception 'payment_not_allowed';
  end if;
  v_attempt := coalesce((o.payment_meta->>'attempts')::int, 0) + 1;
  update public.orders
     set payment_provider = 'montonio', payment_ref = p_ref, payment_method = p_method, payment_status = 'pending',
         payment_meta = (coalesce(payment_meta, '{}'::jsonb) - 'provider_name' - 'sender_name' - 'montonio_status')
                        || coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('attempts', v_attempt)
   where id = p_order;
  insert into public.order_events (order_id, type, message)
  values (p_order, 'payment',
    case when v_attempt > 1 then 'Atkārtots Montonio maksājums (' || v_attempt || '. mēģinājums) — ' else 'Montonio maksājums izveidots — ' end
      || public.payment_method_label(p_method, p_meta) || coalesce(', ' || nullif(p_meta->>'preferred_provider', ''), '') || ' · ' || p_ref);
  return jsonb_build_object('attempt', v_attempt);
end $$;

-- Applies a Montonio payment status (webhook / return page / admin re-check). Safe to call any number of
-- times: a transition happens at most once (row lock + state checks); `changed` tells the caller whether this
-- call performed it (e-mails are sent only then).
--   PAID                      → payment_status 'paid' (+ paid_at) → trigger issues the final invoice.
--                               A PAID for a cancelled order re-opens it (goods are taken again by 0008).
--   ABANDONED (current try)   → payment_status 'failed'; a 'new' order is cancelled (stock restored by 0008).
--   VOIDED                    → payment_status 'failed' (+ warning event, the order is kept for manual review).
--   REFUNDED / PARTIALLY_REF. → refunded / partially_refunded.
--   PENDING / AUTHORIZED      → no change.
create or replace function public.payment_apply_status(p_order uuid, p_ref text, p_status text, p_amount numeric default null,
  p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_status text := upper(coalesce(p_status, ''));
  v_online boolean;
  v_current boolean;
  v_new_pay text;
  v_msg text;
  v_reopen boolean := false;
  v_cancel boolean := false;
  v_final text;
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('montonio_status', upper(coalesce(p_status, '')));
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return jsonb_build_object('found', false, 'changed', false); end if;
  if o.payment_provider is distinct from 'montonio' then
    return jsonb_build_object('found', true, 'changed', false, 'ignored', 'not_montonio', 'payment_status', o.payment_status);
  end if;
  v_online := o.payment_method in ('montonio_bank', 'montonio_card');
  v_current := p_ref is not distinct from o.payment_ref;

  if v_status = 'PAID' then
    if o.payment_status in ('paid', 'refunded', 'partially_refunded') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    if p_amount is not null and abs(p_amount - o.total_gross) > 0.01 then
      v_msg := 'UZMANĪBU: Montonio maksājuma summa ' || to_char(p_amount, 'FM999999990.00') || ' EUR nesakrīt ar pasūtījuma summu '
               || to_char(o.total_gross, 'FM999999990.00') || ' EUR — pārbaudiet un atzīmējiet apmaksu manuāli.';
      if not exists (select 1 from public.order_events where order_id = p_order and type = 'payment' and message = v_msg) then
        insert into public.order_events (order_id, type, message) values (p_order, 'payment', v_msg);
      end if;
      return jsonb_build_object('found', true, 'changed', false, 'amount_mismatch', true, 'payment_status', o.payment_status);
    end if;
    v_reopen := o.status = 'cancelled';
    -- event first, so the timeline reads: payment → final invoice (issued by the trigger on the update below)
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', 'Apmaksāts tiešsaistē (Montonio, ' || public.payment_method_label(o.payment_method, coalesce(o.payment_meta, '{}'::jsonb) || v_meta) || ')'
      || coalesce(' · ' || nullif(v_meta->>'sender_name', ''), '')
      || case when not v_online then ' — klients bija pārgājis uz ' || public.payment_method_label(o.payment_method) || '; pārbaudiet, vai nav samaksāts divreiz' else '' end);
    update public.orders
       set payment_status = 'paid', paid_at = coalesce(paid_at, now()),
           payment_ref = coalesce(nullif(p_ref, ''), payment_ref),
           payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta,
           status = case when v_reopen then 'new' else status end
     where id = p_order;
    if v_reopen then
      insert into public.order_events (order_id, type, message)
      values (p_order, 'status', 'Atcelts → Jauns (maksājums saņemts pēc atcelšanas — pārbaudiet atlikumus)');
    end if;
    select number into v_final from public.invoices
     where order_id = p_order and type = 'invoice' and status <> 'void' order by created_at desc limit 1;
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', 'paid', 'status', case when v_reopen then 'new' else o.status end,
      'reopened', v_reopen, 'final_invoice', v_final);
  end if;

  if v_status = 'ABANDONED' then
    -- stale attempts (the customer already started a newer one) and switched / paid orders are left alone
    if not v_current or not v_online or o.payment_status not in ('pending', 'failed') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    if o.payment_status = 'failed' and o.status = 'cancelled' then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    v_cancel := o.status = 'new';
    update public.orders
       set payment_status = 'failed',
           payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta,
           status = case when v_cancel then 'cancelled' else status end
     where id = p_order;
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', coalesce(nullif(v_meta->>'reason', ''), 'Tiešsaistes maksājums netika pabeigts (Montonio: ABANDONED)'));
    if v_cancel then
      insert into public.order_events (order_id, type, message)
      values (p_order, 'status', 'Jauns → Atcelts (neapmaksāts tiešsaistes maksājums, atlikumi atjaunoti)');
    end if;
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', 'failed', 'status', case when v_cancel then 'cancelled' else o.status end,
      'cancelled', v_cancel);
  end if;

  if v_status = 'VOIDED' then
    if o.payment_status = 'failed' or (not v_current and o.payment_status <> 'paid') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    update public.orders
       set payment_status = 'failed', paid_at = null, payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta
     where id = p_order;
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', 'UZMANĪBU: banka anulēja maksājumu (Montonio: VOIDED). Nesūtiet preces, kamēr apmaksa nav pārbaudīta'
      || case when o.payment_status = 'paid' then ' — izrakstītais rēķins jāanulē vai jākoriģē manuāli.' else '.' end);
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', 'failed', 'status', o.status, 'voided', true);
  end if;

  if v_status in ('REFUNDED', 'PARTIALLY_REFUNDED') then
    v_new_pay := case v_status when 'REFUNDED' then 'refunded' else 'partially_refunded' end;
    if o.payment_status = v_new_pay or o.payment_status not in ('paid', 'partially_refunded') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    update public.orders set payment_status = v_new_pay, payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta where id = p_order;
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', case when v_new_pay = 'refunded' then 'Maksājums pilnībā atmaksāts (Montonio)' else 'Maksājums daļēji atmaksāts (Montonio)' end);
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', v_new_pay, 'status', o.status);
  end if;

  -- PENDING / AUTHORIZED / unknown: nothing to change
  return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
end $$;

-- "Pay by bank transfer instead": unpaid online order → bank transfer + proforma (like place_order would have).
create or replace function public.payment_switch_to_transfer(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_invoice text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;
  if o.payment_method not in ('montonio_bank', 'montonio_card') or o.payment_status not in ('pending', 'failed') then
    raise exception 'payment_not_allowed';
  end if;
  update public.orders set payment_method = 'bank_transfer', payment_status = 'unpaid' where id = p_order;
  insert into public.order_events (order_id, type, message)
  values (p_order, 'payment', 'Klients izvēlējās apmaksu ar bankas pārskaitījumu (tiešsaistes maksājums netika pabeigts)');
  select number into v_invoice from public.invoices
   where order_id = p_order and type = 'proforma' and status <> 'void' order by created_at desc limit 1;
  if v_invoice is null then
    v_invoice := public.issue_invoice(p_order, 'proforma', 7);
  end if;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total_gross', o.total_gross, 'invoice_number', v_invoice);
end $$;

revoke execute on function public.payment_attach(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.payment_apply_status(uuid, text, text, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.payment_switch_to_transfer(uuid) from public, anon, authenticated;
grant execute on function public.payment_attach(uuid, text, text, jsonb) to service_role;
grant execute on function public.payment_apply_status(uuid, text, text, numeric, jsonb) to service_role;
grant execute on function public.payment_switch_to_transfer(uuid) to service_role;
