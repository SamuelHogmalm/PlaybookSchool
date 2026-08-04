# Test accounts

The test logins **do not exist until you seed them** in Supabase.  
“Invalid login credentials” on Vercel almost always means the accounts were never created.

## Prerequisites

Run both migrations in Supabase **SQL Editor**:

1. `supabase/migrations/20260804180000_quiz_progress.sql`
2. `supabase/migrations/20260805120000_team_onboarding.sql`

## Option A — Seed on Vercel (recommended)

1. In **Supabase → Settings → API**, copy the **service_role** key (secret — not the anon key).

2. In **Vercel → Project → Settings → Environment Variables**, add:

   | Name | Value | Expose to browser |
   |------|--------|-------------------|
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` service role | **No** |
   | `SEED_SECRET` | any long random string you pick | **No** |

3. Redeploy (or wait for the next deploy after pushing this API route).

4. Run once (PowerShell):

```powershell
$secret = "YOUR_SEED_SECRET"
Invoke-RestMethod -Method POST `
  -Uri "https://playlab-omega.vercel.app/api/admin/seed-test-users" `
  -Headers @{ Authorization = "Bearer $secret" }
```

You should get JSON with `ok: true` and the join code.

5. Log in on Vercel with the credentials below.

## Option B — Seed locally

Add to `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key
```

Then:

```bash
npm run seed:test-users
```

## Credentials (after seeding)

| | Coach | Player |
|---|--------|--------|
| Email | `coach@test.playbookschool.dev` | `player@test.playbookschool.dev` |
| Password | `TestCoach123!` | `TestPlayer123!` |
| After login | `/coach/playbook` | `/player/today` |

The player is linked to the coach’s **Demo Eagles** team. Copy the join code from coach **Roster** to invite more players.

## Fix your own coach account

If you signed up as coach but get player view, log out and back in after migration 2. Or in SQL Editor:

```sql
update public.profiles p
set role = 'coach'
from auth.users u
where p.id = u.id and u.email = 'you@example.com';
```

## Progress tracking

- Signed-in players: quizzes save to Supabase.
- Coaches: **Roster** and **Progress** show live data after players take quizzes.
