# Supabase - OorjaMan UAT + Production (two projects, one migration history)

Use your **existing** Supabase project as **UAT**, and create a **second** project for **production**. Schema, RLS policies, views, and functions stay in sync by applying the **same git migrations** to both - never by hand-editing SQL in the dashboard.

**Naming suggestion (Dashboard only - does not affect URLs or keys):**

| Role     | Supabase project display name                | Notes                                                      |
| -------- | -------------------------------------------- | ---------------------------------------------------------- |
| **UAT**  | `OorjaMan UAT` (rename current **OorjaMan**) | Keep using this project ref in all UAT web/mobile env vars |
| **PROD** | `OorjaMan Prod` (new project)                | New URL + anon + service_role keys                         |

Inside Supabase Cloud, the Postgres database is almost always named **`postgres`**. “OorjaManDB” is fine as a label in your docs; you do not need a separate physical database name on hosted Supabase.

---

## Source of truth (this repo)

| What                                            | Where                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Migrations** (tables, RLS, views, cron, etc.) | `supabase/migrations/*.sql`                                                                                  |
| **Edge functions**                              | `supabase/functions/<name>/`                                                                                 |
| **Reference / bootstrap**                       | `supabase/schema.sql` + `supabase/policies.sql` - regenerated from migrations via **`npm run db:reference`** |

Every schema or policy change should be a **new file** under `supabase/migrations/`, committed to git, then pushed to **UAT first**, then **PROD**.

---

## One-time setup

### 1. Label UAT (your current project)

1. Supabase Dashboard → project **OorjaMan** → **Settings → General**.
2. Rename to **OorjaMan UAT** (optional, recommended).
3. Copy and save:
   - **Project URL** → UAT `EXPO_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **Project ref** (subdomain in URL, e.g. `abcdefghij` from `https://abcdefghij.supabase.co`)
   - **anon** and **service_role** keys (service_role → root `.env` only)

### 2. Create production project

1. Dashboard → **New project** → name **OorjaMan Prod**, region same as UAT if possible.
2. Save **prod** URL, ref, anon, service_role separately (password manager / `.env.deployment.example`).

### 3. Record refs in repo-root `.env` (gitignored)

```env
# Scripts only - never commit
SUPABASE_UAT_PROJECT_REF=<current-oorjaman-ref>
SUPABASE_PROD_PROJECT_REF=<new-prod-ref>

SUPABASE_UAT_URL=https://<uat-ref>.supabase.co
SUPABASE_PROD_URL=https://<prod-ref>.supabase.co
```

### 4. CLI link (one project at a time)

The CLI stores a single “linked” project in `.supabase/` (gitignored). You **re-link** when switching targets:

```bash
cd /path/to/oorjaman-flagship
npm install

# UAT
npx supabase link --project-ref <SUPABASE_UAT_PROJECT_REF>

# PROD (when ready)
npx supabase link --project-ref <SUPABASE_PROD_PROJECT_REF>
```

---

## Keeping schema + RLS in sync (routine workflow)

### Golden rule

**UAT first → validate → PROD.** Never edit production schema only in the Dashboard.

### Apply all pending migrations

```bash
# 1) UAT
npx supabase link --project-ref <UAT_REF>
npm run db:push
# or non-interactive: npm run db:push:yes

# 2) After QA on UAT web/apps, PROD
npx supabase link --project-ref <PROD_REF>
npm run db:push:yes
```

`db push` applies every migration in `supabase/migrations/` that the remote has not yet recorded in `supabase_migrations.schema_migrations`.

### Verify both projects match migration history

```bash
npx supabase link --project-ref <UAT_REF>
npx supabase migration list

npx supabase link --project-ref <PROD_REF>
npx supabase migration list
```

The **list of applied migration timestamps** should be identical on UAT and PROD (same count, same names). If PROD is behind, run `db push` on PROD again.

### Edge functions (both projects)

Functions are **not** included in `db push`. Deploy to each project after linking:

```bash
npx supabase link --project-ref <UAT_REF>
npm run functions:deploy -- send-customer-expo-push
npm run functions:deploy -- send-technician-expo-push
# …each function you use (see package.json / docs/)

npx supabase link --project-ref <PROD_REF>
npm run functions:deploy -- send-customer-expo-push
# repeat
```

Set **Edge Function secrets** (`PUSH_DISPATCH_SECRET`, etc.) separately in each project’s dashboard.

### Postgres settings (per project)

Some features use database-level settings (push URLs, cron). Run the SQL from [ENVIRONMENT.md](ENVIRONMENT.md) and [docs/customer-push-setup.md](docs/customer-push-setup.md) **once per project**, with that project’s function URL and secrets.

---

## Bootstrap a **new empty** UAT project (match Prod schema)

`supabase/migrations/` are **incremental** changes. Core tables (`users`, `customers`, `bookings`, …) were created on Prod **before** migration history started, so they are **not** in any migration file. A brand-new UAT project cannot use `db push` alone on day one.

**Recommended (schema-only clone from Prod):**

