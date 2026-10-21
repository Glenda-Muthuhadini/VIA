# Current connected discovery / qualification release

**Grade 9 dashboard v13:** after v12, apply
[sql/grade9_dashboard_setup_v13.sql](sql/grade9_dashboard_setup_v13.sql) once,
then run [tests/grade9_dashboard.sql](tests/grade9_dashboard.sql). The test data
rolls back. Ordered migration: `20261021211512_grade9_dashboard_subject_plan.sql`.
Adds owner-only Grade 10 subject shortlists and actual Grade 9 planning actions,
separately from confirmed subjects, onboarding and academic records. All prior
releases remain unchanged. See [GRADE9_DASHBOARD.md](GRADE9_DASHBOARD.md) for data
and verification details. **Applied and SQL-tested on VIA project
`yalwuksprhgvtcmtysmz` on 21 October 2026. Do not rerun v13 there.**

**Grade 9 onboarding v12:** after v11, apply the
[smaller SQL Editor files](sql/grade9_v12_sql_editor/README.md) separately in
numbered order. The preserved [combined v12 bundle](sql/grade9_onboarding_setup_v12.sql)
is 4.65 MB and exceeds SQL Editor's size limit; it can be used with a direct
database connection instead. Use one packaging only,
then run [tests/grade9_onboarding.sql](tests/grade9_onboarding.sql).
Ordered migrations: `20261021001800_grade9_confirmed_onboarding.sql`, then
`20261021001900_grade9_school_directory.sql`. This updates only the Grade 9
branch: school details, real report extraction/review, confirmed academic results,
subject experience, Grade 10 planning and future interests. Other stage flows and
dashboards remain unchanged. Existing completed Grade 9 users are preserved.
See [GRADE9_ONBOARDING.md](GRADE9_ONBOARDING.md) for deployment, data provenance,
verification and access status. **Applied and SQL-tested on VIA project
`yalwuksprhgvtcmtysmz` on 21 October 2026. Do not rerun v12 there.**
All 25,500 schools were imported; existing record counts were preserved and
rollback-test users were removed. Live browser/camera checks are separate.

**Complete onboarding v11:** after v10, apply
[sql/complete_onboarding_setup_v11.sql](sql/complete_onboarding_setup_v11.sql)
once, then run [tests/complete_onboarding.sql](tests/complete_onboarding.sql).
Ordered migration: `20261020001700_complete_journey_onboarding.sql`.
This adds all seven onboarding branches, Accepted as a distinct stage, owner-only
journey saving and stage transitions that carry known answers and preserve
academic/history records. Earlier releases and the legacy answers column remain
unchanged. See [COMPLETE_ONBOARDING.md](COMPLETE_ONBOARDING.md) for deployment and
verification status. Local PostgreSQL and intercepted browser checks do not mean
this migration has been applied to the connected Supabase project.

**Hackathon demo v10:** after v9, run [sql/demo_institution_dataset_v10.sql](sql/demo_institution_dataset_v10.sql)
once, then [tests/demo_catalogue.sql](tests/demo_catalogue.sql). Migration:
`20261018001600_hackathon_demo_catalogue.sql`. Adds 150 synthetic programmes in 50
faculties across the existing 10 institutions, with demo funding/accommodation.
Synthetic records use `is_demo=true`, nullable source/application URLs and a
separate demo APS rule. Original 21 programmes remain stored; institution browsing
shows the demo catalogue. No learner marks or authentication changes.

For the simplified institution → faculty → programme browser, apply
**[sql/institution_explorer_setup_v9.sql](sql/institution_explorer_setup_v9.sql)**
once after v8, then run **[tests/institution_explorer.sql](tests/institution_explorer.sql)**.
The owner confirmed PASS. This bundles migration `20261018001500_institution_faculties.sql`.
See **[INSTITUTION_EXPLORER.md](INSTITUTION_EXPLORER.md)** for implementation files,
faculty sources, range rules and verification. Previous SQL versions remain unchanged.

After the existing v6 setup, apply **[sql/connected_discovery_setup_v7.sql](sql/connected_discovery_setup_v7.sql)** once,
then **[sql/connected_discovery_links_v8.sql](sql/connected_discovery_links_v8.sql)** once.
Run **[tests/connected_discovery.sql](tests/connected_discovery.sql)**.
The owner confirmed v7 applied with tests PASS and v8 links applied.
Do not rerun applied bundles. No authentication or saved learner marks are changed.

See **[CONNECTED_DISCOVERY.md](CONNECTED_DISCOVERY.md)** for the current grade-aware
checker, catalogue relationships, supported admission rules, sources and verification.
v7 bundles migrations `20261018001200_connected_discovery.sql` and
`20261018001300_connected_catalogue.sql`; v8 bundles
`20261018001400_tut_source_links.sql`. All earlier releases remain available below.

# Previous v6 discovery/qualification release

