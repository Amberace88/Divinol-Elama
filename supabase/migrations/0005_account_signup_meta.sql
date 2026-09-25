-- Customer portal (account area): complements handle_new_user without redefining it.
-- 1) Copy legal_address + marketing_consent from sign-up metadata into the new profile.
-- 2) Keep profiles.email in sync when a user confirms an e-mail change.

create or replace function public.profile_signup_meta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = new.id;
  if meta is not null then
    new.legal_address := coalesce(new.legal_address, nullif(trim(meta->>'legal_address'), ''));
    if lower(coalesce(meta->>'marketing_consent', '')) = 'true' then
      new.marketing_consent := true;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_signup_meta on public.profiles;
create trigger profiles_signup_meta before insert on public.profiles
  for each row execute function public.profile_signup_meta();

create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();

revoke execute on function public.profile_signup_meta() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
