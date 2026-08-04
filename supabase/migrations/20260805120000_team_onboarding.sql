-- Team onboarding: create team, join by code, coach roster access
-- Run in Supabase SQL Editor after the first migration.

-- Join code generator (e.g. EAG-4829)
create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..3 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    code := code || '-' || lpad((floor(random() * 10000))::text, 4, '0');
    select exists(select 1 from public.teams t where t.join_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- Coach creates a team (idempotent if already has one)
create or replace function public.create_coach_team(team_name text default 'My Team')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  tid uuid;
  code text;
  tname text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into prof from public.profiles where id = uid;
  if prof is null then
    raise exception 'Profile not found';
  end if;

  if prof.role <> 'coach' then
    raise exception 'Coach account required';
  end if;

  if prof.team_id is not null then
    select t.join_code, t.name into code, tname from public.teams t where t.id = prof.team_id;
    return json_build_object('team_id', prof.team_id, 'join_code', code, 'team_name', tname);
  end if;

  code := public.generate_join_code();
  tname := coalesce(nullif(trim(team_name), ''), 'My Team');

  insert into public.teams (name, join_code)
  values (tname, code)
  returning id into tid;

  update public.profiles set team_id = tid where id = uid;

  return json_build_object('team_id', tid, 'join_code', code, 'team_name', tname);
end;
$$;

-- Player joins team by invite code
create or replace function public.join_team_by_code(join_code_input text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  tid uuid;
  tname text;
  normalized text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  normalized := upper(trim(replace(join_code_input, ' ', '')));

  select * into prof from public.profiles where id = uid;
  if prof is null then
    raise exception 'Profile not found';
  end if;

  if prof.role <> 'player' then
    raise exception 'Player account required';
  end if;

  select t.id, t.name into tid, tname
  from public.teams t
  where t.join_code = normalized;

  if tid is null then
    raise exception 'Invalid join code';
  end if;

  update public.profiles set team_id = tid where id = uid;

  return json_build_object('team_id', tid, 'team_name', tname, 'join_code', normalized);
end;
$$;

-- Sync role from auth metadata (fixes coach signup metadata)
create or replace function public.sync_profile_from_auth()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta_role text;
  prof public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select raw_user_meta_data ->> 'role' into meta_role
  from auth.users where id = uid;

  update public.profiles
  set
    role = coalesce(nullif(meta_role, ''), role),
    full_name = coalesce(
      nullif((select raw_user_meta_data ->> 'full_name' from auth.users where id = uid), ''),
      full_name
    )
  where id = uid
  returning * into prof;

  return prof;
end;
$$;

grant execute on function public.create_coach_team(text) to authenticated;
grant execute on function public.join_team_by_code(text) to authenticated;
grant execute on function public.sync_profile_from_auth() to authenticated;

-- Coaches can read team info for their team
drop policy if exists "teams_select_coach" on public.teams;
create policy "teams_select_coach"
  on public.teams for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_id = teams.id and p.role = 'coach'
    )
  );

-- Coaches read player mastery on their team (already have mastery_select_team_coach)

-- Coaches read team player profiles (fix infinite recursion - use security definer view instead)
create or replace view public.team_roster as
select
  p.id,
  p.team_id,
  p.full_name,
  p.role,
  p.position,
  p.jersey,
  p.created_at,
  coalesce(sum(m.attempts_count), 0)::int as quiz_attempts,
  coalesce(sum(m.correct_count), 0)::int as quiz_correct,
  max(m.last_attempt_at) as last_quiz_at
from public.profiles p
left join public.mastery m on m.user_id = p.id
where p.role = 'player' and p.team_id is not null
group by p.id, p.team_id, p.full_name, p.role, p.position, p.jersey, p.created_at;

grant select on public.team_roster to authenticated;

create or replace function public.coach_team_roster()
returns setof public.team_roster
language sql
security definer
set search_path = public
stable
as $$
  select r.*
  from public.team_roster r
  join public.profiles coach on coach.team_id = r.team_id and coach.id = auth.uid() and coach.role = 'coach';
$$;

grant execute on function public.coach_team_roster() to authenticated;

create or replace function public.my_team()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  prof public.profiles;
  t public.teams;
begin
  select * into prof from public.profiles where id = auth.uid();
  if prof is null or prof.team_id is null then
    return json_build_object('has_team', false);
  end if;
  select * into t from public.teams where id = prof.team_id;
  return json_build_object(
    'has_team', true,
    'team_id', t.id,
    'team_name', t.name,
    'join_code', t.join_code,
    'role', prof.role
  );
end;
$$;

grant execute on function public.my_team() to authenticated;