For the 40-record catalogue and working qualification checker, apply
[`sql/public_qualification_setup_v6.sql`](sql/public_qualification_setup_v6.sql)
once after the existing v4 setup, then run
[`tests/public_qualification.sql`](tests/public_qualification.sql).
**Skip v5: it is a preserved failed transaction, replaced by corrected v6.**
Use numbered bundles in the documented order. See
[QUALIFICATION_CHECKER.md](QUALIFICATION_CHECKER.md) for admissions rules,
source/link limits, privacy and verification details.

# VIA authentication setup

For the database-backed onboarding upgrade, see **[ONBOARDING.md](ONBOARDING.md)**
and **[sql/onboarding_setup_v2.sql](sql/onboarding_setup_v2.sql)**. Apply auth v1
first, then onboarding v2 once; the existing auth release remains unchanged.

The React screens use the existing Supabase client. Supabase Auth owns accounts,
email verification, password hashing and password recovery. The only new public
table for this phase is `via_profiles`, which stores each user's first and last
name. This setup does not create the future public discovery catalog.

## 1. Run the SQL

Open this project's Supabase Dashboard -> SQL Editor -> New query. Paste the
entire contents of **[sql/auth_setup_v1.sql](sql/auth_setup_v1.sql)** and run it
as the SQL Editor's `postgres` role. The namespaced table/functions avoid
replacing unrelated application tables or authentication triggers.

This creates:

- `public.via_profiles`, linked to the primary key of `auth.users` with cascading deletion.
- Owner-only read/update policies and restricted column-level grants.
- A private function/trigger creating a profile on signup.
- Missing profiles for existing Auth users, without overwriting existing profiles.
- A server-managed `updated_at` trigger.

Passwords and password confirmation must never be stored in `via_profiles`.
No service-role key is needed by the browser.

If a `via_profiles` table already exists with a different schema, inspect it
before running this baseline. Do not replace unrelated tables to make it fit.

Then run **[sql/verify_auth_setup.sql](sql/verify_auth_setup.sql)**. Expected:
table exists, RLS enabled, both VIA policies and triggers present, anonymous read
false, protected-column updates false, and missing profiles zero.

## 2. Configure email authentication in the Supabase Dashboard

These are Dashboard settings, not SQL migrations:

1. Authentication -> Providers / Sign In -> enable Email.
2. Authentication -> URL Configuration -> Site URL: `http://localhost:5175`
   during development, and your actual HTTPS application origin when deployed.
3. Add development redirect URL `http://localhost:5175/**`.
4. For production, add your own origin's `/auth/callback**` and `/reset-password`
   redirect URLs. The callback suffix permits VIA's validated `next` query parameter.
   Do not use a development localhost URL as the production Site URL.
5. Keep email templates' standard `{{ .ConfirmationURL }}` link so Supabase
   sends users to the callback/reset URL supplied by VIA.
6. Choose whether email confirmation is enabled. Both modes are supported.
   Confirmation enabled: signup shows the check-email message; the link establishes
   a session at `/auth/callback`. Confirmation disabled: signup signs in immediately.
7. Configure an SMTP sender suitable for the email addresses you need to test
   and serve. The built-in sender has delivery restrictions and rate limits;
   frontend code or SQL cannot remove these restrictions.
8. Configure the password policy to require at least 8 characters; the frontend
   validates that minimum and Supabase enforces the server policy.

Keep `.env.local` configured with `VITE_SUPABASE_URL` and the project's public
key in `VITE_SUPABASE_PUBLISHABLE_KEY`. The client also accepts the legacy
`VITE_SUPABASE_ANON_KEY` name. Set that compatibility alias to the same public
key for older verification scripts. Never put a service-role key in a `VITE_`
variable. Restart Vite after changing environment configuration.

VIA is a Vite/React browser application, not Next.js. Its shared client is
`src/services/supabase.ts`; session persistence and automatic refresh are enabled
there, and `AuthProvider` subscribes to auth state changes. `NEXT_PUBLIC_`
variables, `next/headers`, Server Components and Next.js middleware do not apply
to this runtime. Both `@supabase/supabase-js` and `@supabase/ssr` are installed
with pinned versions; SSR helpers are reserved for a future server-rendered app.

## 3. Check the connection and flows

```text
npm run check:supabase
npm run sql:check
npm run test:auth
npm run test:auth:browser
npm run test:auth:routing
npm run test:auth:routing:browser
npm run build
```

`check:supabase` reads public settings/schema and exercises an invalid login for a
reserved `.invalid` address. It prints no keys, tokens or passwords, creates no
accounts, and sends no emails. A database API `401 Invalid API key` means the
configured public key must be corrected; creating SQL tables cannot fix it.
The check queries the profile endpoint rather than the OpenAPI root: publishable
keys cannot fetch the database OpenAPI document. A permission-denied response
from the private profile table is expected for a logged-out client.

`test:auth:browser` runs headless Chrome against the running development server
(default `http://localhost:5175`, override `VIA_TEST_ORIGIN`). All Supabase calls
are intercepted with fixtures. It checks auth flows and 36 viewport cases; it
creates no real accounts and sends no emails. Set `CHROME_PATH` if Chrome is
installed elsewhere. Reports/screenshots go into `node_modules/.tmp/via-auth-qa`.

