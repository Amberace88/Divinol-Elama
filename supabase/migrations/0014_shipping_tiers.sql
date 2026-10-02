-- Size / weight based shipping prices (e.g. Omniva parcel locker S / M / L) — settings.shipping.methods.<m>.tiers:
--   [{ "id": "S", "label": "S", "max_kg": 5, "price_net": { "LV": 2.89, "EE": 2.89, "LT": 2.89 } }, …]
-- place_order(): parcel weight = Σ qty × (kg × 1.08 | L × 0.95 | 0.5 kg when size unknown) — same as the storefront —
-- and the price of the first tier with weight ≤ max_kg (none fits → shipping_too_heavy). Without tiers nothing changes.
do $patch$
declare
  d text := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);
begin
  if position('v_weight' in d) > 0 then
    return; -- already patched
  end if;
  d := replace(d, $a$  v_max_item numeric := 0;$a$, $b$  v_max_item numeric := 0;
  v_weight numeric := 0;
  v_tier jsonb;$b$);
  d := replace(d, $a$    v_max_item := greatest(v_max_item, coalesce(v_var.size, 0));$a$, $b$    v_max_item := greatest(v_max_item, coalesce(v_var.size, 0));
    v_weight := v_weight + v_qty * (case when coalesce(v_var.size, 0) = 0 then 0.5 when v_var.unit = 'kg' then v_var.size * 1.08 else v_var.size * 0.95 end);$b$);
  d := replace(d, $a$    v_ship_net := (v_ship->>'price_net')::numeric + coalesce((v_ship->'surcharge'->>v_market)::numeric, 0);$a$, $b$    if jsonb_typeof(v_ship->'tiers') = 'array' and jsonb_array_length(v_ship->'tiers') > 0 then
      select t into v_tier from jsonb_array_elements(v_ship->'tiers') t
       where round(v_weight, 3) <= (t->>'max_kg')::numeric order by (t->>'max_kg')::numeric limit 1;
      if v_tier is null then raise exception 'shipping_too_heavy'; end if;
      v_ship_net := coalesce((v_tier->'price_net'->>v_market)::numeric, (v_ship->>'price_net')::numeric + coalesce((v_ship->'surcharge'->>v_market)::numeric, 0));
    else
      v_ship_net := (v_ship->>'price_net')::numeric + coalesce((v_ship->'surcharge'->>v_market)::numeric, 0);
    end if;$b$);
  if position('v_weight := v_weight' in d) = 0 or position('shipping_too_heavy' in d) = 0 or position('v_tier jsonb' in d) = 0 then
    raise exception 'place_order tier patch did not apply';
  end if;
  execute d;
end $patch$;
