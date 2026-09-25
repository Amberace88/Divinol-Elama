-- Divinol / SIA Elama e-commerce platform schema
create extension if not exists pg_trgm;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  customer_type text not null default 'private' check (customer_type in ('private', 'business')),
  company_name text,
  reg_no text,
  vat_no text,
  legal_address text,
  b2b_status text not null default 'none' check (b2b_status in ('none', 'pending', 'approved', 'rejected')),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 90),
  payment_terms_days int not null default 0 check (payment_terms_days between 0 and 120),
  market text not null default 'LV' check (market in ('LV', 'EE', 'LT')),
  preferred_locale text not null default 'lv',
  marketing_consent boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Customers may edit their own profile, but never role / pricing / B2B approval fields.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.discount_percent := old.discount_percent;
    new.payment_terms_days := old.payment_terms_days;
    new.admin_notes := old.admin_notes;
    if new.b2b_status is distinct from old.b2b_status
       and not (old.b2b_status in ('none', 'rejected') and new.b2b_status = 'pending') then
      new.b2b_status := old.b2b_status;
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, preferred_locale, market, customer_type, company_name, reg_no, vat_no)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'locale', 'lv'),
    coalesce(new.raw_user_meta_data->>'market', 'LV'),
    coalesce(new.raw_user_meta_data->>'customer_type', 'private'),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'reg_no',
    new.raw_user_meta_data->>'vat_no'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  name text not null,
  phone text,
  company text,
  street text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'LV',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.addresses(user_id);

-- ───────────────────────── catalog ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  icon text not null default 'droplets',
  image text,
  sort int not null default 0,
  i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  base_sku text,
  category_id uuid references public.categories(id) on delete set null,
  sae text,
  iso_vg text,
  specs text[] not null default '{}',
  oem_approvals text[] not null default '{}',
  performance text[] not null default '{}',
  images text[] not null default '{}',
  i18n jsonb not null default '{}'::jsonb,
  legacy_slugs text[] not null default '{}',
  tds_url text,
  sds_url text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(category_id);
create index products_search_idx on public.products using gin ((coalesce(i18n->'lv'->>'name','') || ' ' || coalesce(sae,'') || ' ' || coalesce(base_sku,'')) gin_trgm_ops);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  size numeric(10,3),
  unit text not null default 'l' check (unit in ('l', 'kg', 'pcs')),
  price_net numeric(12,2) not null check (price_net >= 0),
  cost_net numeric(12,2),
  stock int,
  in_stock boolean not null default true,
  image text,
  weight_kg numeric(10,3),
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.product_variants(product_id);
create unique index product_variants_sku_uq on public.product_variants(sku) where sku is not null;
create trigger variants_updated before update on public.product_variants for each row execute function public.set_updated_at();

-- ───────────────────────── orders & invoices ─────────────────────────
create table public.counters (
  key text primary key,
  value int not null default 0
);

create or replace function public.next_number(p_key text, p_prefix text, p_pad int default 5) returns text
language plpgsql security definer set search_path = public as $$
declare
  v int;
  y text := to_char(now() at time zone 'Europe/Riga', 'YYYY');
begin
  insert into public.counters(key, value) values (p_key || '-' || y, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value into v;
  return p_prefix || '-' || y || '-' || lpad(v::text, p_pad, '0');
end $$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  phone text,
  customer jsonb not null default '{}'::jsonb,        -- name, company_name, reg_no, vat_no, customer_type
  shipping_address jsonb,
  billing_address jsonb,
  market text not null default 'LV',
  locale text not null default 'lv',
  status text not null default 'new' check (status in ('new', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled')),
  payment_method text not null check (payment_method in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded', 'partially_refunded')),
  shipping_method text not null,
  shipping_point jsonb,
  shipping_net numeric(12,2) not null default 0,
  subtotal_net numeric(12,2) not null,
  discount_net numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null,
  vat_amount numeric(12,2) not null,
  total_gross numeric(12,2) not null,
  reverse_charge boolean not null default false,
  notes text,
  admin_notes text,
  tracking_code text,
  stripe_session_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders(user_id);
create index on public.orders(created_at desc);
create index on public.orders(status);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  sku text,
  name text not null,
  pack_label text,
  image text,
  qty int not null check (qty > 0),
  unit_price_net numeric(12,2) not null,
  line_net numeric(12,2) not null
);
create index on public.order_items(order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.order_events(order_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  type text not null default 'invoice' check (type in ('proforma', 'invoice', 'credit_note')),
  status text not null default 'issued' check (status in ('issued', 'paid', 'void')),
  issued_at date not null default (now() at time zone 'Europe/Riga')::date,
  due_at date,
  paid_at timestamptz,
  buyer jsonb not null default '{}'::jsonb,
  seller jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  subtotal_net numeric(12,2) not null,
  vat_rate numeric(5,2) not null,
  vat_amount numeric(12,2) not null,
  total_gross numeric(12,2) not null,
  reverse_charge boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.invoices(user_id);
create index on public.invoices(order_id);

-- ───────────────────────── inquiries & settings ─────────────────────────
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'contact' check (type in ('contact', 'b2b', 'quote', 'oil_finder')),
  name text not null,
  email text not null,
  phone text,
  company text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  locale text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'spam')),
  created_at timestamptz not null default now()
);
create index on public.inquiries(created_at desc);

create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.newsletter (
  email text primary key,
  locale text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.invoices enable row level security;
alter table public.inquiries enable row level security;
alter table public.settings enable row level security;
alter table public.newsletter enable row level security;

create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update using (id = auth.uid() or public.is_admin());
create policy "admin profile delete" on public.profiles for delete using (public.is_admin());

create policy "own addresses" on public.addresses for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create policy "categories public read" on public.categories for select using (is_active or public.is_admin());
create policy "categories admin write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products public read" on public.products for select using (is_active or public.is_admin());
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "variants public read" on public.product_variants for select using (is_active or public.is_admin());
create policy "variants admin write" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

create policy "orders own read" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders admin write" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "orders admin delete" on public.orders for delete using (public.is_admin());

create policy "order items own read" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "order items admin write" on public.order_items for all using (public.is_admin()) with check (public.is_admin());

create policy "order events own read" on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "order events admin write" on public.order_events for all using (public.is_admin()) with check (public.is_admin());

create policy "invoices own read" on public.invoices for select using (user_id = auth.uid() or public.is_admin());
create policy "invoices admin write" on public.invoices for all using (public.is_admin()) with check (public.is_admin());

create policy "inquiries admin" on public.inquiries for all using (public.is_admin()) with check (public.is_admin());
create policy "settings public read" on public.settings for select using (is_public or public.is_admin());
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());
create policy "newsletter admin" on public.newsletter for all using (public.is_admin()) with check (public.is_admin());
-- counters: no policies → only service role / security definer functions

revoke execute on function public.next_number(text, text, int) from public, anon, authenticated;

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', true) on conflict (id) do nothing;

create policy "product images admin write" on storage.objects for insert with check (bucket_id in ('product-images', 'documents') and public.is_admin());
create policy "product images admin update" on storage.objects for update using (bucket_id in ('product-images', 'documents') and public.is_admin());
create policy "product images admin delete" on storage.objects for delete using (bucket_id in ('product-images', 'documents') and public.is_admin());
