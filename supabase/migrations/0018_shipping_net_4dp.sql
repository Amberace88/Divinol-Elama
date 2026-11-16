-- Shipping prices are entered incl. VAT (e.g. Omniva 5,10 €). With 21 % VAT no whole-cent net gives 5,10 € gross,
-- so the net is kept with 4 decimals (5,10 / 1,21 = 4,2149). place_order() already uses the stored net as is;
-- admin_create_order() rounded the admin-entered shipping to 2 decimals → keep 4, like the admin form now sends.
do $patch$
declare
  d text := pg_get_functiondef('public.admin_create_order(jsonb)'::regprocedure);
  a text := $a$v_ship_net numeric := round(coalesce((payload->>'shipping_net')::numeric, 0), 2);$a$;
begin
  if position(a in d) = 0 then
    if position($c$round(coalesce((payload->>'shipping_net')::numeric, 0), 4)$c$ in d) > 0 then return; end if;
    raise exception 'admin_create_order shipping patch did not apply';
  end if;
  d := replace(d, a, $b$v_ship_net numeric := round(coalesce((payload->>'shipping_net')::numeric, 0), 4);$b$);
  execute d;
end $patch$;
