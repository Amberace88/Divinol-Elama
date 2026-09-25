-- 0009 — multi-carrier shipping: carriers, rate cards (list / contract prices), shipments, label storage.
-- Rates are what the SHOP pays the carrier (cost). What the CUSTOMER pays is still defined in settings.shipping
-- (place_order is untouched), so the free-shipping threshold keeps working exactly as before.

-- ───────────────────────── carriers ─────────────────────────
create table if not exists public.shipping_carriers (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  name text not null,
  enabled boolean not null default true,
  -- offered to customers as a parcel-locker provider in checkout (needs a pickup-point feed)
  checkout_enabled boolean not null default false,
  -- tracking link, "{code}" is replaced with the tracking number
  tracking_url_template text,
  logo text,
  website text,
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists shipping_carriers_updated on public.shipping_carriers;
create trigger shipping_carriers_updated before update on public.shipping_carriers for each row execute function public.set_updated_at();

-- ───────────────────────── rate cards ─────────────────────────
-- One row = price of ONE parcel (or pallet) of a size / weight class for a carrier service to a country.
-- price_net NULL = no public price found → "jāievada līguma cena" (enter the contract price in the admin).
create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  carrier text not null references public.shipping_carriers(code) on update cascade on delete cascade,
  service_code text not null,
  service_name text not null,
  type text not null check (type in ('locker', 'courier', 'pickup', 'pallet')),
  country text not null check (country in ('LV', 'EE', 'LT')),
  size_code text,
  min_weight_kg numeric(8,3) not null default 0 check (min_weight_kg >= 0),
  max_weight_kg numeric(8,3) not null check (max_weight_kg > 0),
  max_length_cm numeric(6,1),
  max_width_cm numeric(6,1),
  max_height_cm numeric(6,1),
  price_net numeric(10,2) check (price_net is null or price_net >= 0),
  currency text not null default 'EUR',
  transit_days_min int check (transit_days_min is null or transit_days_min >= 0),
  transit_days_max int check (transit_days_max is null or transit_days_max >= 0),
  source_url text,
  source_date date,
  source_note text,
  is_contract boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_rates_uq unique nulls not distinct (carrier, service_code, country, size_code)
);
create index if not exists shipping_rates_lookup_idx on public.shipping_rates (country, type) where active;
drop trigger if exists shipping_rates_updated on public.shipping_rates;
create trigger shipping_rates_updated before update on public.shipping_rates for each row execute function public.set_updated_at();

-- ───────────────────────── shipments ─────────────────────────
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  carrier text not null references public.shipping_carriers(code) on update cascade,
  service_code text,
  service_name text,
  type text check (type in ('locker', 'courier', 'pickup', 'pallet')),
  mode text not null default 'manual' check (mode in ('api', 'manual')),
  status text not null default 'draft'
    check (status in ('draft', 'created', 'label_printed', 'handed_over', 'in_transit', 'delivered', 'returned', 'cancelled')),
  tracking_number text,
  tracking_numbers text[] not null default '{}',
  carrier_ref text,            -- carrier-side id (DPD shipment uuid, Venipak manifest …)
  label_path text,             -- object in the private "shipping-labels" bucket
  label_url text,              -- external label link (manual mode)
  country text check (country is null or country in ('LV', 'EE', 'LT')),
  weight_kg numeric(10,3),
  parcels int not null default 1 check (parcels between 1 and 99),
  dims jsonb not null default '[]'::jsonb,           -- [{ weight_kg, l, w, h, size_code }]
  cost_net numeric(10,2),
  cost_source text check (cost_source is null or cost_source in ('rate', 'contract', 'actual', 'api')),
  customer_paid_net numeric(10,2),
  receiver jsonb not null default '{}'::jsonb,       -- snapshot: name, phone, email, street, city, postal_code, country
  pickup_point jsonb,                                -- snapshot of the locker / parcel shop
  notes text,
  events jsonb not null default '[]'::jsonb,         -- [{ at, status, text, location, source }]
  tracking_status text,
  last_tracked_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipments_order_idx on public.shipments (order_id);
