-- Run this in the Supabase SQL editor, or apply the matching migration with `supabase db push`.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.favourites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, tool_name)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai')),
  title text not null default 'New conversation',
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

alter table public.profiles enable row level security;
alter table public.favourites enable row level security;
alter table public.conversations enable row level security;
alter table public.ai_chat_rate_limits enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users manage own favourites" on public.favourites;
create policy "Users manage own favourites" on public.favourites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own conversations" on public.conversations;
create policy "Users manage own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.ai_chat_rate_limits from anon, authenticated;

create or replace function public.consume_ai_chat_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_count integer;
begin
  if current_user_id is null then
    return false;
  end if;

  insert into public.ai_chat_rate_limits (user_id, window_started_at, request_count)
  values (current_user_id, now(), 1)
  on conflict (user_id) do update
  set
    window_started_at = case
      when public.ai_chat_rate_limits.window_started_at <= now() - interval '1 minute'
        then now()
      else public.ai_chat_rate_limits.window_started_at
    end,
    request_count = case
      when public.ai_chat_rate_limits.window_started_at <= now() - interval '1 minute'
        then 1
      else public.ai_chat_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= 20;
end;
$$;

revoke all on function public.consume_ai_chat_quota() from public, anon;
grant execute on function public.consume_ai_chat_quota() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
