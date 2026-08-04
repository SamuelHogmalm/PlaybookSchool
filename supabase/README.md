# Supabase — Playbook School

## 1. Create project

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon public** key from Settings → API

## 2. Link + run migration

**In your terminal** (requires interactive login):

```bash
cd playlab
npx supabase login
npx supabase link --project-ref hkvnzffvwqenuuyxjtnx
npx supabase db push
```

Or paste `supabase/migrations/20260804180000_quiz_progress.sql` into **Dashboard → SQL Editor → Run**.

## 3. App env vars

Copy `.env.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Add the same vars in **Vercel → Project → Settings → Environment Variables**.

## 4. Auth

Enable **Email** provider in Supabase → Authentication → Providers.

For dev, disable email confirmation: Authentication → Providers → Email → Confirm email **off**.

## 5. Tables

| Table | Purpose |
|-------|---------|
| `teams` | Team roster grouping |
| `profiles` | User role (coach/player), position, team |
| `attempts` | Every quiz answer (adaptive deck source) |
| `mastery` | Per-play rollup for player + coach dashboards |

## 6. Demo vs cloud

- **Logged in + env configured** → writes to Supabase
- **Logged out** → `localStorage` demo fallback (`ps-quiz-progress-demo`), banner shown in quiz

## 7. Seed a team (optional)

```sql
insert into teams (name, join_code) values ('West Valley Eagles', 'JXN-4829');

update profiles
set team_id = (select id from teams where join_code = 'JXN-4829')
where id = 'YOUR_USER_UUID';
```
