# Complete VIA onboarding — v11

The Grade 9 branch described in this historical release is superseded by
[Grade 9 onboarding v12](GRADE9_ONBOARDING.md). The six other branches below
retain their v11 flow. Keep v11 applied before adding v12.

This release implements the supplied complete onboarding flow. The initial stage
picker contains Grade 9, Grade 10, Grade 11, Grade 12, Finished school / Taking a
gap year, Accepted / Starting higher education, and Currently studying at a
university or college. Graduate is retained as a progression stage rather than an
eighth initial choice.

| Stage | Questions, in order |
| --- | --- |
| Grade 9 | Results; interests; career interests |
| Grade 10 | Subjects; results; interests; career interests |
| Grade 11 | Subjects/results; study interests; programmes; study location |
| Grade 12 | Grade 11 final results (additional Grade 12 results supported); study interests; study location; applications; funding |
| Finished school / Gap year | Matric year; final results; current activity; study interests; location; applications; funding situation |
| Accepted | Institution; programme; campus; starting year; funding; accommodation; registration |
| Current student | Institution; campus; programme; year of study; funding; support |

All branches end with their stage-specific completion copy and **Go to My
Dashboard**. Required questions accept explicit uncertainty where the supplied
flow allows it. Applications expand only for applicants who say they have applied,
with institution, programme and status rows. Save & finish later remains available.

## Data and progression

`via_onboarding.flow_version = 4` stores the new answers in `journey_answers`.
The legacy `answers` column, private reports, academic records and older SQL
releases are preserved. The upgrade snapshots existing records and retains
completed profiles, avoiding a forced repeat of onboarding.

Institution and programme selectors read the existing public catalogue. Campus
options come from actual offerings. If a programme or campus is absent, the
accepted/student forms allow the user to enter its name. No institution, campus,
programme URL or result is invented. Fixed interest/funding/support choices follow
the supplied flow; career choices are a starter list, with an explicit unsure option.

Stage changes snapshot the previous profile and carry known answers that apply
to the next branch. A new school grade requests its new results while keeping
earlier marks in `via_academic_records` / `via_academic_results`. Existing Grade 11
final results can satisfy the Grade 12 baseline. Accepted students retain their
confirmed institution, programme and campus when becoming current students.
Unconfirmed funding is requested again rather than treated as confirmed funding.

Current students can update their year of study from their dashboard profile.
That update returns to the dashboard and snapshots the previous year without
repeating support or institutional questions. The stage screen offers current
students a Graduate transition. No annual reset runs automatically.

The RPCs derive ownership from `auth.uid()`, lock revisions, validate catalogue
IDs and report ownership, and reject completion with missing required answers.
Old clients cannot overwrite a version 4 profile through legacy save RPCs.

## Apply to the connected project

1. Confirm releases v1, v2, v3, v4, corrected v6, v7, v8, v9 and v10 are already
   applied, in that order. v5 is the preserved failed release and should be skipped.
2. Run [sql/complete_onboarding_setup_v11.sql](sql/complete_onboarding_setup_v11.sql)
   once in Supabase SQL Editor as the project owner. Its only new migration is
   `20261020001700_complete_journey_onboarding.sql`.
3. Run [tests/complete_onboarding.sql](tests/complete_onboarding.sql). Its fixture
   accounts, reports and answers roll back; it sends no email and stores no passwords.
4. Reload the app and verify a signed-in onboarding session against Supabase.

**Status:** the migration and access-policy tests have been executed in disposable
PostgreSQL locally. Browser auth, uploads and saves were intercepted with test
fixtures. This release has **not** been applied to or verified against the
connected Supabase project; privileged database access is not available in this
workspace. Do not deploy the new frontend against the old schema without v11.

## Verification

- `npm run test:journey` — branch order, uncertainty, application requirements,
  carried-step navigation, restoration and relevant dashboard priorities.
- `npm run test:journey:sql` — earlier released SQL plus v11 in disposable
  PostgreSQL; legacy profile upgrade, seven branches, completion, revision
  conflicts, catalogue IDs, private reports/history, academic preservation,
  accepted/student progression, year updates and Graduate.
- `npm run test:journey:browser` — running app on port 5175 (override with
  `VIA_TEST_ORIGIN`), Chrome, all branch screens at 375, 430, 768, 1024, 1280,
  1440 and 1920 pixels, plus short mobile/laptop heights. It checks manual
  dialogs, full navigation, actual marks entry, upload, save failure/retry,
  additional Grade 12 results and safe cancellation, a reduced keyboard viewport,
  and changing student year without repeating onboarding.
- `npm run build`, `npm run lint`, `npm run sql:check`.

Browser artifacts: `node_modules/.tmp/via-journey-qa`. No real users, reports or
database writes are created by the browser checks.
