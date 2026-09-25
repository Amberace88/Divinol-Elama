-- Business logic as SECURITY DEFINER functions: prices are always recalculated on the server.

-- ───────────── settings defaults ─────────────
insert into public.settings (key, value, is_public) values
('company', '{
  "name": "SIA \"Elama\"",
  "reg_no": "40103512445",
  "vat_no": "LV40103512445",
  "address": "\"Priežkalni 2\", Jumpravas pag., Ogres nov., LV-5022",
  "warehouse": "Ventspils iela 51, Rīga, LV-1002",
  "phone": "+371 26556099",
  "email": "elama@elama.lv",
  "bank_name": "",
  "iban": "",
  "swift": "",
  "hours": ""
}'::jsonb, true),
('vat', '{"LV": 21, "EE": 24, "LT": 21}'::jsonb, true),
('shipping', '{
  "free_threshold": {"LV": 99, "EE": 149, "LT": 149},
  "methods": {
    "pickup": {"price_net": 0, "markets": ["LV"], "enabled": true},
    "parcel_locker": {"price_net": 2.89, "markets": ["LV","EE","LT"], "max_item": 20, "free_over": true, "enabled": true},
    "courier": {"price_net": 5.79, "surcharge": {"LV": 0, "EE": 4.13, "LT": 4.13}, "markets": ["LV","EE","LT"], "max_item": 25, "free_over": true, "enabled": true},
    "freight": {"price_net": null, "markets": ["LV","EE","LT"], "enabled": true}
  }
}'::jsonb, true),
('invoice', '{"due_days_default": 7, "notes": "Paldies par pirkumu!"}'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = p_key;
$$;

-- ───────────── place_order ─────────────
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
begin
  if v_market not in ('LV', 'EE', 'LT') then raise exception 'invalid_market'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'empty_cart'; end if;
  if jsonb_array_length(payload->'items') > 100 then raise exception 'too_many_items'; end if;
  if v_payment not in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup') then raise exception 'invalid_payment'; end if;

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

  -- items
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

  -- shipping
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
    payment_method, shipping_method, shipping_point, shipping_net, subtotal_net, discount_net, vat_rate, vat_amount,
    total_gross, reverse_charge, notes)
  values (v_number, v_uid, v_email, payload->>'phone',
    v_customer || jsonb_build_object('b2b', v_b2b, 'discount_percent', v_discount),
    payload->'shipping_address', payload->'billing_address', v_market, coalesce(payload->>'locale', 'lv'),
    v_payment, v_method, payload->'shipping_point', v_ship_net, v_subtotal, 0, v_vat, v_vat_amount,
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

  -- bank transfer → proforma, B2B invoice → invoice with payment terms
  if v_payment in ('bank_transfer', 'invoice') then
    v_due := case when v_payment = 'invoice' then greatest(v_profile.payment_terms_days, 7) else 7 end;
    v_invoice := public.issue_invoice(v_order_id, case when v_payment = 'invoice' then 'invoice' else 'proforma' end, v_due);
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'total_gross', v_total, 'subtotal_net', v_subtotal,
    'shipping_net', v_ship_net, 'vat_rate', v_vat, 'vat_amount', v_vat_amount, 'payment_method', v_payment,
    'invoice_number', v_invoice, 'reverse_charge', v_reverse);
end $$;

-- ───────────── invoices ─────────────
create or replace function public.issue_invoice(p_order uuid, p_type text, p_due_days int default 7) returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_number text;
  v_lines jsonb;
  v_ship_label text;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order_not_found'; end if;
  if p_type not in ('proforma', 'invoice', 'credit_note') then raise exception 'invalid_type'; end if;

  v_number := case p_type
    when 'proforma' then public.next_number('proforma', 'PR', 5)
    when 'credit_note' then public.next_number('credit', 'KR', 5)
    else public.next_number('invoice', 'ELA', 5) end;

  select coalesce(jsonb_agg(jsonb_build_object('sku', sku, 'name', name, 'pack', pack_label, 'qty', qty,
           'unit_net', unit_price_net, 'line_net', line_net) order by name), '[]'::jsonb)
    into v_lines from public.order_items where order_id = p_order;
  if o.shipping_net > 0 then
    v_ship_label := case o.shipping_method when 'courier' then 'Piegāde ar kurjeru' when 'parcel_locker' then 'Piegāde uz pakomātu' when 'freight' then 'Kravas piegāde' else 'Piegāde' end;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('sku', null, 'name', v_ship_label, 'pack', null, 'qty', 1, 'unit_net', o.shipping_net, 'line_net', o.shipping_net));
  end if;

  insert into public.invoices (number, order_id, user_id, type, due_at, buyer, seller, lines, subtotal_net, vat_rate, vat_amount, total_gross, reverse_charge)
  values (v_number, o.id, o.user_id, p_type, (now() at time zone 'Europe/Riga')::date + p_due_days,
    o.customer || jsonb_build_object('email', o.email, 'phone', o.phone, 'address', coalesce(o.billing_address, o.shipping_address)),
    public.setting('company'), v_lines,
    o.subtotal_net + o.shipping_net - o.discount_net, o.vat_rate, o.vat_amount, o.total_gross, o.reverse_charge);

  insert into public.order_events (order_id, type, message) values (o.id, 'invoice', v_number);
  return v_number;
