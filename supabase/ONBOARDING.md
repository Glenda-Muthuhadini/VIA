# Database-backed VIA onboarding

## Apply SQL

The existing auth setup v1 is a prerequisite. Run the entire
**[sql/onboarding_setup_v2.sql](sql/onboarding_setup_v2.sql)** file **once** in the
same project's Supabase SQL Editor. The release wraps both new migrations in a
single transaction. It does not alter the existing auth table, credentials or
signup trigger. Do not replay the creation migration after it has succeeded.

The owner confirmed applying v2 on 16 October 2026. Keep this release and all
previous SQL versions; future database changes require a new migration/release.

Then run:

1. **[sql/verify_onboarding_setup.sql](sql/verify_onboarding_setup.sql)** — read-only
   checks for tables/RLS, catalog counts, private bucket and privileges.
2. **[tests/onboarding.sql](tests/onboarding.sql)** — transactional integration
   test of saving, revision conflicts, invalid/removed choices, invalid marks,
   foreign/missing reports, completion, owner isolation and anonymous denial.
   It creates temporary test users inside a rolled-back transaction and sends
   no emails. The last result should say **PASS**.

## Data model

- `via_onboarding_options`: one database-owned catalog of active choices, labels,
  descriptions, display order and icon/tone keys. It contains the existing VIA
  options plus study-interest labels, provinces and school subjects. These labels
  are not verified institution programmes, admission requirements or matches.
- `via_onboarding`: one private draft per Auth user, with structured JSON answers,
  resume step, revision, completion timestamp and server-managed save timestamps.
- `via_onboarding_reports`: private upload metadata owned by each user.
- `via-school-reports`: private Storage bucket; PDF/JPG/PNG, maximum 10 MB.
  Object paths start with the authenticated user's ID. No public report URLs.
- `save_my_onboarding`: the only client write path for answers. It derives the
  owner from `auth.uid()`, validates all selected IDs/categories and required
  steps, rejects invalid marks/unowned reports, and checks revisions atomically.
  Clients cannot supply a different owner or write completion directly.

Catalog editing is an admin operation. The browser can only read active choices.
Use the Supabase Table Editor to manage labels/order/active choices, and keep
schema/catalog releases versioned as migrations. Existing answers with retired
IDs are safely filtered on load; users must replace required obsolete choices.
Unknown database choices are never replaced with a hardcoded frontend catalog.
The fixed headings, button text and brand copy remain in React.

## How the flow works

- Fresh users have no preselected stage, interests, strengths, goals or institution
  types. The existing location default remains anywhere in South Africa.
- Edits autosave after a short debounce. Back, Continue, home and finish-later
  wait for outstanding saves before navigating. Failed saves retain the draft
  and show an actionable error. Closing the tab with unsaved changes warns the
  user. Personal onboarding answers are not copied into localStorage.
- Saves are serialized. A revision conflict from another tab requires reloading
  saved progress rather than silently overwriting it. Reload discards local edits.
- Save & finish later goes to the dashboard, which links back to VIA setup.
  The welcome page opens the saved step. Direct navigation cannot bypass missing
  required answers. Reports remain optional, matching the original Continue flow.
- Manual results entry validates subjects, duplicate subjects, 0–100 marks and
  an optional school/year. The modal supports keyboard focus/Escape and scrolling.
- Report selection/camera uploads store the actual file and metadata. Links are
  signed for five minutes and refreshed while the screen remains open. Failed
  metadata inserts clean up the unattached uploaded object.
- Build my VIA saves a validated completed record. The building screen verifies
  that record before advancing, rather than using a simulated timer. The ready
  summary reads the actual saved choices and subject count.

**OCR/matching limitation:** no report-extraction or programme-matching service is
configured. Uploaded files are stored, not silently parsed. The screen asks users
to enter marks manually. Ready/building screens no longer claim to have analysed
reports or generated institution matches. The separate existing dashboard sample
cards remain sample data; this change does not implement matching engines.

## Local checks

Start the existing app (`npm run dev -- --port 5175`), then run:

```text
npm run test:onboarding
npm run test:onboarding:browser
npm run test:auth
npm run test:auth:browser
npm run sql:check
npm run build
npm run lint
```

The browser runners use isolated Chrome/Supabase fixtures and never upload real
reports or change real accounts. Onboarding tests read the catalog fixture from
the canonical migration; they do not create a second production dataset.
`VIA_TEST_ORIGIN` and `CHROME_PATH` override the development URL/browser path.
Screenshots/reports are under `node_modules/.tmp/via-onboarding-qa`.

Live checks should use the existing account in the browser: save a choice, reload,
finish later, resume, upload an authorised report or enter manual results, build,
and verify the summary. Never send passwords or report contents to chat.

