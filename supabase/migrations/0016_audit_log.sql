-- Admin activity log ("Darbību žurnāls"): every insert / update / delete an ADMIN makes in the shop tables is
-- recorded by a trigger — who, when, what (human label) and exactly which fields changed (old → new).
-- Readable only by the audit viewer (barops.edijs@gmail.com); nobody can change or delete entries through the API.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'VISIT')),
  label text,
  changes jsonb not null default '{}'::jsonb,
  auto boolean not null default false
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, at desc);
create index if not exists audit_log_table_idx on public.audit_log (table_name, at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.is_audit_viewer()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(lower(auth.jwt()->>'email') in ('barops.edijs@gmail.com'), false) and public.is_admin();
$$;

drop policy if exists audit_log_viewer_select on public.audit_log;
create policy audit_log_viewer_select on public.audit_log for select to authenticated using (public.is_audit_viewer());

-- ───────── field-level diff (nested objects such as i18n / settings values are compared key by key) ─────────
create or replace function public.audit_diff(p_old jsonb, p_new jsonb, p_prefix text default '', p_depth int default 0)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  o jsonb;
  n jsonb;
  r jsonb := '{}'::jsonb;
begin
  for k in select key from jsonb_object_keys(coalesce(p_old, '{}'::jsonb) || coalesce(p_new, '{}'::jsonb)) as t(key) loop
    o := p_old -> k;
    n := p_new -> k;
    if o is not distinct from n then continue; end if;
    if p_depth < 3 and jsonb_typeof(o) = 'object' and jsonb_typeof(n) = 'object' then
      r := r || public.audit_diff(o, n, p_prefix || k || '.', p_depth + 1);
    else
      r := r || jsonb_build_object(p_prefix || k, jsonb_build_array(coalesce(o, 'null'::jsonb), coalesce(n, 'null'::jsonb)));
    end if;
  end loop;
  return r;
end $$;

-- ───────── human label of a row ─────────
create or replace function public.audit_label(p_table text, r jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  case p_table
    when 'products' then
      v := coalesce(r->'i18n'->'lv'->>'name', r->'i18n'->'en'->>'name', r->>'slug');
    when 'product_variants' then
      select coalesce(p.i18n->'lv'->>'name', p.i18n->'en'->>'name', p.slug) into v from public.products p where p.id = (r->>'product_id')::uuid;
      v := concat_ws(' · ', v, nullif(trim(concat(((r->>'size')::numeric)::float8::text, ' ', r->>'unit')), ''), '(' || (r->>'sku') || ')');
    when 'categories' then
      v := coalesce(r->'i18n'->'lv'->>'name', r->'i18n'->'en'->>'name', r->>'slug');
    when 'orders' then
      v := concat_ws(' · ', r->>'number', coalesce(nullif(r->'customer'->>'company_name', ''), r->'customer'->>'name', r->>'email'));
    when 'order_items' then
      select o.number into v from public.orders o where o.id = (r->>'order_id')::uuid;
      v := concat_ws(' · ', v, r->>'name', r->>'pack_label');
    when 'invoices' then
      v := r->>'number';
    when 'shipments' then
      select o.number into v from public.orders o where o.id = (r->>'order_id')::uuid;
      v := concat_ws(' · ', v, upper(r->>'carrier'), r->>'tracking_number');
    when 'shipping_rates' then
      v := concat_ws(' · ', upper(r->>'carrier'), r->>'service_name', r->>'country', r->>'size_code');
    when 'shipping_carriers' then
      v := coalesce(r->>'name', r->>'code');
    when 'settings' then
      v := r->>'key';
    when 'profiles' then
      v := coalesce(nullif(r->>'company_name', ''), nullif(r->>'full_name', ''), r->>'email');
    when 'raben_orders' then
      v := coalesce(r->>'number', r->>'reference');
    when 'raben_addresses' then
      v := coalesce(r->>'label', r->>'name');
    when 'inquiries' then
      v := concat_ws(' · ', r->>'name', r->>'company');
    when 'admin_allowlist', 'newsletter' then
      v := r->>'email';
    else
      v := coalesce(r->>'name', r->>'number', r->>'email', r->>'id');
  end case;
  return left(v, 300);
end $$;

-- ───────── the trigger ─────────
create or replace function public.audit_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_skip text[] := array['updated_at', 'created_at', 'last_tracked_at'];
  k text;
begin
  -- only admins' actions (customers placing orders, webhooks and cron jobs are not logged)
  if v_uid is null or not public.is_admin() then
    return coalesce(new, old);
  end if;

  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  foreach k in array v_skip loop
    v_old := v_old - k;
    v_new := v_new - k;
  end loop;

  if tg_op = 'UPDATE' then
    v_changes := public.audit_diff(v_old, v_new);
    if v_changes = '{}'::jsonb then return new; end if;
  else
    v_changes := coalesce(v_new, v_old);
  end if;

  insert into public.audit_log (actor_id, actor_email, table_name, record_id, action, label, changes, auto)
  values (
    v_uid,
    coalesce(auth.jwt()->>'email', (select email from public.profiles where id = v_uid)),
    tg_table_name,
    coalesce(v_new->>'id', v_old->>'id', v_new->>'key', v_old->>'key', v_new->>'code', v_old->>'code', v_new->>'email', v_old->>'email'),
    tg_op,
    public.audit_label(tg_table_name, coalesce(v_new, v_old)),
    v_changes,
    pg_trigger_depth() > 1
  );
  return coalesce(new, old);
exception when others then
  -- the log must never break the shop
  raise warning 'audit_capture failed on %: %', tg_table_name, sqlerrm;
  return coalesce(new, old);
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'product_variants', 'categories', 'orders', 'order_items', 'invoices', 'shipments',
    'shipping_rates', 'shipping_carriers', 'settings', 'profiles', 'raben_orders', 'raben_addresses',
    'inquiries', 'admin_allowlist', 'newsletter'
  ] loop
    execute format('drop trigger if exists zz_audit on public.%I', t);
    execute format('create trigger zz_audit after insert or update or delete on public.%I for each row execute function public.audit_capture()', t);
  end loop;
end $$;

-- ───────── admin visits ("opened the admin"), at most one entry per 30 min per person ─────────
create or replace function public.audit_admin_visit(p_path text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then return; end if;
  if exists (select 1 from public.audit_log where actor_id = v_uid and action = 'VISIT' and at > now() - interval '30 minutes') then
    return;
  end if;
  insert into public.audit_log (actor_id, actor_email, table_name, action, label, changes)
  values (v_uid, coalesce(auth.jwt()->>'email', (select email from public.profiles where id = v_uid)), 'admin', 'VISIT',
          'Atvēra administrāciju', jsonb_build_object('path', left(coalesce(p_path, ''), 200)));
end $$;

-- ───────── admins + their last sign-in (auth.users) for the log page ─────────
create or replace function public.audit_admins()
returns table (id uuid, email text, full_name text, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
   where p.role = 'admin' and public.is_audit_viewer()
   order by p.email;
$$;

revoke execute on function public.audit_capture() from public, anon, authenticated;
revoke execute on function public.audit_label(text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_admin_visit(text) from public, anon;
grant execute on function public.audit_admin_visit(text) to authenticated;
revoke execute on function public.audit_admins() from public, anon;
grant execute on function public.audit_admins() to authenticated;