create index if not exists shipments_status_idx on public.shipments (status);
create index if not exists shipments_created_idx on public.shipments (created_at desc);
create index if not exists shipments_tracking_idx on public.shipments (tracking_number);
drop trigger if exists shipments_updated on public.shipments;
create trigger shipments_updated before update on public.shipments for each row execute function public.set_updated_at();

-- carrier-aware tracking link for the customer's account page (customers cannot read `shipments`)
alter table public.orders add column if not exists tracking_carrier text;
alter table public.orders add column if not exists tracking_url text;

-- ───────────────────────── RLS ─────────────────────────
alter table public.shipping_carriers enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.shipments enable row level security;

-- carriers hold no secrets (credentials live in env vars) — checkout reads which locker providers are enabled
drop policy if exists "carriers public read" on public.shipping_carriers;
create policy "carriers public read" on public.shipping_carriers for select using (enabled or public.is_admin());
drop policy if exists "carriers admin write" on public.shipping_carriers;
create policy "carriers admin write" on public.shipping_carriers for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rates admin" on public.shipping_rates;
create policy "rates admin" on public.shipping_rates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "shipments admin" on public.shipments;
create policy "shipments admin" on public.shipments for all using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── label storage (private) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipping-labels', 'shipping-labels', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "shipping labels admin read" on storage.objects;
create policy "shipping labels admin read" on storage.objects for select using (bucket_id = 'shipping-labels' and public.is_admin());
drop policy if exists "shipping labels admin insert" on storage.objects;
create policy "shipping labels admin insert" on storage.objects for insert with check (bucket_id = 'shipping-labels' and public.is_admin());
drop policy if exists "shipping labels admin update" on storage.objects;
create policy "shipping labels admin update" on storage.objects for update using (bucket_id = 'shipping-labels' and public.is_admin());
drop policy if exists "shipping labels admin delete" on storage.objects;
create policy "shipping labels admin delete" on storage.objects for delete using (bucket_id = 'shipping-labels' and public.is_admin());

