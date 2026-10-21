# Grade 9 dashboard planning, v13

Apply `sql/grade9_dashboard_setup_v13.sql` once after v12, then run
`tests/grade9_dashboard.sql` in VIA's Supabase project. The bundle is small enough
for SQL Editor. It contains the new immutable migration
`20261021211512_grade9_dashboard_subject_plan.sql`. Keep v1-v12 as released.

## Data and access

`via_grade9_plans` stores one owner's evolving subject shortlist, explored
subjects/pathways, explicit results/Maths/plan acknowledgements, and the learner's
Maths diagnostic answers. The initial shortlist is copied from the Grade 9
onboarding's real `subjects_considering` values on the first save; only active
Grade 10 elective catalogue IDs are retained. Existing onboarding is not updated.

Reads use an indexed primary-key lookup with owner-only RLS. Anonymous users have
no access. Authenticated clients have SELECT only and must use
`save_my_grade9_plan(p_patch,p_expected_revision)` to write. Its public invoker
wrapper calls a private function with an explicit `auth.uid()` and Grade 9 profile
check, fixed empty search path, strict patch validation and per-owner revision
protection. No other user's ID can be supplied. Other education stages cannot
write Grade 9 plans.

Saving a shortlist or exploration does not change confirmed results, interests,
career interests, onboarding completion, or another education-stage experience.
Changing the shortlist clears its prior final review. Results review stores a
fingerprint supplied by the dashboard; the UI checks this against the current
saved report so later results do not inherit a completed review. The database
requires actual stored Grade 9 academic results before accepting the acknowledgement.
Actions are only reflected as saved after the database confirms the write. On
network, revision or schema errors the UI exposes an error and retry rather than
fabricating progress. Reloading/retrying uses the owner's latest revision.

The client hook scopes state and queued writes to the current authenticated
owner. It never displays an old account's plan while a new account is loading.
The existing browser Supabase client retains session refresh and persistence.

## Verification

Run:

```powershell
node scripts/check-grade9-plan-sql-local.mjs
npm.cmd run sql:check
```

The local check applies preserved v1-v12 in disposable PostgreSQL (PGlite), adds
v13, reruns Grade 9 onboarding and the six other branch regression checks, then
runs rollback-only plan access/validation fixtures. Cases cover original
shortlist preservation, persistence/reload, stale revisions, unknown/duplicate
subjects and pathways, forged ownership, direct/anonymous writes, cross-owner
reads, other-stage writes, empty/fake acknowledgements, and unchanged onboarding
and academic records.

**Live status, 21 October 2026:** applied to VIA `yalwuksprhgvtcmtysmz` after
checking v12 prerequisites and confirming v13 was absent. Live rollback-only
`grade9_dashboard.sql` verification passed. Before/after counts stayed at five
onboarding rows, four academic records and five uploaded originals. The plan
table remained empty after verification, confirming test writes rolled back.
The live security advisor reported no error-level findings. Do not rerun v13 on
this project. Live signed-in browser behaviour is separate from the local
browser tests described below.

## Pages and browser checks

The current Grade 9 dashboard shell remains, with Home as a compact summary.
Detailed results, Subject Choices, Study Pathways, Next Steps and VIA Assist use
their own `/dashboard/...` routes and active sidebar links. Home does not fetch
the programme catalogue or report history. Maths and science comparisons cite
DBE CAPS; APS and subject-change guidance describes institutional and school
variation. VIA Assist contains searchable authored explanations.

`npm run test:grade9:browser` uses the real Supabase browser SDK with intercepted
HTTP backed by disposable v1–v13 SQL. It verifies routes, actual report deltas,
shortlist add/remove/reload, failed-save retry, explicit review/exploration, and
readiness changing with saved actions. It checks all six pages at 375, 430, 768,
1024, 1280, 1440 and 1920 px plus short mobile/laptop heights (54 layouts), mobile
keyboard navigation and a 375×360 form viewport. No live accounts are created.

The results page reads only saved history and original files; it does not invent
Grade 8 reports or missing terms. Existing structured storage admits Grades 9–12;
earlier uploaded originals remain private and preserved. Results readers also
support Grade 8 structured records if they become available later.