`node scripts/check-auth-live.mjs <authorised-email>` is a separate, explicit
live test. It creates an account with an in-memory random password, verifies
login and its profile when confirmation is disabled, and requests a reset email
so the owner can set their own password. Never run it against someone else's
address or repeatedly against an existing account. No password/token is printed
or saved. Actual inbox delivery and completing the link are manual checks.

Test in the browser with an email inbox you control:

1. Sign up. Confirm your email when confirmation is enabled.
2. Verify `Authentication -> Users` and `public.via_profiles` each contain the user.
3. Log out through the dashboard profile menu; visiting `/dashboard` must lead to login.
4. Log in and reload a private page; the session should survive reload.
5. Request a password reset, open the newest email link, enter matching passwords
   on `/reset-password`, then log in with the new password.
6. Verify invalid credentials, mismatched passwords, expired links and network failures.
7. Check mobile, tablet, desktop and shorter-height layouts.

The landing page and forgot-password page remain public. Dashboard and all
existing onboarding routes require an authenticated session. Existing navigation
destinations are preserved; the default post-login destination remains onboarding.
The dashboard reads the signed-in user's name, while its opportunity/journey
cards remain clearly labelled sample data.

## SQL versions kept in the repository

| Version | File | Purpose |
| --- | --- | --- |
| 20261016000100 | `migrations/20261016000100_via_auth_profiles.sql` | Profile table, grants, RLS and timestamp trigger |
| 20261016000200 | `migrations/20261016000200_via_auth_profile_bootstrap.sql` | Auth signup trigger and existing-user backfill |
| Setup release v1 | `sql/auth_setup_v1.sql` | Paste-ready copy of both migrations in order |
| 20261016000300 | `migrations/20261016000300_via_onboarding.sql` | Catalog, private answers/reports, validated save RPC and private Storage |
| 20261016000400 | `migrations/20261016000400_via_onboarding_catalog.sql` | Existing VIA choices and reference labels |
| Onboarding upgrade v2 | `sql/onboarding_setup_v2.sql` | Paste-ready onboarding migrations; requires auth v1 |

Use the release bundle **or** apply the two migrations in order. You do not need
both methods. The baseline can be repeated for this version without deleting
profile rows, but do not replay older versions over future migrations.

Keep released migrations and release bundles immutable. Every future schema
change gets a new timestamped migration and a new numbered setup release. Never
silently overwrite a previous SQL version. `npm run sql:check` verifies that the
v1 and v2 bundles exactly match their canonical migration files.

## Database integration tests

Public discovery v4 upgrades the existing v3 installation. Apply
`sql/public_discovery_setup_v4.sql` **once** after v3. Its ordered migrations are:

1. `migrations/20261016000700_public_discovery.sql`
2. `migrations/20261016000800_public_discovery_seed.sql`

This release creates the shared opportunity catalogue and owner-only saves;
it does not alter authentication, adaptive onboarding or private reports.
Use `sql/verify_public_discovery_setup.sql` for read-only inspection and
`tests/public_discovery.sql` for rolled-back access/integration tests.
The owner confirmed v4 applied and the SQL test returned PASS. Live anonymous
queries also passed. See [PUBLIC_DISCOVERY.md](PUBLIC_DISCOVERY.md) for the data
sources, architecture, exact implementation inventory and remaining limits.

Adaptive onboarding v3 upgrades the existing v2 installation. Apply
`sql/adaptive_onboarding_setup_v3.sql` **once** after v2. It contains, in order:

1. `migrations/20261016000500_adaptive_onboarding_foundation.sql`
2. `migrations/20261016000600_grade9_catalog.sql`

Existing installations must not rerun v1 or v2. Fresh installations apply v1,
then v2, then v3. All releases remain available and immutable; `sql:check`
checks all three. v3 creates owner-readable history, stage-specific selections,
academic records/results and authenticated revision-checked save functions.
There are no credential changes or paid services.

After v3, run `sql/verify_adaptive_onboarding_setup.sql` for read-only checks and
`tests/adaptive_onboarding.sql` for rolled-back integration tests. The owner
confirmed v3 applied and the adaptive SQL suite returned PASS during this work.
See [ADAPTIVE_ONBOARDING.md](ADAPTIVE_ONBOARDING.md) for architecture and scope.

Run **[tests/auth_profiles.sql](tests/auth_profiles.sql)** in a development Supabase
project after applying setup. It uses two temporary Auth users inside a rolled-back
transaction to test automatic profiles, owner updates, cross-user isolation,
protected-column permissions, and denial of anonymous profile access. It sends
no emails and changes no real user's password. The SQL Editor must report PASS.

## Official references

- [Password authentication and recovery](https://supabase.com/docs/guides/auth/passwords)
- [User profiles and signup triggers](https://supabase.com/docs/guides/auth/managing-user-data)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
