-- Divinol: inventory & pricing workflow
--   • explicit per-variant availability status (+ lead time, low-stock threshold)
--   • in_stock kept for backward compatibility — always derived from availability by trigger
--   • automatic stock movements ledger (orders, cancellations, manual edits, bulk, CSV import)
--   • price history
--   • admin RPC for inline/bulk/import changes in one transaction
--
-- Stock changes are logged by an AFTER UPDATE trigger on product_variants. The "why" of a change is passed via
-- transaction-local settings (divinol.stock_reason / divinol.stock_order / divinol.stock_note / divinol.price_reason):
--   • place_order inserts order_items → trigger sets reason 'order' + order id → its stock decrement is logged
--   • orders.status → 'cancelled' (or order deleted) → stock restored with reason 'cancel'
--   • admin_inventory_apply() sets 'manual' | 'bulk' | 'import'
--   • any other admin write (e.g. product editor) defaults to 'manual'

-- ───────────────────────── columns ─────────────────────────
alter table public.product_variants
  add column if not exists availability text not null default 'in_stock',
  add column if not exists lead_time_days int,
  add column if not exists low_stock_threshold int not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_variants_availability_chk') then
    alter table public.product_variants add constraint product_variants_availability_chk
      check (availability in ('in_stock', 'on_order', 'out_of_stock', 'discontinued'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_variants_lead_time_chk') then
    alter table public.product_variants add constraint product_variants_lead_time_chk
      check (lead_time_days is null or lead_time_days between 0 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_variants_low_stock_chk') then
    alter table public.product_variants add constraint product_variants_low_stock_chk
      check (low_stock_threshold between 0 and 100000);
  end if;
end $$;

-- Backfill from the imported WooCommerce flag: false was shown on the storefront as "Pēc pasūtījuma".
update public.product_variants set availability = case when in_stock then 'in_stock' else 'on_order' end;
update public.product_variants set stock = 0 where stock < 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_variants_stock_nonneg') then
    alter table public.product_variants add constraint product_variants_stock_nonneg check (stock is null or stock >= 0);
  end if;
end $$;

-- Effective level used by admin filters/widgets (low_stock is derived, never stored by hand).
alter table public.product_variants drop column if exists stock_level;
alter table public.product_variants add column stock_level text generated always as (
  case
    when availability <> 'in_stock' then availability
    when stock is not null and stock <= low_stock_threshold then 'low_stock'
    else 'in_stock'
  end
) stored;
create index if not exists product_variants_stock_level_idx on public.product_variants (stock_level);

-- ───────────────────────── ledger tables ─────────────────────────
create table if not exists public.stock_movements (
  id bigserial primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta int not null default 0,
  stock_before int,
  stock_after int,
  availability_before text,
  availability_after text,
  reason text not null check (reason in ('order', 'cancel', 'manual', 'import', 'bulk')),
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);
create index if not exists stock_movements_order_idx on public.stock_movements (order_id) where order_id is not null;
create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);

create table if not exists public.price_history (
  id bigserial primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  old_net numeric(12,4),
  new_net numeric(12,4) not null,
  reason text not null default 'manual' check (reason in ('manual', 'bulk', 'import', 'create')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists price_history_variant_idx on public.price_history (variant_id, created_at desc);

alter table public.stock_movements enable row level security;
alter table public.price_history enable row level security;
drop policy if exists "stock movements admin read" on public.stock_movements;
create policy "stock movements admin read" on public.stock_movements for select using (public.is_admin());
drop policy if exists "price history admin read" on public.price_history;
create policy "price history admin read" on public.price_history for select using (public.is_admin());
-- Writes happen only through SECURITY DEFINER triggers / RPCs.
revoke insert, update, delete, truncate on public.stock_movements from anon, authenticated;
revoke insert, update, delete, truncate on public.price_history from anon, authenticated;
revoke all on sequence public.stock_movements_id_seq from anon, authenticated;
revoke all on sequence public.price_history_id_seq from anon, authenticated;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.inv_ctx(p_key text) returns text
language sql stable set search_path = public as $$
  select nullif(current_setting('divinol.' || p_key, true), '');
$$;
revoke execute on function public.inv_ctx(text) from public, anon, authenticated;

create or replace function public.inv_set_ctx(p_reason text, p_order uuid default null, p_note text default null) returns void
language sql set search_path = public as $$
  select set_config('divinol.stock_reason', coalesce(p_reason, ''), true),
         set_config('divinol.price_reason', coalesce(p_reason, ''), true),
         set_config('divinol.stock_order', coalesce(p_order::text, ''), true),
         set_config('divinol.stock_note', coalesce(left(p_note, 500), ''), true);
$$;
revoke execute on function public.inv_set_ctx(text, uuid, text) from public, anon, authenticated;

-- ───────────────────────── availability sync (BEFORE) ─────────────────────────
create or replace function public.variant_sync_availability() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- legacy writers (catalog import) only know in_stock
    if new.availability = 'in_stock' and new.in_stock is false then
      new.availability := 'on_order';
    end if;
    if new.stock is not null and new.stock <= 0 and new.availability = 'in_stock' then
      new.availability := 'out_of_stock';
    end if;
  else
    if new.availability is not distinct from old.availability and new.in_stock is distinct from old.in_stock then
      -- a legacy writer toggled only in_stock
      new.availability := case
        when new.in_stock then 'in_stock'
        when old.availability in ('on_order', 'out_of_stock', 'discontinued') then old.availability
        else 'on_order' end;
    end if;
    -- automatic status from quantity (only when the status itself was not changed in the same statement)
    if new.availability is not distinct from old.availability and new.stock is distinct from old.stock and new.stock is not null then
      if new.stock <= 0 and new.availability = 'in_stock' then
        new.availability := 'out_of_stock';
      elsif new.stock > 0 and coalesce(old.stock, 0) <= 0 and new.availability = 'out_of_stock' then
        new.availability := 'in_stock';
      end if;
    end if;
  end if;
  if new.availability <> 'on_order' then
    new.lead_time_days := case when new.availability = 'in_stock' then null else new.lead_time_days end;
  end if;
  new.in_stock := new.availability = 'in_stock';
  return new;
end $$;
revoke execute on function public.variant_sync_availability() from public, anon, authenticated;

drop trigger if exists variants_availability on public.product_variants;
create trigger variants_availability before insert or update on public.product_variants
  for each row execute function public.variant_sync_availability();

-- ───────────────────────── change log (AFTER) ─────────────────────────
create or replace function public.variant_log_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := public.is_admin();
  v_uid uuid := case when v_admin then auth.uid() else null end;
  v_reason text := public.inv_ctx('stock_reason');
  v_preason text := public.inv_ctx('price_reason');
  v_order uuid := public.inv_ctx('stock_order')::uuid;
  v_note text := public.inv_ctx('stock_note');
begin
  if v_reason is null or v_reason not in ('order', 'cancel', 'manual', 'import', 'bulk') then
    -- admin / SQL console → manual; a storefront request (customer or anonymous JWT) → order
    v_reason := case when v_admin or coalesce(auth.role(), '') not in ('anon', 'authenticated') then 'manual' else 'order' end;
  end if;
  if v_preason is null or v_preason not in ('manual', 'bulk', 'import') then v_preason := 'manual'; end if;

  if tg_op = 'INSERT' then
    if new.stock is not null then
      insert into public.stock_movements (variant_id, delta, stock_before, stock_after, availability_before, availability_after, reason, order_id, created_by, note)
      values (new.id, new.stock, null, new.stock, null, new.availability, v_reason, v_order, v_uid, coalesce(v_note, 'Sākuma atlikums'));
    end if;
    insert into public.price_history (variant_id, old_net, new_net, reason, created_by)
    values (new.id, null, new.price_net, 'create', v_uid);
    return new;
  end if;

  if new.stock is distinct from old.stock or new.availability is distinct from old.availability then
    insert into public.stock_movements (variant_id, delta, stock_before, stock_after, availability_before, availability_after, reason, order_id, created_by, note)
    values (
      new.id,
      coalesce(new.stock, 0) - coalesce(old.stock, 0),
      old.stock, new.stock, old.availability, new.availability,
      v_reason, v_order, v_uid,
      coalesce(v_note, case
        when old.stock is null and new.stock is not null then 'Atlikuma uzskaite ieslēgta'
        when old.stock is not null and new.stock is null then 'Atlikuma uzskaite izslēgta'
        else null end)
    );
  end if;

  if new.price_net is distinct from old.price_net then
    insert into public.price_history (variant_id, old_net, new_net, reason, created_by)
    values (new.id, old.price_net, new.price_net, v_preason, v_uid);
  end if;
  return new;
end $$;
revoke execute on function public.variant_log_changes() from public, anon, authenticated;

drop trigger if exists variants_log_changes on public.product_variants;
create trigger variants_log_changes after insert or update on public.product_variants
  for each row execute function public.variant_log_changes();

-- ───────────────────────── orders → stock ─────────────────────────
-- place_order inserts order_items and then decrements tracked stock; this marks the transaction so the
-- decrement is logged as reason 'order' with the order id. Discontinued variants cannot be bought.
create or replace function public.order_item_stock_context() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_av text;
  v_slug text;
begin
  if new.variant_id is not null and not public.is_admin() then
    select pv.availability, p.slug into v_av, v_slug
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = new.variant_id;
    if v_av = 'discontinued' then
      raise exception 'product_not_found:%', v_slug;
    end if;
  end if;
  perform public.inv_set_ctx('order', new.order_id, null);
  return new;
end $$;
revoke execute on function public.order_item_stock_context() from public, anon, authenticated;

drop trigger if exists order_items_stock_context on public.order_items;
create trigger order_items_stock_context before insert on public.order_items
  for each row execute function public.order_item_stock_context();

-- Restores exactly what the order took (net of earlier restores), based on the ledger.
create or replace function public.inv_restore_order(p_order uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  perform public.inv_set_ctx('cancel', p_order, p_note);
  for r in
    select m.variant_id, -sum(m.delta)::int as qty
      from public.stock_movements m
     where m.order_id = p_order and m.reason in ('order', 'cancel')
     group by m.variant_id
    having sum(m.delta) < 0
  loop
    update public.product_variants set stock = stock + r.qty where id = r.variant_id and stock is not null;
  end loop;
  perform public.inv_set_ctx(null, null, null);
end $$;
revoke execute on function public.inv_restore_order(uuid, text) from public, anon, authenticated;

create or replace function public.order_status_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'cancelled' then
      perform public.inv_restore_order(old.id, 'Pasūtījums ' || old.number || ' dzēsts');
    end if;
    return old;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.inv_restore_order(new.id, 'Pasūtījums ' || new.number || ' atcelts');
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    -- order re-opened → take the goods again
    perform public.inv_set_ctx('order', new.id, 'Pasūtījums ' || new.number || ' atjaunots');
    update public.product_variants pv set stock = greatest(0, pv.stock - oi.qty)
      from (select variant_id, sum(qty)::int qty from public.order_items where order_id = new.id and variant_id is not null group by variant_id) oi
     where pv.id = oi.variant_id and pv.stock is not null;
    perform public.inv_set_ctx(null, null, null);
  end if;
  return new;
end $$;
revoke execute on function public.order_status_stock() from public, anon, authenticated;

drop trigger if exists orders_status_stock on public.orders;
create trigger orders_status_stock after update of status on public.orders
  for each row when (old.status is distinct from new.status) execute function public.order_status_stock();
drop trigger if exists orders_delete_stock on public.orders;
create trigger orders_delete_stock before delete on public.orders
  for each row execute function public.order_status_stock();

-- ───────────────────────── admin RPC ─────────────────────────
-- p_changes: [{ variant_id, price_net?, stock? (null = stop tracking), stock_delta?, availability?, lead_time_days?,
--               low_stock_threshold?, note? }]  — only present keys are changed.
create or replace function public.admin_inventory_apply(p_changes jsonb, p_reason text default 'manual', p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
  v public.product_variants%rowtype;
  n public.product_variants%rowtype;
  v_id uuid;
  v_changed int := 0;
  v_rows jsonb := '[]'::jsonb;
  v_price numeric;
  v_stock int;
  v_av text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_reason not in ('manual', 'bulk', 'import') then raise exception 'invalid_reason'; end if;
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'invalid_payload'; end if;
  if jsonb_array_length(p_changes) > 2000 then raise exception 'too_many_rows'; end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    v_id := (c->>'variant_id')::uuid;
    select * into v from public.product_variants where id = v_id for update;
    if not found then raise exception 'variant_not_found:%', v_id; end if;

    v_price := v.price_net;
    if c ? 'price_net' then
      v_price := round((c->>'price_net')::numeric, 4);
      if v_price is null or v_price < 0 or v_price > 1000000 then raise exception 'invalid_price:%', coalesce(v.sku, v_id::text); end if;
    end if;

    v_stock := v.stock;
    if c ? 'stock' then
      v_stock := (c->>'stock')::int;
      if v_stock is not null and v_stock < 0 then raise exception 'invalid_stock:%', coalesce(v.sku, v_id::text); end if;
    elsif c ? 'stock_delta' then
      v_stock := greatest(0, coalesce(v.stock, 0) + (c->>'stock_delta')::int);
    end if;

    v_av := coalesce(c->>'availability', v.availability);

    perform public.inv_set_ctx(p_reason, null, coalesce(nullif(c->>'note', ''), p_note));
    update public.product_variants set
      price_net = v_price,
      stock = v_stock,
      availability = v_av,
      lead_time_days = case when c ? 'lead_time_days' then (c->>'lead_time_days')::int else lead_time_days end,
      low_stock_threshold = case when c ? 'low_stock_threshold' then coalesce((c->>'low_stock_threshold')::int, 3) else low_stock_threshold end
    where id = v_id
    returning * into n;

    if n.price_net is distinct from v.price_net or n.stock is distinct from v.stock or n.availability is distinct from v.availability
       or n.lead_time_days is distinct from v.lead_time_days or n.low_stock_threshold is distinct from v.low_stock_threshold then
      v_changed := v_changed + 1;
    end if;
    v_rows := v_rows || jsonb_build_object(
      'id', n.id, 'price_net', n.price_net, 'stock', n.stock, 'availability', n.availability, 'in_stock', n.in_stock,
      'lead_time_days', n.lead_time_days, 'low_stock_threshold', n.low_stock_threshold, 'stock_level', n.stock_level);
  end loop;
  perform public.inv_set_ctx(null, null, null);
  return jsonb_build_object('changed', v_changed, 'rows', v_rows);
end $$;
revoke execute on function public.admin_inventory_apply(jsonb, text, text) from public, anon;
grant execute on function public.admin_inventory_apply(jsonb, text, text) to authenticated;
