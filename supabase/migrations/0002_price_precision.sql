alter table public.product_variants alter column price_net type numeric(12,4);
alter table public.product_variants alter column cost_net type numeric(12,4);
alter table public.order_items alter column unit_price_net type numeric(12,4);
