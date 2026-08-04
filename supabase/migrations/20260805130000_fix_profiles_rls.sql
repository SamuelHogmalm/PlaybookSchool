-- Fix infinite recursion on profiles SELECT (profiles_select_team queried profiles inside profiles RLS).
-- Coaches read teammates via coach_team_roster() RPC instead.

drop policy if exists "profiles_select_team" on public.profiles;

-- Allow users to read their own profile only (no nested profiles lookup).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

-- Safe profile read for authenticated user (used if client needs a fallback).
create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_profile() to authenticated;
