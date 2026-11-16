-- Bot sign-ups: random mixed-case names ("ymNxlfKEhapoMXnVIuxkx") + Gmail addresses stuffed with dots
-- ("hizor.e.m.a.juw074@gmail.com" — Gmail ignores dots, so each variant reaches the same real inbox: the bots use the
-- shop's confirmation e-mail to spam that person). They call Supabase Auth directly, so the check lives in the DB:
-- a BEFORE INSERT trigger on auth.users rejects the sign-up (no account, no e-mail sent). Real customers are unaffected.

create or replace function public.signup_block_reason(p_email text, p_meta jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_local text := split_part(v_email, '@', 1);
  v_domain text := split_part(v_email, '@', 2);
begin
  if public.is_gibberish_text(p_meta->>'full_name') or public.is_gibberish_text(p_meta->>'company_name') then
    return 'gibberish_name';
  end if;
  -- Gmail dot-variants: 3+ dots in the local part (real addresses have 0–2)
  if v_domain in ('gmail.com', 'googlemail.com') and length(v_local) - length(replace(v_local, '.', '')) >= 3 then
    return 'gmail_dots';
  end if;
  return null;
end $$;

create or replace function public.block_bot_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.signup_block_reason(new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
begin
  if v_reason is not null then
    raise exception 'signup_blocked: %', v_reason using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists block_bot_signup on auth.users;
create trigger block_bot_signup before insert on auth.users
  for each row execute function public.block_bot_signup();
