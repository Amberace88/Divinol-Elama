-- Produkti "cena pēc pieprasījuma": redzami veikalā bez cenas, nav pērkami; apmeklētājs sūta cenas pieprasījumu.
alter table public.products add column if not exists price_on_request boolean not null default false;

-- Drošība: šādu produktu nevar pasūtīt caur veikala grozu (place_order). Admins manuālos pasūtījumos drīkst.
create or replace function public.block_price_on_request_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if new.product_id is null or public.is_admin() then return new; end if;
  select slug into v_slug from public.products where id = new.product_id and price_on_request;
  if found then raise exception 'product_not_found:%', v_slug; end if;
  return new;
end $$;

drop trigger if exists block_price_on_request_item on public.order_items;
create trigger block_price_on_request_item before insert on public.order_items
  for each row execute function public.block_price_on_request_item();
