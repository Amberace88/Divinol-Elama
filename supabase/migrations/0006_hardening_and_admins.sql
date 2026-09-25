alter function public.set_updated_at() set search_path = public;
revoke execute on function public.is_admin() from anon;

-- Owner and platform developer become admins automatically once their e-mail is confirmed.
create table if not exists public.admin_allowlist (email text primary key, note text);
alter table public.admin_allowlist enable row level security;
create policy "allowlist admin" on public.admin_allowlist for all using (public.is_admin()) with check (public.is_admin());
insert into public.admin_allowlist (email, note) values
  ('elama@elama.lv', 'Arnis — SIA Elama, īpašnieks'),
  ('barops.edijs@gmail.com', 'Edijs — platformas izstrādātājs'),
  ('baropsedijs@gmail.com', 'Edijs — platformas izstrādātājs')
on conflict (email) do nothing;

create or replace function public.grant_allowlisted_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_allowlist a where a.email = lower(new.email)) then
    update public.profiles set role = 'admin' where id = new.id and role <> 'admin';
  end if;
  return new;
end $$;
revoke execute on function public.grant_allowlisted_admin() from public, anon, authenticated;
-- "zz_" so it runs after on_auth_user_created (which inserts the profile)
create trigger zz_on_auth_user_confirmed_admin after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_allowlisted_admin();
