-- AI shop assistant: conversation log (for review in the admin) + settings key 'assistant'.
create table if not exists public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  ip_hash text,
  locale text,
  market text,
  messages jsonb not null default '[]'::jsonb,
  turns integer not null default 0,
  tools_used text[] not null default '{}',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_chats_updated_idx on public.assistant_chats (updated_at desc);
create index if not exists assistant_chats_ip_idx on public.assistant_chats (ip_hash, updated_at desc);
alter table public.assistant_chats enable row level security;
-- writes: only the service role (server); reads: admins
create policy "admins read assistant chats" on public.assistant_chats for select using (public.is_admin());

insert into public.settings (key, value, is_public)
values ('assistant', '{"public": false, "model": "claude-sonnet-5"}'::jsonb, false)
on conflict (key) do nothing;
