-- Matcha schema. It lives in the same Supabase project as Midori, so every table and function is
-- prefixed matcha_ and nothing here touches Midori's tables.
-- Apply once: Supabase dashboard → SQL Editor → paste this file → Run. It is safe to run again,
-- also over an older version of itself.
--
-- Model: a tournament is one JSON document (settings, players, results) owned by the anonymous user
-- who created it. Three roles:
--   owner    created it; can change and delete it, and hands out the referee link
--   editor   opened the referee link; can enter results and edit the tournament, not delete it
--   viewer   opened the share link; reads it, live
-- Followers (editors and viewers) only join through matcha_follow(), which needs the code.

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
alter table public.matcha_followers add column if not exists role text not null default 'viewer';
do $$
begin
  alter table public.matcha_followers add constraint matcha_followers_role check (role in ('viewer', 'editor'));
exception when duplicate_object then null;
end $$;
create index if not exists matcha_followers_user on public.matcha_followers (user_id);

-- Referee codes live apart from the tournament row, which followers can read (and Realtime sends).
-- No client can read this table; only the owner gets the code, through matcha_referee_code().
create table if not exists public.matcha_referee_codes (
  tournament_id uuid primary key references public.matcha_tournaments on delete cascade,
  code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
);
insert into public.matcha_referee_codes (tournament_id) select id from public.matcha_tournaments on conflict do nothing;

create or replace function public.matcha_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists matcha_touch on public.matcha_tournaments;
create trigger matcha_touch before update on public.matcha_tournaments
  for each row execute function public.matcha_touch();

create or replace function public.matcha_new_referee_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.matcha_referee_codes (tournament_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists matcha_new_referee_code on public.matcha_tournaments;
create trigger matcha_new_referee_code after insert on public.matcha_tournaments
  for each row execute function public.matcha_new_referee_code();

-- owner or editor; security definer so the update policy can ask without recursing into RLS
create or replace function public.matcha_can_edit(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.matcha_tournaments where id = tid and owner_id = auth.uid())
      or exists (select 1 from public.matcha_followers where tournament_id = tid and user_id = auth.uid() and role = 'editor')
$$;

-- Start following with the share code; add the referee code to become an editor.
-- A wrong referee code still lets you watch: the returned role tells the app.
drop function if exists public.matcha_follow(text);
create or replace function public.matcha_follow(code text, referee text default null)
returns table (id uuid, role text)
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
  owner uuid;
  r text := 'viewer';
begin
  select t.id, t.owner_id into tid, owner from public.matcha_tournaments t where t.share_code = code;
  if tid is null then
    raise exception 'Unknown tournament' using errcode = 'P0002';
  end if;
  if owner = auth.uid() then
    return query select tid, 'owner'::text;
    return;
  end if;
  if referee is not null and exists (select 1 from public.matcha_referee_codes c where c.tournament_id = tid and c.code = referee) then
    r := 'editor';
  end if;
  insert into public.matcha_followers as f (tournament_id, user_id, role) values (tid, auth.uid(), r)
  on conflict (tournament_id, user_id) do update set role = case when excluded.role = 'editor' then 'editor' else f.role end
  returning f.role into r;
  return query select tid, r;
end $$;

create or replace function public.matcha_referee_code(tid uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare c text;
begin
  if not exists (select 1 from public.matcha_tournaments where id = tid and owner_id = auth.uid()) then
    raise exception 'Only the owner' using errcode = '42501';
  end if;
  select code into c from public.matcha_referee_codes where tournament_id = tid;
  return c;
end $$;

-- New referee link: the old one stops working and everyone who used it goes back to watching.
create or replace function public.matcha_reset_referee_code(tid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not exists (select 1 from public.matcha_tournaments where id = tid and owner_id = auth.uid()) then
    raise exception 'Only the owner' using errcode = '42501';
  end if;
  update public.matcha_referee_codes set code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
  where tournament_id = tid returning code into c;
  update public.matcha_followers set role = 'viewer' where tournament_id = tid;
  return c;
end $$;

-- Sets (or with null clears) one result in place, so two referees entering different matches
-- at the same time don't overwrite each other.
create or replace function public.matcha_set_result(tid uuid, match text, result jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.matcha_can_edit(tid) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(match) > 24 or (result is not null and (jsonb_typeof(result) <> 'object' or pg_column_size(result) > 1000)) then
    raise exception 'Bad result' using errcode = '22023';
  end if;
  update public.matcha_tournaments
  set data = case
      when result is null then data #- array['results', match]
      else jsonb_set(data, '{results}', coalesce(data -> 'results', '{}'::jsonb) || jsonb_build_object(match, result))
    end || jsonb_build_object('updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  where id = tid;
end $$;

revoke execute on function public.matcha_follow(text, text), public.matcha_referee_code(uuid), public.matcha_reset_referee_code(uuid),
  public.matcha_set_result(uuid, text, jsonb), public.matcha_can_edit(uuid) from public, anon;
grant execute on function public.matcha_follow(text, text), public.matcha_referee_code(uuid), public.matcha_reset_referee_code(uuid),
  public.matcha_set_result(uuid, text, jsonb), public.matcha_can_edit(uuid) to authenticated;

alter table public.matcha_tournaments enable row level security;
alter table public.matcha_followers enable row level security;
alter table public.matcha_referee_codes enable row level security;

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
drop policy if exists "owner or editor updates" on public.matcha_tournaments;
create policy "owner or editor updates" on public.matcha_tournaments for update to authenticated
  using (public.matcha_can_edit(id));
drop policy if exists "owner deletes" on public.matcha_tournaments;
create policy "owner deletes" on public.matcha_tournaments for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "own follows" on public.matcha_followers;
create policy "own follows" on public.matcha_followers for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "unfollow" on public.matcha_followers;
create policy "unfollow" on public.matcha_followers for delete to authenticated
  using (user_id = (select auth.uid()));
-- matcha_referee_codes: no policies at all, so no client access

-- Owner and share code never change; only the document does. Roles change only through the functions.
-- Supabase's default privileges grant everything to anon and authenticated, so start from nothing.
revoke all on public.matcha_tournaments, public.matcha_followers, public.matcha_referee_codes from anon, authenticated;
grant select, delete on public.matcha_tournaments to authenticated;
grant insert (id, data) on public.matcha_tournaments to authenticated;
grant update (data) on public.matcha_tournaments to authenticated;
grant select, delete on public.matcha_followers to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.matcha_tournaments;
exception when duplicate_object then null;
end $$;
