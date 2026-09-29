-- 0012 — Raben transport orders (pallet / groupage freight booked in myRaben → myOrder).
-- Elama books Raben for inbound deliveries from Zeller+Gmelin (DE) to the Riga warehouse and for pallet deliveries to
-- customers. Raben has no public API, so the admin prepares the order here (address book, cargo, dates) and transfers it
-- to myRaben with per-field copy buttons; the Raben shipment number is then stored for tracking.

-- ───────────────────────── address book ─────────────────────────
create table if not exists public.raben_addresses (
  id uuid primary key default gen_random_uuid(),
  label text,                                   -- short name shown in pickers, e.g. "BTG noliktava"
  name text not null,
  street text not null,
  postal_code text not null,
  city text not null,
  country text not null default 'LV' check (country ~ '^[A-Z]{2}$'),
  vat_no text,
  contact_name text,
  phone text,
  email text,
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists raben_addresses_updated on public.raben_addresses;
create trigger raben_addresses_updated before update on public.raben_addresses for each row execute function public.set_updated_at();

-- ───────────────────────── transport orders ─────────────────────────
create sequence if not exists public.raben_order_seq;

create table if not exists public.raben_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('RB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.raben_order_seq')::text, 4, '0')),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'submitted', 'in_transit', 'delivered', 'cancelled')),
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound', 'return', 'other')),
  order_id uuid references public.orders(id) on delete set null,
  -- address snapshots: { name, street, postal_code, city, country, vat_no, contact_name, phone, email }
  shipper jsonb not null default '{}'::jsonb,
  loading jsonb not null default '{}'::jsonb,
  consignee jsonb not null default '{}'::jsonb,
  unloading jsonb not null default '{}'::jsonb,
  goods_character text not null default 'chemical' check (goods_character in ('chemical', 'neutral', 'food', 'adr')),
  limited_quantity boolean not null default false,
  -- [{ type, qty, weight_kg, length_cm, width_cm, height_cm, stackable, description }]
  units jsonb not null default '[]'::jsonb,
  loading_date date,
  loading_from time,
  loading_to time,
  delivery_date date,
  reference text,                               -- "Klienta pasūtījuma Nr."
  cargo_value numeric(12,2) check (cargo_value is null or cargo_value >= 0),
  notes text,                                   -- instructions for the driver / Raben
  raben_number text,                            -- Raben shipment number from myRaben
  cost_net numeric(10,2) check (cost_net is null or cost_net >= 0),
  submitted_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists raben_orders_created_idx on public.raben_orders (created_at desc);
create index if not exists raben_orders_status_idx on public.raben_orders (status);
create index if not exists raben_orders_order_idx on public.raben_orders (order_id);
drop trigger if exists raben_orders_updated on public.raben_orders;
create trigger raben_orders_updated before update on public.raben_orders for each row execute function public.set_updated_at();

-- ───────────────────────── RLS (admins only) ─────────────────────────
alter table public.raben_addresses enable row level security;
alter table public.raben_orders enable row level security;
drop policy if exists "raben addresses admin" on public.raben_addresses;
create policy "raben addresses admin" on public.raben_addresses for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "raben orders admin" on public.raben_orders;
create policy "raben orders admin" on public.raben_orders for all using (public.is_admin()) with check (public.is_admin());
grant usage on sequence public.raben_order_seq to authenticated;

-- ───────────────────────── seed: the three addresses already saved in Elama's myRaben address book ─────────────────────────
insert into public.raben_addresses (label, name, street, postal_code, city, country, vat_no, contact_name, phone, email, sort)
select * from (values
  ('BTG noliktava', 'BTG noliktava', 'Ventspils iela 51', '1002', 'Rīga', 'LV', 'LV40103512445', 'Arnis', '+371 29209915', 'elama@elama.lv', 1),
  ('Zeller+Gmelin (DE)', 'Zeller + Gmelin GmbH & Co. KG', 'Schloßstraße 20', '73054', 'Eislingen/Fils', 'DE', null, 'Hesse', '+49 7161 802-252', 'm.hesse@zeller-gmelin.de', 2),
  ('SIA ELAMA (Lielvārde)', 'SIA ELAMA', 'Jumpravas pag., Priežkalni 2', '5022', 'Lielvārde', 'LV', 'LV40103512445', 'Arnis', '+371 29209915', 'elama@elama.lv', 3)
) as v(label, name, street, postal_code, city, country, vat_no, contact_name, phone, email, sort)
where not exists (select 1 from public.raben_addresses);
