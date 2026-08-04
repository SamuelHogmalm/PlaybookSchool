-- Playbook School — quiz progress (attempts + mastery)
-- Run via Supabase CLI: supabase db push
-- Or paste into Supabase Dashboard → SQL Editor

-- Teams ------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- Profiles (extends auth.users) ------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  full_name text,
  role text not null default 'player' check (role in ('coach', 'player')),
  position text check (position in ('PG', 'SG', 'SF', 'PF', 'C')),
  jersey int,
  created_at timestamptz not null default now()
);

-- Quiz attempts (append-only log) ----------------------------------------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  category text not null,
  play_name text,
  player_role text not null check (player_role in ('1', '2', '3', '4', '5')),
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

create index if not exists attempts_user_play_idx
  on public.attempts (user_id, play_name);

-- Per-play mastery rollup (coach analytics + player dashboard) -----------
create table if not exists public.mastery (
  user_id uuid not null references auth.users (id) on delete cascade,
  play_name text not null,
  attempts_count int not null default 0 check (attempts_count >= 0),
  correct_count int not null default 0 check (correct_count >= 0),
  last_attempt_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, play_name)
);

-- Auto-create profile on signup ------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'player')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep mastery in sync when attempts are inserted --------------------------
create or replace function public.sync_mastery_on_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.play_name is null or new.play_name = '' then
    return new;
  end if;

  insert into public.mastery (user_id, play_name, attempts_count, correct_count, last_attempt_at, updated_at)
  values (
    new.user_id,
    new.play_name,
    1,
    case when new.correct then 1 else 0 end,
    new.created_at,
    now()
  )
  on conflict (user_id, play_name) do update set
    attempts_count = public.mastery.attempts_count + 1,
    correct_count = public.mastery.correct_count + case when new.correct then 1 else 0 end,
    last_attempt_at = new.created_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists attempts_sync_mastery on public.attempts;
create trigger attempts_sync_mastery
  after insert on public.attempts
  for each row execute function public.sync_mastery_on_attempt();

-- Row level security -------------------------------------------------------
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.mastery enable row level security;

-- Teams: members can read their team
create policy "teams_select_member"
  on public.teams for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_id = teams.id
    )
  );

-- Profiles: read own; coaches read teammates
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_select_team"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.team_id is not null
        and me.team_id = profiles.team_id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Attempts: own rows only
create policy "attempts_select_own"
  on public.attempts for select
  using (user_id = auth.uid());

create policy "attempts_insert_own"
  on public.attempts for insert
  with check (user_id = auth.uid());

-- Mastery: own rows; coaches read team
create policy "mastery_select_own"
  on public.mastery for select
  using (user_id = auth.uid());

create policy "mastery_select_team_coach"
  on public.mastery for select
  using (
    exists (
      select 1 from public.profiles coach
      join public.profiles player on player.team_id = coach.team_id
      where coach.id = auth.uid()
        and coach.role = 'coach'
        and player.id = mastery.user_id
    )
  );

-- Helper view for coach dashboard ----------------------------------------
create or replace view public.team_play_mastery as
select
  p.team_id,
  m.play_name,
  count(distinct m.user_id) as player_count,
  round(avg(m.correct_count::numeric / nullif(m.attempts_count, 0)) * 100)::int as avg_mastery_pct,
  round(avg((1 - m.correct_count::numeric / nullif(m.attempts_count, 0)) * 100))::int as avg_miss_pct
from public.mastery m
join public.profiles p on p.id = m.user_id
where p.team_id is not null
group by p.team_id, m.play_name;

grant select on public.team_play_mastery to authenticated;
