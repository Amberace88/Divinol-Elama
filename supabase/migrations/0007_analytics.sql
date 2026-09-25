-- Divinol: privacy-friendly, cookieless first-party website analytics.
-- Raw events are written ONLY through public.track_event() (called by /api/track).
-- No IP addresses or raw user agents are ever stored: visitor_id is a daily-rotating
-- salted hash computed in the Next.js route handler.

-- ───────────────────────── table ─────────────────────────
create table if not exists public.analytics_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  type text not null,
  path text,
  locale text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  country text,            -- ISO 3166-1 alpha-2
  city text,
  device text check (device in ('mobile', 'tablet', 'desktop')),
  browser text,
  os text,
  visitor_id text not null, -- daily-rotating hash, never an IP
  session_id text,
  product_slug text,
  props jsonb
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
create index if not exists analytics_events_type_created_idx on public.analytics_events (type, created_at);
create index if not exists analytics_events_path_idx on public.analytics_events (path);
create index if not exists analytics_events_visitor_created_idx on public.analytics_events (visitor_id, created_at);

alter table public.analytics_events enable row level security;
drop policy if exists "analytics admin read" on public.analytics_events;
create policy "analytics admin read" on public.analytics_events for select using (public.is_admin());
revoke insert, update, delete, truncate on public.analytics_events from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated;

-- ───────────────────────── retention ─────────────────────────
create or replace function public.analytics_purge() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.analytics_events where created_at < now() - interval '13 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.analytics_purge() from public, anon, authenticated;

-- ───────────────────────── collection ─────────────────────────
create or replace function public.track_event(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_type text := lower(left(coalesce(p->>'type', ''), 40));
  v_visitor text := left(coalesce(p->>'visitor_id', ''), 64);
  v_session text := nullif(left(coalesce(p->>'session_id', ''), 64), '');
  v_path text := nullif(left(coalesce(p->>'path', ''), 300), '');
  v_country text := upper(nullif(p->>'country', ''));
  v_device text := nullif(p->>'device', '');
  v_props jsonb := p->'props';
  v_recent int;
begin
  if v_type not in (
    'pageview', 'add_to_cart', 'begin_checkout', 'purchase', 'catalog_download', 'search',
    'contact_submit', 'inquiry_submit', 'quote_request', 'newsletter_signup', 'oil_finder',
    'calculator_use', 'outbound_click', 'phone_click', 'email_click'
  ) then
    return;
  end if;
  if v_visitor !~ '^[a-f0-9]{16,64}$' then return; end if;
  if v_session is not null and v_session !~ '^[A-Za-z0-9_-]{6,64}$' then v_session := null; end if;
  if v_path is not null and left(v_path, 1) <> '/' then v_path := null; end if;
  if v_type = 'pageview' and v_path is null then return; end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  if v_device is not null and v_device not in ('mobile', 'tablet', 'desktop') then v_device := null; end if;
  if v_props is not null and (jsonb_typeof(v_props) <> 'object' or length(v_props::text) > 2000) then v_props := null; end if;

  -- Flood guard: at most 120 events per visitor per minute.
  select count(*) into v_recent from public.analytics_events
   where visitor_id = v_visitor and created_at > now() - interval '1 minute';
  if v_recent >= 120 then return; end if;

  insert into public.analytics_events (
    type, path, locale, referrer_host, utm_source, utm_medium, utm_campaign, country, city,
    device, browser, os, visitor_id, session_id, product_slug, props
  ) values (
    v_type,
    v_path,
    nullif(left(lower(coalesce(p->>'locale', '')), 5), ''),
    nullif(left(lower(coalesce(p->>'referrer_host', '')), 120), ''),
    nullif(left(coalesce(p->>'utm_source', ''), 100), ''),
    nullif(left(coalesce(p->>'utm_medium', ''), 100), ''),
    nullif(left(coalesce(p->>'utm_campaign', ''), 150), ''),
    v_country,
    nullif(left(coalesce(p->>'city', ''), 80), ''),
    v_device,
    nullif(left(coalesce(p->>'browser', ''), 40), ''),
    nullif(left(coalesce(p->>'os', ''), 40), ''),
    v_visitor,
    v_session,
    nullif(left(coalesce(p->>'product_slug', ''), 160), ''),
    v_props
  );

  -- Opportunistic retention when pg_cron is not available (~1 in 2000 events).
  if random() < 0.0005 then
    perform public.analytics_purge();
  end if;
end $$;
revoke execute on function public.track_event(jsonb) from public;
grant execute on function public.track_event(jsonb) to anon, authenticated;

-- ───────────────────────── reporting ─────────────────────────
-- Internal helper: headline totals for one window (no auth check; not executable by clients).
create or replace function public.analytics_totals(p_from timestamptz, p_to timestamptz) returns jsonb
language sql stable set search_path = public as $$
  with ev as (
    select coalesce(session_id, visitor_id) sid, visitor_id, type, created_at
      from public.analytics_events where created_at >= p_from and created_at < p_to
  ),
  s as (
    select sid, count(*) filter (where type = 'pageview') pv, min(created_at) f, max(created_at) l
      from ev group by sid
  )
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from ev),
    'pageviews', (select count(*) from ev where type = 'pageview'),
    'sessions', (select count(*) from s where pv > 0),
    'bounces', (select count(*) from s where pv = 1),
    'avg_duration', coalesce((select round(avg(extract(epoch from (l - f))))::int from s where pv > 0), 0),
    'orders', (select count(*) from public.orders where created_at >= p_from and created_at < p_to and status <> 'cancelled'),
    'revenue', coalesce((select sum(total_gross) from public.orders where created_at >= p_from and created_at < p_to and status <> 'cancelled'), 0)
  );