end $$;

-- admin wrapper
create or replace function public.admin_create_invoice(p_order uuid, p_type text, p_due_days int default 14) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return public.issue_invoice(p_order, p_type, p_due_days);
end $$;

-- ───────────── inquiries / newsletter (public) ─────────────
create or replace function public.submit_inquiry(payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(payload->>'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if length(coalesce(payload->>'message', '')) > 5000 then raise exception 'too_long'; end if;
  if coalesce(payload->>'type', 'contact') not in ('contact', 'b2b', 'quote', 'oil_finder') then raise exception 'invalid_type'; end if;
  insert into public.inquiries (type, name, email, phone, company, message, payload, locale)
  values (coalesce(payload->>'type', 'contact'), left(coalesce(nullif(payload->>'name', ''), '—'), 200), lower(payload->>'email'),
          left(payload->>'phone', 50), left(payload->>'company', 200), payload->>'message',
          coalesce(payload->'extra', '{}'::jsonb), left(payload->>'locale', 5))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.subscribe_newsletter(p_email text, p_locale text default 'lv') returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  insert into public.newsletter (email, locale) values (lower(trim(p_email)), left(p_locale, 5)) on conflict (email) do nothing;
  return true;
end $$;

-- ───────────── admin: catalog import ─────────────
create or replace function public.admin_import_catalog(p_categories jsonb, p_products jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c jsonb; p jsonb; v jsonb;
  v_cat uuid; v_pid uuid; n_c int := 0; n_p int := 0; n_v int := 0; i int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  for c in select * from jsonb_array_elements(p_categories) loop
    insert into public.categories (slug, icon, image, sort, i18n)
    values (c->>'slug', coalesce(c->>'icon', 'droplets'), c->>'image', coalesce((c->>'sort')::int, 0), coalesce(c->'i18n', '{}'::jsonb))
    on conflict (slug) do update set icon = excluded.icon, image = excluded.image, sort = excluded.sort, i18n = excluded.i18n;
    n_c := n_c + 1;
  end loop;

  i := 0;
  for p in select * from jsonb_array_elements(p_products) loop
    i := i + 1;
    select id into v_cat from public.categories where slug = p->>'category';
    insert into public.products (slug, base_sku, category_id, sae, iso_vg, specs, oem_approvals, performance, images, i18n, legacy_slugs, sort)
    values (p->>'slug', p->>'base_sku', v_cat, p->>'sae', p->>'iso_vg',
      coalesce(array(select jsonb_array_elements_text(p->'specs')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p->'oem_approvals')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p->'performance')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p->'images')), '{}'),
      coalesce(p->'i18n', '{}'::jsonb),
      coalesce(array(select jsonb_array_elements_text(p->'legacy_slugs')), '{}'), i)
    on conflict (slug) do update set base_sku = excluded.base_sku, category_id = excluded.category_id, sae = excluded.sae,
      iso_vg = excluded.iso_vg, specs = excluded.specs, oem_approvals = excluded.oem_approvals, performance = excluded.performance,
      images = excluded.images, i18n = excluded.i18n, legacy_slugs = excluded.legacy_slugs
    returning id into v_pid;
    n_p := n_p + 1;

    for v in select * from jsonb_array_elements(p->'variants') loop
      if v->>'sku' is not null and exists (select 1 from public.product_variants where sku = v->>'sku') then
        update public.product_variants set product_id = v_pid, size = (v->>'size')::numeric, unit = v->>'unit',
          price_net = (v->>'price_net')::numeric, in_stock = (v->>'in_stock')::boolean, image = v->>'image'
         where sku = v->>'sku';
      elsif v->>'sku' is null and exists (select 1 from public.product_variants where product_id = v_pid and sku is null
            and coalesce(size, 0) = coalesce((v->>'size')::numeric, 0) and unit = v->>'unit') then
        update public.product_variants set price_net = (v->>'price_net')::numeric, in_stock = (v->>'in_stock')::boolean, image = v->>'image'
         where product_id = v_pid and sku is null and coalesce(size, 0) = coalesce((v->>'size')::numeric, 0) and unit = v->>'unit';
      else
        insert into public.product_variants (product_id, sku, size, unit, price_net, in_stock, image, sort)
        values (v_pid, v->>'sku', (v->>'size')::numeric, v->>'unit', (v->>'price_net')::numeric,
                coalesce((v->>'in_stock')::boolean, true), v->>'image', coalesce((v->>'size')::numeric, 0)::int);
      end if;
      n_v := n_v + 1;
    end loop;
  end loop;
  return jsonb_build_object('categories', n_c, 'products', n_p, 'variants', n_v);