## Files changed for this integration

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Mount the onboarding provider around the existing routes |
| `src/features/onboarding/pages/WelcomePage.tsx` | Database journey labels and resume destination |
| `src/features/onboarding/pages/CurrentStepPage.tsx` | Database stage choices and real single selection |
| `src/features/onboarding/pages/InterestsStepPage.tsx` | Database interests and persisted multi-selection |
| `src/features/onboarding/pages/ResultsStepPage.tsx` | Real private upload/camera, manual entry and signed report links |
| `src/features/onboarding/pages/PersonalityStepPage.tsx` | Database strengths and persisted selections |
| `src/features/onboarding/pages/StudyPlanStepPage.tsx` | Database interest search and editable saved chips |
| `src/features/onboarding/pages/PreferencesStepPage.tsx` | Persisted preferences and database provinces/institution choices |
| `src/features/onboarding/pages/BuildingViaPage.tsx` | Verify saved completion instead of a timer/fake analysis |
| `src/features/onboarding/pages/ViaReadyPage.tsx` | Actual saved summary instead of fixed Technology data |
| `src/features/onboarding/context/onboarding-context.ts` | Typed shared onboarding state/hook |
| `src/features/onboarding/context/OnboardingProvider.tsx` | Loading, autosave, serialized writes, conflicts and route checks |
| `src/features/onboarding/services/model.ts` | Types, validation, safe restoration and resume rules |
| `src/features/onboarding/services/onboarding.ts` | Supabase queries, save RPC, private uploads and signed URLs |
| `src/features/onboarding/components/CatalogIcon.tsx` | Existing Lucide icons selected through safe catalog keys |
| `src/features/onboarding/components/OnboardingControls.tsx` | Functional Back/Continue/finish-later and save status |
| `src/features/onboarding/components/OnboardingHomeLink.tsx` | Wait for saves before leaving through the logo |
| `src/features/onboarding/components/OnboardingStatus.tsx` | Branded loading/retry states for onboarding |
| `src/features/onboarding/components/ManualResultsDialog.tsx` | Responsive native results-entry dialog |
| `src/features/onboarding/onboarding.css` | Scoped selected/control/dialog styles and responsive layouts |
| `src/features/dashboard/pages/DashboardPage.tsx` | Single setup/resume link; existing sample cards retained |
| `scripts/build-supabase-sql.mjs` | Preserve/check auth v1 and onboarding v2 releases |
| `scripts/check-onboarding-browser.mjs` | Functional and responsive browser tests |
| `scripts/check-auth-browser.mjs` | Reliable fixture headers and session reset for regression tests |
| `tests/onboarding.test.mjs` | Restore/validation/resume tests |
| `tests/onboarding-fixture.mjs` | Test-only fixtures derived from the SQL catalog |
| `package.json` | Onboarding test commands; no added dependencies |
| `supabase/migrations/20261016000300_via_onboarding.sql` | Schema, access policies, storage and validated saving |
| `supabase/migrations/20261016000400_via_onboarding_catalog.sql` | Database catalog seed |
| `supabase/sql/onboarding_setup_v2.sql` | Paste-ready versioned upgrade |
| `supabase/sql/verify_onboarding_setup.sql` | Read-only setup checks |
| `supabase/tests/onboarding.sql` | Transactional database tests |
| `supabase/README.md` | Updated SQL version index |
| `supabase/ONBOARDING.md` | This setup guide and change manifest |

Existing auth SQL, credentials, landing page, shared UI components and global
brand styles were not changed by this integration.

## Verification record — 16 October 2026

- The owner applied onboarding v2 and returned the expected privilege results.
- The owner reported **PASS** for the transactional database test.
- Five model/validation tests and four authentication tests passed locally.
- Mocked browser tests passed the full onboarding journey, restore/autosave,
  manual marks, upload/metadata, editable goals, preferences, finish-later/resume,
  completion, failed saves, conflict handling and load retries.
- Auth browser regression tests passed, including 36 responsive cases.
- Browser layout checks covered all nine onboarding routes at seven widths and
  two shorter heights, plus expanded provinces and the manual dialog at those
  nine sizes: **99 onboarding layout cases passed**. Dialog save actions remained
  reachable by scrolling at short heights; Escape closed the dialog correctly.
- Short laptop spacing was checked in the browser. Longer forms, expanded
  province choices, uploads/status messages and limited heights may still scroll;
  their controls remain accessible. Desktop layouts are not forced to clip.
- Production TypeScript/Vite build passed. SQL release checks passed. Lint has
  the existing landing-page Date warning; Vite has its existing size advisory.
- These browser uploads used fixtures. A real private report upload/download was
  not independently verified against this account; no report was requested from
  the owner or uploaded on their behalf. Camera capture needs a physical device.
- OCR and programme matching remain outside this implementation, as stated above.

## References

- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Storage access controls](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
