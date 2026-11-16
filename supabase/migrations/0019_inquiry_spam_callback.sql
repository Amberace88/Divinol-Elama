-- Inquiry spam, round 2 — the "call-back" wave: «Добрый день, если не дозвонитесь, напишите мне в мессенджер 8901…»
-- from Russian numbers / mail.ru-type addresses, repeated every few days. Same rules as src/lib/spam.ts, plus two
-- that need the history (only the DB has it):
--   blocked_sender — this e-mail or phone already has an inquiry marked as spam (manual "Surogātpasts" = block)
--   duplicate      — the same e-mail sent the very same message within 30 days
-- Spam is kept (status 'spam', reason in payload.spam_reason), the shop is not e-mailed.
-- submit_inquiry() now returns { id, spam } so the Server Action knows whether to notify.

create or replace function public.inquiry_phone_digits(p text)
returns text language sql immutable set search_path = public as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9)
$$;

create or replace function public.is_ru_phone(p text)
returns boolean language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '\D', '', 'g') ~ '^([78]9[0-9]{9}|375[0-9]{9})$'
$$;

create or replace function public.is_ru_mail(p text)
returns boolean language sql immutable set search_path = public as $$
  select lower(trim(coalesce(p, ''))) ~ '\.(ru|by)$'
$$;

create or replace function public.is_callback_bait(p_message text, p_phone text, p_email text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  m text := trim(coalesce(p_message, ''));
  nums text[];
  rest text;
  n text;
  ru boolean := public.is_ru_phone(p_phone);
begin
  if m = '' or length(m) > 220 or m !~* '(мессендж|вацап|ватсап|воцап|whats ?app|телеграм|telegram|вайбер|viber)' then return false; end if;
  select array_agg(x[1]) into nums from regexp_matches(m, '(\+?[0-9][0-9 ()-]{8,}[0-9])', 'g') x;
  if nums is null then return false; end if;
  rest := trim(regexp_replace(regexp_replace(m, '\+?[0-9][0-9 ()-]{8,}[0-9]', '', 'g'), '[^[:alpha:]]+', ' ', 'g'));
  if coalesce(array_length(regexp_split_to_array(rest, '\s+'), 1), 0) > 20 then return false; end if;
  if not ru then
    foreach n in array nums loop
      if public.is_ru_phone(n) then ru := true; end if;
    end loop;
  end if;
  return ru;
end $$;

drop function if exists public.submit_inquiry(jsonb);

create function public.submit_inquiry(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(payload->>'email', '')));
  v_phone text := left(payload->>'phone', 50);
  v_digits text := public.inquiry_phone_digits(payload->>'phone');
  v_message text := payload->>'message';
  v_extra jsonb := coalesce(payload->'extra', '{}'::jsonb);
  v_reason text := nullif(v_extra->>'spam_reason', '');
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if length(coalesce(v_message, '')) > 5000 then raise exception 'too_long'; end if;
  if coalesce(payload->>'type', 'contact') not in ('contact', 'b2b', 'quote', 'oil_finder') then raise exception 'invalid_type'; end if;
  if (select count(*) from public.inquiries where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  if v_reason is null and coalesce((payload->>'spam')::boolean, false) then v_reason := 'bot'; end if;
  if v_reason is null and (public.is_gibberish_text(payload->>'name') or public.is_gibberish_text(v_message)
      or public.is_gibberish_text(payload->>'company') or public.is_gibberish_text(v_extra->>'car')) then
    v_reason := 'gibberish';
  end if;
  if v_reason is null and public.is_callback_bait(v_message, v_phone, v_email) then v_reason := 'callback_bait'; end if;
  if v_reason is null and public.is_ru_phone(v_phone) and public.is_ru_mail(v_email) then v_reason := 'ru_sender'; end if;
  if v_reason is null and exists (
      select 1 from public.inquiries i
       where i.status = 'spam'
         and (i.email = v_email or (length(v_digits) = 9 and public.inquiry_phone_digits(i.phone) = v_digits))) then
    v_reason := 'blocked_sender';
  end if;
  if v_reason is null and coalesce(trim(v_message), '') <> '' and exists (
      select 1 from public.inquiries i
       where i.email = v_email and trim(i.message) = trim(v_message) and i.created_at > now() - interval '30 days') then
    v_reason := 'duplicate';
  end if;
  if v_reason is not null then v_extra := v_extra || jsonb_build_object('spam_reason', v_reason); end if;

  insert into public.inquiries (type, name, email, phone, company, message, payload, locale, status)
  values (coalesce(payload->>'type', 'contact'), left(coalesce(nullif(payload->>'name', ''), '—'), 200), v_email,
          v_phone, left(payload->>'company', 200), v_message,
          v_extra, left(payload->>'locale', 5), case when v_reason is not null then 'spam' else 'new' end)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'spam', v_reason is not null);
end $$;

revoke all on function public.submit_inquiry(jsonb) from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;

-- the call-back wave already received (and its repeats)
update public.inquiries set status = 'spam', payload = coalesce(payload, '{}'::jsonb) || '{"spam_reason":"callback_bait"}'::jsonb
 where status <> 'spam' and public.is_callback_bait(message, phone, email);
update public.inquiries set status = 'spam', payload = coalesce(payload, '{}'::jsonb) || '{"spam_reason":"ru_sender"}'::jsonb
 where status <> 'spam' and public.is_ru_phone(phone) and public.is_ru_mail(email);