-- ───────────────────────── counters for carrier-side numbering (Venipak pack / manifest numbers) ─────────────────────────
create or replace function public.shipping_next_serial(p_key text) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_key !~ '^[a-z0-9_-]{1,60}$' then raise exception 'invalid_key'; end if;
  insert into public.counters(key, value) values ('ship-' || p_key, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value into v;
  return v;
end $$;
revoke execute on function public.shipping_next_serial(text) from public, anon;
grant execute on function public.shipping_next_serial(text) to authenticated;

-- ───────────────────────── seed: carriers ─────────────────────────
insert into public.shipping_carriers (code, name, enabled, checkout_enabled, tracking_url_template, website, sort, notes) values
  ('omniva', 'Omniva', true, true, 'https://www.omniva.lv/en/track-and-receive-parcels/?barcode={code}', 'https://www.omniva.lv', 10,
   'API: OMX (OMNIVA_USERNAME, OMNIVA_PASSWORD, OMNIVA_CUSTOMER_CODE). Pakomātu saraksts — publisks.'),
  ('dpd', 'DPD Latvija', true, false, 'https://www.dpdgroup.com/lv/mydpd/my-parcels/track?lang=lv&parcelNumber={code}', 'https://www.dpd.com/lv/lv/', 20,
   'API: DPD Baltic eserviss (DPD_API_TOKEN). Pickup punktu saraksts pieejams tikai ar API atslēgu.'),
  ('venipak', 'Venipak', true, false, 'https://venipak.com/lv/en/tracking/?code={code}', 'https://venipak.com/lv/', 30,
   'API: VENIPAK_USERNAME, VENIPAK_PASSWORD, VENIPAK_API_ID. Pakomātu saraksts un izsekošana — publiski.'),
  ('smartposti', 'SmartPosti', true, false, 'https://www.smartposti.lv/?tracking={code}', 'https://www.smartposti.lv', 40,
   'Manuālais režīms (API tikai ar līgumu). Pakomātu saraksts — publisks.'),
  ('unisend', 'Unisend', true, false, 'https://unisend.lv/?parcel={code}', 'https://unisend.lv', 50,
   'Manuālais režīms.'),
  ('latvijas_pasts', 'Latvijas Pasts', true, false, 'https://pasts.lv/lv/kategorija/sutijumu_sekosana/?id={code}', 'https://pasts.lv', 60,
   'Manuālais režīms.'),
  ('dhl_express', 'DHL Express', false, false, 'https://www.dhl.com/lv-en/home/tracking/tracking-express.html?submit=1&tracking-id={code}', 'https://www.dhl.com/lv-en/', 70,
   'Manuālais režīms, tikai ar līgumu.'),
  ('freight', 'Kravas pārvadātājs (paletes)', true, false, null, null, 80,
   'Paletes / mucas 60–208 L. Cena pēc pārvadātāja piedāvājuma.')
on conflict (code) do nothing;

-- ───────────────────────── seed: rates (researched 2026-09-25) ─────────────────────────
-- DPD: public prices for customers without a contract (sending via eserviss.dpd.lv, drop-off at a Pickup point),
--      published INCL. 21% VAT, last updated 2025-04-01 → stored net = gross / 1.21.
--      Sizes: XS 8×18×61, S 8×43×61, M 17×43×61, L 36×43×61 cm, up to 31.5 kg.
-- SmartPosti: public LV prices incl. 21% VAT, valid from 15.07.2026 → net = gross / 1.21.
--      Sizes: XS 5×34×42 (≤5 kg), S 12×34×42, M 20×34×42, L 34×36×42, XL 60×36×60 cm, ≤35 kg.
-- Latvijas Pasts: e-commerce "send in parcel locker" price list, published WITHOUT VAT.
-- Omniva / Venipak / Unisend / DHL / pallets: no public business price list available → price_net NULL (contract price).
insert into public.shipping_rates
  (carrier, service_code, service_name, type, country, size_code, min_weight_kg, max_weight_kg, max_length_cm, max_width_cm, max_height_cm,
   price_net, transit_days_min, transit_days_max, source_url, source_date, source_note, is_contract, sort)
values
  -- DPD Pickup → Pickup
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LV','XS',0,31.5,61,18,8, 2.05,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Publiska cena bez līguma 2,48 € ar PVN (eserviss); piegādes laiks aptuvens',false,1),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LV','S',0,31.5,61,43,8, 2.30,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Publiska cena bez līguma 2,78 € ar PVN',false,2),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LV','M',0,31.5,61,43,17, 3.21,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Publiska cena bez līguma 3,88 € ar PVN',false,3),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LV','L',0,31.5,61,43,36, 4.03,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Publiska cena bez līguma 4,88 € ar PVN',false,4),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','EE','XS',0,31.5,61,18,8, 4.95,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 5,99 € ar PVN',false,1),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','EE','S',0,31.5,61,43,8, 5.78,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 6,99 € ar PVN',false,2),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','EE','M',0,31.5,61,43,17, 6.60,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 7,99 € ar PVN',false,3),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','EE','L',0,31.5,61,43,36, 7.43,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 8,99 € ar PVN',false,4),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LT','XS',0,31.5,61,18,8, 4.95,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 5,99 € ar PVN',false,1),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LT','S',0,31.5,61,43,8, 5.78,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 6,99 € ar PVN',false,2),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LT','M',0,31.5,61,43,17, 6.60,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 7,99 € ar PVN',false,3),
  ('dpd','pickup','DPD Pickup (pakomāts/Pickup punkts)','locker','LT','L',0,31.5,61,43,36, 7.43,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 8,99 € ar PVN',false,4),
  -- DPD Pickup → address (courier delivery)
  ('dpd','courier','DPD kurjers uz adresi','courier','LV','XS',0,31.5,61,18,8, 4.78,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Pickup punkts → adrese: 5,78 € ar PVN',false,11),
  ('dpd','courier','DPD kurjers uz adresi','courier','LV','S',0,31.5,61,43,8, 6.35,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','7,68 € ar PVN',false,12),
  ('dpd','courier','DPD kurjers uz adresi','courier','LV','M',0,31.5,61,43,17, 7.17,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','8,68 € ar PVN',false,13),
  ('dpd','courier','DPD kurjers uz adresi','courier','LV','L',0,31.5,61,43,36, 8.00,1,2,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','9,68 € ar PVN',false,14),
  ('dpd','courier','DPD kurjers uz adresi','courier','EE','XS',0,31.5,61,18,8, 6.60,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 7,99 € ar PVN',false,11),
  ('dpd','courier','DPD kurjers uz adresi','courier','EE','S',0,31.5,61,43,8, 8.26,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 9,99 € ar PVN',false,12),
  ('dpd','courier','DPD kurjers uz adresi','courier','EE','M',0,31.5,61,43,17, 9.91,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 11,99 € ar PVN',false,13),
  ('dpd','courier','DPD kurjers uz adresi','courier','EE','L',0,31.5,61,43,36, 10.42,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 12,61 € ar PVN',false,14),
  ('dpd','courier','DPD kurjers uz adresi','courier','LT','XS',0,31.5,61,18,8, 6.60,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 7,99 € ar PVN',false,11),
  ('dpd','courier','DPD kurjers uz adresi','courier','LT','S',0,31.5,61,43,8, 8.26,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 9,99 € ar PVN',false,12),
  ('dpd','courier','DPD kurjers uz adresi','courier','LT','M',0,31.5,61,43,17, 9.91,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 11,99 € ar PVN',false,13),
  ('dpd','courier','DPD kurjers uz adresi','courier','LT','L',0,31.5,61,43,36, 10.42,2,3,'https://www.dpd.com/lv/lv/sanemsana/pickup-tikls/cenas/','2025-04-01','Baltija: 12,61 € ar PVN',false,14),

  -- SmartPosti lockers
  ('smartposti','locker','SmartPosti pakomāts','locker','LV','XS',0,5,42,34,5, 2.07,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','2,50 € ar PVN',false,1),
  ('smartposti','locker','SmartPosti pakomāts','locker','LV','S',0,35,42,34,12, 2.40,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','2,90 € ar PVN',false,2),
  ('smartposti','locker','SmartPosti pakomāts','locker','LV','M',0,35,42,34,20, 3.22,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','3,90 € ar PVN',false,3),
  ('smartposti','locker','SmartPosti pakomāts','locker','LV','L',0,35,42,36,34, 4.05,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','4,90 € ar PVN',false,4),
  ('smartposti','locker','SmartPosti pakomāts','locker','LV','XL',0,35,60,60,36, 4.79,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','5,79 € ar PVN',false,5),
  ('smartposti','locker','SmartPosti pakomāts','locker','EE','XS',0,5,42,34,5, 3.96,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','4,79 € ar PVN',false,1),
  ('smartposti','locker','SmartPosti pakomāts','locker','EE','S',0,35,42,34,12, 4.45,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','5,39 € ar PVN',false,2),
  ('smartposti','locker','SmartPosti pakomāts','locker','EE','M',0,35,42,34,20, 5.53,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','6,69 € ar PVN',false,3),
  ('smartposti','locker','SmartPosti pakomāts','locker','EE','L',0,35,42,36,34, 6.27,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','7,59 € ar PVN',false,4),
  ('smartposti','locker','SmartPosti pakomāts','locker','EE','XL',0,35,60,60,36, 8.01,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','9,69 € ar PVN',false,5),
  ('smartposti','locker','SmartPosti pakomāts','locker','LT','XS',0,5,42,34,5, 3.96,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','4,79 € ar PVN',false,1),
  ('smartposti','locker','SmartPosti pakomāts','locker','LT','S',0,35,42,34,12, 4.45,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','5,39 € ar PVN',false,2),
  ('smartposti','locker','SmartPosti pakomāts','locker','LT','M',0,35,42,34,20, 5.53,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','6,69 € ar PVN',false,3),
  ('smartposti','locker','SmartPosti pakomāts','locker','LT','L',0,35,42,36,34, 6.27,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','7,59 € ar PVN',false,4),
  ('smartposti','locker','SmartPosti pakomāts','locker','LT','XL',0,35,60,60,36, 8.01,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','9,69 € ar PVN',false,5),
  -- SmartPosti courier
  ('smartposti','courier','SmartPosti kurjers','courier','LV','XS',0,5,42,34,5, 3.30,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','3,99 € ar PVN',false,11),
  ('smartposti','courier','SmartPosti kurjers','courier','LV','S',0,35,42,34,12, 4.29,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','5,19 € ar PVN',false,12),
  ('smartposti','courier','SmartPosti kurjers','courier','LV','M',0,35,42,34,20, 5.78,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','6,99 € ar PVN',false,13),
  ('smartposti','courier','SmartPosti kurjers','courier','LV','L',0,35,42,36,34, 7.26,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','8,79 € ar PVN',false,14),
  ('smartposti','courier','SmartPosti kurjers','courier','LV','XL',0,35,60,60,36, 12.31,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','14,89 € ar PVN',false,15),
  ('smartposti','courier','SmartPosti kurjers','courier','EE','XS',0,5,42,34,5, 5.70,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','6,90 € ar PVN',false,11),
  ('smartposti','courier','SmartPosti kurjers','courier','EE','S',0,35,42,34,12, 6.53,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','7,90 € ar PVN',false,12),
  ('smartposti','courier','SmartPosti kurjers','courier','EE','M',0,35,42,34,20, 7.36,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','8,90 € ar PVN',false,13),
  ('smartposti','courier','SmartPosti kurjers','courier','EE','L',0,35,42,36,34, 8.18,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','9,90 € ar PVN',false,14),
  ('smartposti','courier','SmartPosti kurjers','courier','EE','XL',0,35,60,60,36, 14.04,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','16,99 € ar PVN',false,15),
  ('smartposti','courier','SmartPosti kurjers','courier','LT','XS',0,5,42,34,5, 4.79,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','5,79 € ar PVN',false,11),
  ('smartposti','courier','SmartPosti kurjers','courier','LT','S',0,35,42,34,12, 5.78,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','6,99 € ar PVN',false,12),
  ('smartposti','courier','SmartPosti kurjers','courier','LT','M',0,35,42,34,20, 6.52,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','7,89 € ar PVN',false,13),
  ('smartposti','courier','SmartPosti kurjers','courier','LT','L',0,35,42,36,34, 7.26,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','8,79 € ar PVN',false,14),
  ('smartposti','courier','SmartPosti kurjers','courier','LT','XL',0,35,60,60,36, 14.04,null,null,'https://www.smartposti.lv/paku-nosutisana/sutijumu-cenas','2026-07-15','16,99 € ar PVN',false,15),

  -- Latvijas Pasts (prices without VAT). Parcel locker cell up to 38×38×58 cm, 31.5 kg.
  ('latvijas_pasts','locker','Latvijas Pasts pakomāts','locker','LV',null,0,31.5,58,38,38, 2.50,null,null,'https://www.pasts.lv/en/useful/sending-items/send-in-parcel-locker',null,'Cenrādis e-komercijai, bez PVN, visi izmēri; apjoma atlaides pēc līguma',false,1),
  ('latvijas_pasts','locker','Latvijas Pasts / Unisend pakomāts','locker','LT',null,0,31.5,58,38,38, 3.05,null,null,'https://www.pasts.lv/en/useful/sending-items/send-in-parcel-locker',null,'Baltijas sūtījums uz pakomātu (sadarbībā ar Unisend), bez PVN',false,1),
  ('latvijas_pasts','locker','Latvijas Pasts / Unisend pakomāts','locker','EE',null,0,31.5,58,38,38, 3.05,null,null,'https://www.pasts.lv/en/useful/sending-items/send-in-parcel-locker',null,'Baltijas sūtījums uz pakomātu (sadarbībā ar Unisend), bez PVN — pārbaudiet pieejamību Igaunijā',false,1),
  ('latvijas_pasts','courier','Latvijas Pasts kurjers','courier','LV','S',0,31.5,58,38,12, 5.51,null,null,'https://www.pasts.lv/en/useful/sending-items/send-in-parcel-locker',null,'Kurjera piegāde S, bez PVN; izmēra klase pieņemta pēc pakomāta šūnas',false,12),
  ('latvijas_pasts','courier','Latvijas Pasts kurjers','courier','LV','M',0,31.5,58,38,25, 7.50,null,null,'https://www.pasts.lv/en/useful/sending-items/send-in-parcel-locker',null,'Kurjera piegāde M, bez PVN',false,13),
  ('latvijas_pasts','courier','Latvijas Pasts kurjers','courier','LV','L',0,31.5,58,38,38, 9.50,null,null,'https://www.pasts.lv/en/useful/sending-items/send-in-parcel-locker',null,'Kurjera piegāde L, bez PVN',false,14),

  -- Omniva: no public business price list → contract prices. Sizes: S 9×38×64, M 19×38×64, L 39×38×64 cm, ≤30 kg.
  ('omniva','parcel_machine','Omniva pakomāts','locker','LV','S',0,30,64,38,9, null,1,2,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena (publisks biznesa cenrādis nav pieejams)',true,1),
  ('omniva','parcel_machine','Omniva pakomāts','locker','LV','M',0,30,64,38,19, null,1,2,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,2),
  ('omniva','parcel_machine','Omniva pakomāts','locker','LV','L',0,30,64,38,39, null,1,2,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,3),
  ('omniva','parcel_machine','Omniva pakomāts','locker','EE','S',0,30,64,38,9, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,1),
  ('omniva','parcel_machine','Omniva pakomāts','locker','EE','M',0,30,64,38,19, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,2),
  ('omniva','parcel_machine','Omniva pakomāts','locker','EE','L',0,30,64,38,39, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,3),
  ('omniva','parcel_machine','Omniva pakomāts','locker','LT','S',0,30,64,38,9, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,1),
  ('omniva','parcel_machine','Omniva pakomāts','locker','LT','M',0,30,64,38,19, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,2),
  ('omniva','parcel_machine','Omniva pakomāts','locker','LT','L',0,30,64,38,39, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/sutisana-ar-pakomatu/?mode=popup','2026-09-25','jāievada līguma cena',true,3),
  -- Omniva courier: S/M/L as above, XL longest side up to 150 cm, ≤30 kg
  ('omniva','courier','Omniva kurjers','courier','LV','L',0,30,64,38,39, null,1,2,'https://www.omniva.lv/nosutit-sutijumu/kurjers/?mode=popup','2026-09-25','jāievada līguma cena',true,11),
  ('omniva','courier','Omniva kurjers','courier','LV','XL',0,30,150,60,60, null,1,2,'https://www.omniva.lv/nosutit-sutijumu/kurjers/?mode=popup','2026-09-25','jāievada līguma cena; XL — garākā mala līdz 1,5 m (pārējie izmēri pieņemti)',true,12),
  ('omniva','courier','Omniva kurjers','courier','EE','L',0,30,64,38,39, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/kurjers/?mode=popup','2026-09-25','jāievada līguma cena',true,11),
  ('omniva','courier','Omniva kurjers','courier','EE','XL',0,30,150,60,60, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/kurjers/?mode=popup','2026-09-25','jāievada līguma cena',true,12),
  ('omniva','courier','Omniva kurjers','courier','LT','L',0,30,64,38,39, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/kurjers/?mode=popup','2026-09-25','jāievada līguma cena',true,11),
  ('omniva','courier','Omniva kurjers','courier','LT','XL',0,30,150,60,60, null,2,3,'https://www.omniva.lv/nosutit-sutijumu/kurjers/?mode=popup','2026-09-25','jāievada līguma cena',true,12),

  -- Venipak: no public price → contract. Locker XS 61×16.7×9.5, S 61×39.5×9.5, M 61×39.5×20, L 61×39.5×41 cm; 30 kg (LT 25 kg).
  ('venipak','locker','Venipak pakomāts','locker','LV','S',0,30,61,39.5,9.5, null,1,1,'https://venipak.com/lv/en/help/lockers/lockers-sizes/','2026-09-25','jāievada līguma cena',true,1),
  ('venipak','locker','Venipak pakomāts','locker','LV','M',0,30,61,39.5,20, null,1,1,'https://venipak.com/lv/en/help/lockers/lockers-sizes/','2026-09-25','jāievada līguma cena',true,2),
  ('venipak','locker','Venipak pakomāts','locker','LV','L',0,30,61,39.5,41, null,1,1,'https://venipak.com/lv/en/help/lockers/lockers-sizes/','2026-09-25','jāievada līguma cena',true,3),
  ('venipak','locker','Venipak pakomāts','locker','EE','L',0,30,61,39.5,41, null,1,2,'https://venipak.com/lv/en/help/lockers/lockers-sizes/','2026-09-25','jāievada līguma cena',true,3),
  ('venipak','locker','Venipak pakomāts','locker','LT','L',0,25,61,39.5,41, null,1,2,'https://venipak.com/lv/en/help/lockers/lockers-sizes/','2026-09-25','jāievada līguma cena; LT pakomātos maks. 25 kg',true,3),
  ('venipak','courier','Venipak kurjers (nākamā darba diena)','courier','LV',null,0,30,120,60,60, null,1,1,'https://venipak.com/lv/en/business-customers/parcel-delivery/','2026-09-25','jāievada līguma cena; izmēru/svara limits pēc līguma',true,11),
  ('venipak','courier','Venipak kurjers (nākamā darba diena)','courier','EE',null,0,30,120,60,60, null,1,2,'https://venipak.com/lv/en/business-customers/parcel-delivery/','2026-09-25','jāievada līguma cena',true,11),
  ('venipak','courier','Venipak kurjers (nākamā darba diena)','courier','LT',null,0,30,120,60,60, null,1,2,'https://venipak.com/lv/en/business-customers/parcel-delivery/','2026-09-25','jāievada līguma cena',true,11),

  -- Unisend lockers (sizes XS 61×18.5×8, S 61×31×8, M 61×35×17.5, L 61×35×36.5, XL 61×35×74.5 cm); weight limit to be confirmed
  ('unisend','locker','Unisend pakomāts','locker','LV','L',0,30,61,35,36.5, null,null,null,'https://unisend.lv','2026-09-25','jāievada līguma cena; svara limits jāprecizē',true,3),
  ('unisend','locker','Unisend pakomāts','locker','LT','L',0,30,61,35,36.5, null,null,null,'https://unisend.lv','2026-09-25','jāievada līguma cena',true,3),
  ('unisend','locker','Unisend pakomāts','locker','EE','L',0,30,61,35,36.5, null,null,null,'https://unisend.lv','2026-09-25','jāievada līguma cena',true,3),

  -- Pallet freight for drums 60–208 L (EUR pallet 120×80 cm)
  ('freight','pallet','EUR palete (kravas pārvadājums)','pallet','LV','EUR',0,800,120,80,160, null,1,2,null,'2026-09-25','jāievada pārvadātāja cena (DPD / Venipak / vietējais pārvadātājs)',true,1),
  ('freight','pallet','EUR palete (kravas pārvadājums)','pallet','EE','EUR',0,800,120,80,160, null,2,3,null,'2026-09-25','jāievada pārvadātāja cena',true,1),
  ('freight','pallet','EUR palete (kravas pārvadājums)','pallet','LT','EUR',0,800,120,80,160, null,2,3,null,'2026-09-25','jāievada pārvadātāja cena',true,1),

  -- DHL Express (disabled carrier; contract only)
  ('dhl_express','express','DHL Express Domestic/Economy','courier','LV',null,0,70,120,80,80, null,1,1,'https://www.dhl.com/lv-en/home/express.html','2026-09-25','jāievada līguma cena',true,1)
on conflict on constraint shipping_rates_uq do nothing;