$$;
revoke execute on function public.analytics_totals(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.admin_traffic(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := least(p_from, p_to);
  v_to timestamptz := greatest(p_from, p_to);
  v_len interval;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_to - v_from > interval '400 days' then v_from := v_to - interval '400 days'; end if;
  v_len := v_to - v_from;

  with ev as (
    select e.*, coalesce(e.session_id, e.visitor_id) sid
      from public.analytics_events e where e.created_at >= v_from and e.created_at < v_to
  ),
  pv as (select * from ev where type = 'pageview'),
  ent as (
    select distinct on (sid) sid, visitor_id, path, referrer_host, utm_source, utm_medium, utm_campaign
      from pv order by sid, created_at
  ),
  live as (
    select visitor_id, path, created_at from public.analytics_events
     where created_at > now() - interval '5 minutes'
  )
  select jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'totals', public.analytics_totals(v_from, v_to),
    'previous', public.analytics_totals(v_from - v_len, v_from),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'visitors', coalesce(x.visitors, 0), 'pageviews', coalesce(x.pageviews, 0), 'sessions', coalesce(x.sessions, 0)) order by d)
        from generate_series(date_trunc('day', v_from), date_trunc('day', v_to - interval '1 microsecond'), interval '1 day') d
        left join (
          select date_trunc('day', created_at) dd, count(distinct visitor_id) visitors,
                 count(*) filter (where type = 'pageview') pageviews,
                 count(distinct sid) filter (where type = 'pageview') sessions
            from ev group by 1
        ) x on x.dd = d
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(t) from (
        select p.path, count(*) pageviews, count(distinct p.visitor_id) visitors, coalesce(max(en.n), 0) entries
          from pv p left join (select path, count(*) n from ent group by path) en on en.path = p.path
         group by p.path order by count(*) desc, p.path limit 15) t
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(t) from (
        select product_slug slug,
               count(*) filter (where type = 'pageview') views,
               count(distinct visitor_id) filter (where type = 'pageview') visitors,
               count(*) filter (where type = 'add_to_cart') add_to_cart
          from ev where product_slug is not null
         group by product_slug
         order by count(*) filter (where type = 'pageview') desc, count(*) filter (where type = 'add_to_cart') desc
         limit 12) t
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(t) from (
        select referrer_host source, count(*) sessions, count(distinct visitor_id) visitors
          from ent group by referrer_host order by count(*) desc limit 12) t
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(t) from (
        select utm_source source, utm_medium medium, utm_campaign campaign, count(*) sessions, count(distinct visitor_id) visitors
          from ent where coalesce(utm_source, utm_medium, utm_campaign) is not null
         group by 1, 2, 3 order by count(*) desc limit 12) t
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(t) from (
        select country, count(distinct visitor_id) visitors, count(*) pageviews
          from pv group by country order by count(distinct visitor_id) desc limit 15) t
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(t) from (
        select city, country, count(distinct visitor_id) visitors
          from pv where city is not null group by city, country order by count(distinct visitor_id) desc limit 10) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(t) from (
        select device name, count(distinct visitor_id) visitors from pv group by device order by 2 desc) t
    ), '[]'::jsonb),
    'browsers', coalesce((
      select jsonb_agg(t) from (
        select browser name, count(distinct visitor_id) visitors from pv group by browser order by 2 desc limit 10) t
    ), '[]'::jsonb),
    'os', coalesce((
      select jsonb_agg(t) from (
        select os name, count(distinct visitor_id) visitors from pv group by os order by 2 desc limit 10) t
    ), '[]'::jsonb),
    'locales', coalesce((
      select jsonb_agg(t) from (
        select locale name, count(distinct visitor_id) visitors, count(*) pageviews
          from pv group by locale order by 2 desc) t
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(t) from (
        select type name, count(*) count, count(distinct visitor_id) visitors
          from ev where type <> 'pageview' group by type order by count(*) desc) t
    ), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'sessions', (select count(distinct sid) from pv),
      'product_views', (select count(distinct sid) from pv where product_slug is not null),
      'add_to_cart', (select count(distinct sid) from ev where type = 'add_to_cart'),
      'begin_checkout', (select count(distinct sid) from ev where type = 'begin_checkout'),
      'purchase', (select count(distinct sid) from ev where type = 'purchase'),
      'orders', (select count(*) from public.orders where created_at >= v_from and created_at < v_to and status <> 'cancelled')
    ),
    'realtime', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from live),
      'pages', coalesce((
        select jsonb_agg(t) from (
          select path, count(distinct visitor_id) visitors from (
            select distinct on (visitor_id) visitor_id, path from live where path is not null order by visitor_id, created_at desc
          ) cur group by path order by 2 desc limit 8) t
      ), '[]'::jsonb)
    )
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_traffic(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_traffic(timestamptz, timestamptz) to authenticated;

-- Nightly retention via pg_cron, only when the extension is already installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $cron$select cron.schedule('analytics-retention', '17 3 * * *', 'select public.analytics_purge()')$cron$;
    exception when others then
      raise notice 'pg_cron schedule skipped: %', sqlerrm;
    end;
  end if;
end $$;
