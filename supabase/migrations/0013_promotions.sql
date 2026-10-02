-- Product promotions (sale / clearance / special offer with % discount and optional dates) and marketing badges.
-- The storefront shows the discounted price; place_order() charges it (B2B: the better of own discount and the promotion).

alter table public.products
  add column if not exists badges text[] not null default '{}',
  add column if not exists promo_type text,
  add column if not exists promo_percent numeric(5,2),
  add column if not exists promo_starts_at timestamptz,
  add column if not exists promo_ends_at timestamptz;

alter table public.products drop constraint if exists products_badges_valid;
alter table public.products add constraint products_badges_valid
  check (badges <@ array['new', 'bestseller', 'recommended', 'limited', 'seasonal', 'bio', 'pro']::text[]);

alter table public.products drop constraint if exists products_promo_valid;
alter table public.products add constraint products_promo_valid check (
  (promo_type is null or promo_type in ('sale', 'clearance', 'special'))
  and (promo_percent is null or (promo_percent > 0 and promo_percent <= 90))
  and (promo_type not in ('sale', 'clearance') or promo_percent is not null)
  and (promo_starts_at is null or promo_ends_at is null or promo_ends_at > promo_starts_at)
);

create index if not exists products_promo_idx on public.products (promo_type) where promo_type is not null;

-- % discount of a promotion that is running right now (0 otherwise).
create or replace function public.promo_active_percent(p_type text, p_percent numeric, p_start timestamptz, p_end timestamptz)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when p_type in ('sale', 'clearance', 'special')
     and coalesce(p_percent, 0) > 0
     and (p_start is null or p_start <= now())
     and (p_end is null or p_end > now())
    then least(p_percent, 90)
    else 0
  end
$$;

grant execute on function public.promo_active_percent(text, numeric, timestamptz, timestamptz) to anon, authenticated;

-- place_order(): unit price = list price − max(B2B discount, running promotion).
do $$
declare
  d text := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);
begin
  if position('promo_active_percent' in d) > 0 then
    return; -- already patched
  end if;
  d := replace(d,
    'pv.price_net, pv.image, pv.stock, p.i18n, p.images',
    'pv.price_net, pv.image, pv.stock, p.i18n, p.images, p.promo_type, p.promo_percent, p.promo_starts_at, p.promo_ends_at');
  d := replace(d,
    'v_unit := round(v_var.price_net * (1 - v_discount / 100), 4);',
    'v_unit := round(v_var.price_net * (1 - greatest(v_discount, public.promo_active_percent(v_var.promo_type, v_var.promo_percent, v_var.promo_starts_at, v_var.promo_ends_at)) / 100), 4);');
  if position('promo_active_percent' in d) = 0 or position('p.promo_ends_at' in d) = 0 then
    raise exception 'place_order patch did not apply';
  end if;
  execute d;
end $$;
