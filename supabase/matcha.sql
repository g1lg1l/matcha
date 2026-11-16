-- Matcha schema. It lives in the same Supabase project as Midori, so every table and function is
-- prefixed matcha_ and nothing here touches Midori's tables.
-- Apply once: Supabase dashboard → SQL Editor → paste this file → Run. It is safe to run again.
--
-- Model: a tournament is one JSON document (settings, players, results) owned by the anonymous user
-- who created it. Only the owner can change it. Anyone with its share code can follow it through
-- matcha_follow(), which is what lets row-level security (and Realtime) show it to them.

create table if not exists public.matcha_tournaments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  -- 12 hex chars, about 48 bits: not guessable through the rate-limited follow function
  share_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 256000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matcha_tournaments_owner on public.matcha_tournaments (owner_id);

create table if not exists public.matcha_followers (
  tournament_id uuid not null references public.matcha_tournaments on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
create index if not exists matcha_followers_user on public.matcha_followers (user_id);

create or replace function public.matcha_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists matcha_touch on public.matcha_tournaments;
create trigger matcha_touch before update on public.matcha_tournaments
  for each row execute function public.matcha_touch();

-- The only way to start following: you need the code.
create or replace function public.matcha_follow(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tid uuid;
begin
  select id into tid from public.matcha_tournaments where share_code = code;
  if tid is null then
    raise exception 'Unknown tournament' using errcode = 'P0002';
  end if;
  insert into public.matcha_followers (tournament_id, user_id) values (tid, auth.uid())
  on conflict do nothing;
  return tid;
end $$;

revoke execute on function public.matcha_follow(text) from public, anon;
grant execute on function public.matcha_follow(text) to authenticated;

alter table public.matcha_tournaments enable row level security;
alter table public.matcha_followers enable row level security;

drop policy if exists "owner or follower reads" on public.matcha_tournaments;
create policy "owner or follower reads" on public.matcha_tournaments for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.matcha_followers f where f.tournament_id = matcha_tournaments.id and f.user_id = (select auth.uid()))
  );
drop policy if exists "owner creates" on public.matcha_tournaments;
create policy "owner creates" on public.matcha_tournaments for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "owner updates" on public.matcha_tournaments;
create policy "owner updates" on public.matcha_tournaments for update to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "owner deletes" on public.matcha_tournaments;
create policy "owner deletes" on public.matcha_tournaments for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "own follows" on public.matcha_followers;
create policy "own follows" on public.matcha_followers for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "unfollow" on public.matcha_followers;
create policy "unfollow" on public.matcha_followers for delete to authenticated
  using (user_id = (select auth.uid()));

-- owner and share code never change; only the document does.
-- Supabase's default privileges grant everything to anon and authenticated, so start from nothing
revoke all on public.matcha_tournaments, public.matcha_followers from anon, authenticated;
grant select, delete on public.matcha_tournaments to authenticated;
grant insert (id, data) on public.matcha_tournaments to authenticated;
grant update (data) on public.matcha_tournaments to authenticated;
grant select, delete on public.matcha_followers to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.matcha_tournaments;
exception when duplicate_object then null;
end $$;
