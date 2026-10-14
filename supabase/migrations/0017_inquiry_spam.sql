-- Inquiry spam protection: random mixed-case gibberish ("iqVTIMTVsfzNdBLSBRKFRMOv") and form-fill bots are stored
-- with status 'spam' (kept, visible under the admin filter, no shop e-mail) — same rule as src/lib/spam.ts.
-- One e-mail address may send at most 5 inquiries per hour.

create or replace function public.is_gibberish_text(p text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  w text;
begin
  for w in select regexp_split_to_table(coalesce(p, ''), '[\s,.;:!?()"''/\\-]+') loop
    if w ~ '^[A-Za-z]{10,}$'
       and w !~ '^[A-Za-z][a-z]+([A-Z][a-z]{2,})+$'
       and length(regexp_replace(w, '[^A-Z]', '', 'g')) >= 3
       and length(regexp_replace(w, '[^a-z]', '', 'g')) >= 3
       and (select count(*) from regexp_matches(w, '[a-z][A-Z]', 'g')) >= 2 then
      return true;
    end if;
  end loop;
  return false;
end $$;

create or replace function public.submit_inquiry(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(payload->>'email', '')));
  v_extra jsonb := coalesce(payload->'extra', '{}'::jsonb);
  v_spam boolean;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if length(coalesce(payload->>'message', '')) > 5000 then raise exception 'too_long'; end if;
  if coalesce(payload->>'type', 'contact') not in ('contact', 'b2b', 'quote', 'oil_finder') then raise exception 'invalid_type'; end if;
  if (select count(*) from public.inquiries where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  v_spam := coalesce((payload->>'spam')::boolean, false)
    or public.is_gibberish_text(payload->>'name')
    or public.is_gibberish_text(payload->>'message')
    or public.is_gibberish_text(payload->>'company')
    or public.is_gibberish_text(v_extra->>'car');
  if v_spam and not v_extra ? 'spam_reason' then
    v_extra := v_extra || jsonb_build_object('spam_reason', 'gibberish');
  end if;

  insert into public.inquiries (type, name, email, phone, company, message, payload, locale, status)
  values (coalesce(payload->>'type', 'contact'), left(coalesce(nullif(payload->>'name', ''), '—'), 200), v_email,
          left(payload->>'phone', 50), left(payload->>'company', 200), payload->>'message',
          v_extra, left(payload->>'locale', 5), case when v_spam then 'spam' else 'new' end)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;

-- the bot entries already received
update public.inquiries set status = 'spam', payload = payload || '{"spam_reason":"gibberish"}'::jsonb
 where status <> 'spam' and (public.is_gibberish_text(name) or public.is_gibberish_text(message));
