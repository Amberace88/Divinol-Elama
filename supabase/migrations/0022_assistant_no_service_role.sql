-- AI assistant without the service-role key: the server talks to the DB as the visitor (anon / signed-in) through
-- SECURITY DEFINER functions that do only what the assistant needs.

-- {public, model} is harmless → readable by everybody (the API route decides who may chat)
update public.settings set is_public = true where key = 'assistant';

-- questions asked from one (hashed) IP during the last hour — rate limit
create or replace function public.assistant_recent_turns(p_ip_hash text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(turns), 0)::int from public.assistant_chats
   where ip_hash = p_ip_hash and updated_at > now() - interval '1 hour'
$$;

-- turns already used in one chat (null = unknown chat)
create or replace function public.assistant_chat_turns(p_chat uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select turns from public.assistant_chats where id = p_chat
$$;

-- store / update the text-only log of a conversation; user_id comes from the session, not from the caller
create or replace function public.assistant_log(
  p_chat uuid, p_ip_hash text, p_locale text, p_market text, p_messages jsonb, p_tools text[],
  p_input integer, p_output integer, p_cache integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_chat;
  v_msgs jsonb := coalesce(p_messages, '[]'::jsonb);
begin
  if jsonb_typeof(v_msgs) <> 'array' or length(v_msgs::text) > 200000 then raise exception 'too_large'; end if;
  if v_id is not null and exists (select 1 from public.assistant_chats where id = v_id) then
    update public.assistant_chats set
      messages = v_msgs,
      turns = turns + 1,
      tools_used = (select array(select distinct unnest(tools_used || coalesce(p_tools, '{}')))),
      input_tokens = input_tokens + greatest(coalesce(p_input, 0), 0),
      output_tokens = output_tokens + greatest(coalesce(p_output, 0), 0),
      cache_read_tokens = cache_read_tokens + greatest(coalesce(p_cache, 0), 0),
      user_id = coalesce(user_id, auth.uid()),
      updated_at = now()
     where id = v_id;
  else
    insert into public.assistant_chats (user_id, ip_hash, locale, market, messages, turns, tools_used, input_tokens, output_tokens, cache_read_tokens)
    values (auth.uid(), left(p_ip_hash, 64), left(p_locale, 5), left(p_market, 2), v_msgs, 1, coalesce(p_tools, '{}'),
            greatest(coalesce(p_input, 0), 0), greatest(coalesce(p_output, 0), 0), greatest(coalesce(p_cache, 0), 0))
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- order status for the assistant: the signed-in customer's own orders, or (guest) number + e-mail must both match
create or replace function public.assistant_order_lookup(p_number text, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_number text := upper(trim(coalesce(p_number, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_email text;
  v_rows jsonb;
begin
  if v_uid is not null then select lower(email) into v_user_email from auth.users where id = v_uid; end if;
  if v_uid is null and (v_number = '' or v_email = '') then return jsonb_build_object('error', 'need_number_and_email'); end if;

  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'number', o.number,
      'created_at', o.created_at,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'shipping_method', o.shipping_method,
      'total_gross', o.total_gross,
      'tracking', case when o.tracking_code is not null then jsonb_build_object('code', o.tracking_code, 'carrier', o.tracking_carrier, 'url', o.tracking_url) end,
      'items', (select coalesce(jsonb_agg(trim(i.qty || ' × ' || i.name || ' ' || coalesce(i.pack_label, ''))), '[]'::jsonb) from public.order_items i where i.order_id = o.id),
      'shipments', (select coalesce(jsonb_agg(jsonb_build_object('carrier', s.carrier, 'tracking_number', s.tracking_number, 'status', s.tracking_status, 'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at)), '[]'::jsonb) from public.shipments s where s.order_id = o.id)
    ) as x
    from public.orders o
    where (v_number = '' or o.number = v_number)
      and (
        (v_uid is not null and (o.user_id = v_uid or lower(o.email) = v_user_email))
        or (v_email <> '' and lower(o.email) = v_email and v_number <> '')
      )
    order by o.created_at desc
    limit 5
  ) t;
  return jsonb_build_object('orders', v_rows);
end $$;

revoke all on function public.assistant_recent_turns(text) from public;
revoke all on function public.assistant_chat_turns(uuid) from public;
revoke all on function public.assistant_log(uuid, text, text, text, jsonb, text[], integer, integer, integer) from public;
revoke all on function public.assistant_order_lookup(text, text) from public;
grant execute on function public.assistant_recent_turns(text) to anon, authenticated;
grant execute on function public.assistant_chat_turns(uuid) to anon, authenticated;
grant execute on function public.assistant_log(uuid, text, text, text, jsonb, text[], integer, integer, integer) to anon, authenticated;
grant execute on function public.assistant_order_lookup(text, text) to anon, authenticated;
