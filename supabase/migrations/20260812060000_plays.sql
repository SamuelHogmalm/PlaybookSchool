-- Playbook School — plays storage (Phase 2 checkpoint)
-- Run via Supabase CLI: supabase db push
-- Or paste into Supabase Dashboard → SQL Editor
--
-- Columns map one-to-one onto the Play type in MASTER-BUILD-PLAN.md.
-- beats is jsonb: the beat/action shape is owned by validatePlay(), not by the
-- database, so the importer and the builder can never drift into two schemas.

create table if not exists public.plays (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  category text not null default 'Set',
  folder_id uuid,
  beats jsonb not null,
  version int not null default 1 check (version >= 1),
  -- No default: a writer must state validity explicitly, and the check below
  -- means the only value that can be stored is true.
  valid boolean not null,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plays_team_idx on public.plays (team_id, updated_at desc);
create unique index if not exists plays_team_name_idx on public.plays (team_id, lower(name));

-- Never store an invalid play. The API validates before writing; this is the
-- backstop so a direct SQL insert cannot bypass the rule either.
alter table public.plays drop constraint if exists plays_must_be_valid;
alter table public.plays add constraint plays_must_be_valid check (valid);

-- Row level security -------------------------------------------------------
alter table public.plays enable row level security;

-- Dropped first so this file can be re-run — pasting it into the SQL editor after a
-- partial apply is a normal way to use it, and `create policy` is not idempotent.
drop policy if exists "plays_select_team" on public.plays;
drop policy if exists "plays_insert_coach" on public.plays;
drop policy if exists "plays_update_coach" on public.plays;
drop policy if exists "plays_delete_coach" on public.plays;

-- Everyone on the team reads the playbook (players need it to drill).
create policy "plays_select_team"
  on public.plays for select
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.team_id = plays.team_id
    )
  );

-- Only coaches write, and only to their own team.
create policy "plays_insert_coach"
  on public.plays for insert
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role = 'coach'
        and me.team_id = plays.team_id
    )
  );

create policy "plays_update_coach"
  on public.plays for update
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role = 'coach'
        and me.team_id = plays.team_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role = 'coach'
        and me.team_id = plays.team_id
    )
  );

create policy "plays_delete_coach"
  on public.plays for delete
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.role = 'coach'
        and me.team_id = plays.team_id
    )
  );