```bash
# 1) Log in once
npx supabase login

# 2) Dump Prod schema (no data — omit --data-only; default is DDL/schema)
npx supabase link --project-ref <PROD_REF> -p '<PROD_DB_PASSWORD>'
npx supabase db dump --linked -f /tmp/oorjaman-prod-schema.sql -s public,auth,storage

# 3) Restore into UAT
npx supabase link --project-ref <UAT_REF> -p '<UAT_DB_PASSWORD>'
psql "<UAT_DATABASE_URL>" -f /tmp/oorjaman-prod-schema.sql

# 4) Mark migrations as applied on UAT (so future db push works)
npx supabase migration repair --status applied <version>   # or repair all from prod list
# Easier: after restore, run `npx supabase migration list` on both and align with `db push` if needed
```

Get **Database URL** and **DB password** from each project: Dashboard → **Settings → Database**.

After schema exists on UAT:

```bash
npm run seed:dummy-users   # uses .env.uat.local
```

**Long-term fix (optional):** export Prod base DDL once into `supabase/migrations/20260401000000_initial_bootstrap.sql` so fresh environments need only `db push`.

---

## Data: UAT vs PROD (not copied by migrations)

|                               | UAT (OorjaMan UAT)                | PROD (OorjaMan Prod) |
| ----------------------------- | --------------------------------- | -------------------- |
| **Schema / RLS**              | From git migrations               | Same migrations      |
| **Rows** (bookings, users, …) | Test / seed / optional prod clone | Real customers only  |
| **Auth users**                | Dummy QA + testers                | Real signups         |

**Fresh UAT data:**

```bash
# root .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY = UAT
npm run seed:dummy-users
```

**Optional: copy prod data into UAT** (PII - restrict access): `pg_dump` from PROD → `pg_restore` into UAT after migrations are applied on UAT. See [DEPLOYMENT.md](DEPLOYMENT.md).

**Never** copy UAT dump into PROD.

---

## App configuration matrix

| App / host                               | Supabase project  |
| ---------------------------------------- | ----------------- |
| `dev-*.oorjaman.com` + UAT mobile builds | **OorjaMan UAT**  |
| `oorjaman.com`, `admin.*`, store mobile  | **OorjaMan Prod** |
| Local dev (recommended)                  | **UAT**           |

---

## When you add or change schema / RLS

1. Create migration locally (preferred):

   ```bash
   npx supabase migration new my_change_name
   # edit supabase/migrations/<timestamp>_my_change_name.sql
   ```

   Or add a hand-written `supabase/migrations/YYYYMMDDHHMMSS_description.sql` (match existing naming).

2. Test on local Supabase (optional): `npx supabase start` → `db push`.

3. `npx supabase link --project-ref <UAT_REF>` → `npm run db:push`.

4. QA on UAT web + mobile.

5. `npx supabase link --project-ref <PROD_REF>` → `npm run db:push:yes`.

6. Deploy edge functions if the change touches them.

7. Commit migration file(s) to git.
8. Regenerate reference SQL: **`npm run db:reference`** (updates `schema.sql` and `policies.sql` from all files in `supabase/migrations/`).

---

## Keeping `schema.sql` and `policies.sql` in sync

**Deployments use migrations only** (`db push`). The reference files are for:

- Reading the full current design in one place
- Manual SQL editor bootstrap on a blank database (apply `schema.sql` → `policies.sql` → `storage.sql`)
- Code review and onboarding

After adding or changing migrations:

```bash
npm run db:reference
git add supabase/schema.sql supabase/policies.sql
```

With Docker, you can alternatively dump from a fully migrated local DB:

```bash
npx supabase start
npx supabase db reset
npx supabase db dump --local -f supabase/.schema.dump.sql -s public
```

Prefer **`db:reference`** so the snapshot always matches migration history in git.

---

## Troubleshooting

### “Migration already applied” / drift

- Run `npx supabase migration list` on both projects.
- If someone ran SQL manually in the dashboard, repair by adding a matching migration or using `supabase migration repair` (advanced - [Supabase docs](https://supabase.com/docs/guides/cli/local-development#repair-migration-history)).

### UAT and PROD lists differ

- PROD is missing files → `db push` on PROD.
- UAT has extra entries → find manual dashboard changes and codify them in a new migration, or repair history (do not delete prod migration rows casually).

### Check for schema diff (optional)

```bash
npx supabase link --project-ref <REF>
npx supabase db diff
```

Useful before a release to see if remote differs from linked local migrations.

### RLS / policies

All policies live in **migration SQL** (search `create policy` in `supabase/migrations/`). Pushing migrations updates policies on both projects the same way.

---

## Checklist: new PROD project go-live

- [ ] Create **OorjaMan Prod** project
- [ ] `db push` all migrations on PROD
- [ ] `migration list` matches UAT
- [ ] Deploy all edge functions + secrets on PROD
- [ ] Auth redirect URLs → production domains ([DEPLOYMENT.md](DEPLOYMENT.md))
- [ ] PROD web/mobile env → prod URL + anon only
- [ ] UAT env still → current (renamed) UAT project
- [ ] Do **not** seed dummy users on PROD unless intentional

---

## Related

- [DEPLOYMENT.md](DEPLOYMENT.md) - 8 web hosts + mobile PROD/UAT
- [ENVIRONMENT.md](ENVIRONMENT.md) - env var tables
- `npm run db:push` / `npm run db:push:yes` - apply migrations to whichever project is currently **linked**