end $$;

-- ───────────── admin: dashboard stats ─────────────
create or replace function public.admin_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := date_trunc('day', now()) - make_interval(days => p_days - 1);
  v_prev timestamptz := v_from - make_interval(days => p_days);
  r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'revenue', coalesce((select sum(total_gross) from orders where created_at >= v_from and status <> 'cancelled'), 0),
    'revenue_prev', coalesce((select sum(total_gross) from orders where created_at >= v_prev and created_at < v_from and status <> 'cancelled'), 0),
    'orders', (select count(*) from orders where created_at >= v_from and status <> 'cancelled'),
    'orders_prev', (select count(*) from orders where created_at >= v_prev and created_at < v_from and status <> 'cancelled'),
    'customers_new', (select count(*) from profiles where created_at >= v_from),
    'b2b_pending', (select count(*) from profiles where b2b_status = 'pending'),
    'orders_open', (select count(*) from orders where status in ('new', 'confirmed', 'processing')),
    'unpaid_total', coalesce((select sum(total_gross) from invoices where status = 'issued' and type = 'invoice'), 0),
    'overdue', (select count(*) from invoices where status = 'issued' and type = 'invoice' and due_at < current_date),
    'inquiries_new', (select count(*) from inquiries where status = 'new'),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'revenue', coalesce(s.rev, 0), 'orders', coalesce(s.cnt, 0)) order by d)
        from generate_series(v_from, date_trunc('day', now()), interval '1 day') d
        left join (select date_trunc('day', created_at) dd, sum(total_gross) rev, count(*) cnt from orders
                    where created_at >= v_from and status <> 'cancelled' group by 1) s on s.dd = d), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select oi.name, sum(oi.qty) qty, sum(oi.line_net) revenue_net
          from order_items oi join orders o on o.id = oi.order_id
         where o.created_at >= v_from and o.status <> 'cancelled'
         group by oi.name order by sum(oi.line_net) desc limit 8) t), '[]'::jsonb),
    'by_market', coalesce((
      select jsonb_object_agg(market, total) from (select market, sum(total_gross) total from orders
        where created_at >= v_from and status <> 'cancelled' group by market) m), '{}'::jsonb),
    'low_stock', coalesce((
      select jsonb_agg(t) from (
        select p.i18n->'lv'->>'name' as name, pv.sku, pv.stock from product_variants pv join products p on p.id = pv.product_id
         where pv.stock is not null and pv.stock <= 3 and pv.is_active order by pv.stock limit 10) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- permissions
revoke execute on function public.issue_invoice(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.setting(text) from public, anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
grant execute on function public.admin_create_invoice(uuid, text, int) to authenticated;
grant execute on function public.admin_import_catalog(jsonb, jsonb) to authenticated;
grant execute on function public.admin_stats(int) to authenticated;
revoke execute on function public.admin_create_invoice(uuid, text, int) from anon;
revoke execute on function public.admin_import_catalog(jsonb, jsonb) from anon;
revoke execute on function public.admin_stats(int) from anon;
