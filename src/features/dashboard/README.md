# VIA dashboard content update

The approved dashboard structure and styling are retained: the existing sidebar
shell, mint/glass materials, search/profile/notification controls, journey art,
summary-card markup, three lower cards, responsive rail/mobile drawer and native
detail dialog. This update changes navigation groups and the information shown.

## Data

`services/dashboard.ts` reuses the existing Supabase onboarding loader. Account
name/email still come from the existing auth provider. No schema, auth config,
onboarding screens, images, global styles or routes were changed.

| Dashboard content | Source |
| --- | --- |
| Study stage/grade | Saved `answers.current_id` and its active catalog label |
| Main pathway | First saved study goal, otherwise first saved interest |
| Subjects and percentages | Valid saved subject results joined to the catalog |
| Uploaded reports | Authenticated user's existing private report metadata |
| Setup banner | Actual saved completion and required-answer validity |
| Missing-results banner | Complete setup with no valid entered subject results |
| Application basics | Saved setup/results/interests; never an eligibility claim |
| Suggested next actions | Known profile gaps, academic focus areas and grade priorities |
| Programme/funding matches, saved opportunities | Unavailable until verified services exist |

Unavailable sources use `null`, not fabricated empty counts. The current service
does not query nonexistent tables. It exposes typed interfaces for future
calculated programme matches, funding, saved opportunities and progress tasks.
Verified programme matches can be sorted/displayed up to three, with available
scores/reasons; no example programmes, scores or counts are loaded in production.

Tasks currently show **suggested next actions**, not assigned tasks. There are no
fabricated dates or local-only completion checkboxes. A future persisted task
source can provide actual dates. Notification text points to VIA Progress.

## Grade priorities

One shared configuration supports Grade 9 subject choices, Grade 10 academic
trajectory, Grade 11 results/preparation, and Grade 12 application basics. The
current onboarding catalog groups Grade 9–10 into one choice. The dashboard
preserves this ambiguity and uses an early-stage configuration; it does not guess
an exact grade. Separate Grade 9/10 labels can use their respective configurations
when exact grade data becomes available. No subject recommendations or admission
requirements are invented.

Academic badges are a transparent study-planning heuristic: Strong >=70%, On
track 50–69%, Focus area <50%. The card explains these bands and that programme
requirements vary. They are not APS, pass/eligibility or admission assessments.

## What-If

Focus-area actions and relevant next moves open the existing native detail
dialog. Learners can choose a saved subject and adjust a hypothetical target.
The baseline remains the saved result. The scenario is local and read-only;
it writes no marks, goals or opportunities to Supabase. Opportunity comparisons
remain explicitly unavailable until a matching service can provide real results.

## Navigation

Home; MY JOURNEY (VIA Match, VIA Scan, VIA Progress); EXPLORE (Institutions,
Programmes, Funding, Accommodation); TOOLS (VIA Vault). VIA Assist keeps its
prominent card and Settings is near the bottom. Existing tablet rail and native
mobile drawer are reused. Longer sidebars remain scrollable at short heights.

Public explorer routes are not implemented in the current codebase. Their
sidebar actions open the existing-style detail dialog with honest availability
states and links to relevant saved preferences. This update does not add broken
routes or build unrelated public directory pages. VIA Scan/profile/preferences
actions link to the existing working onboarding screens.

## Changed files

- `pages/DashboardPage.tsx`: retain existing dashboard markup/artwork; replace
  sample data, update search/cards/banner/details, connect real next actions.
- `pages/DashboardPage.css`: scoped styles for nav headings, result rows,
  What-If controls, wrapping and responsive content; retain existing materials.
- `components/DashboardSidebar.tsx`: extract/reuse sidebar content with groups.
- `components/AcademicSnapshot.tsx`: real subject results and empty/error states.
- `components/WhatIfExperience.tsx`: local hypothetical-result exploration.
- `services/dashboard-model.ts`: reusable grade-aware data/view derivation.
- `services/dashboard.ts`: existing Supabase data adapter and unavailable sources.
- `services/useDashboard.ts`: loading/errors/retry, refresh on focus, user isolation.
- `services/feature-details.ts`: data-backed detail-dialog content and actions.
- `tests/dashboard.test.mjs`: data integrity, missing information, grade logic,
  retired choices, read-only derivation and match-score validation.
- `scripts/check-dashboard-browser.mjs`: fixture-based functional and responsive
  browser checks; no real user writes or uploads.
- `scripts/check-auth-browser.mjs`: cover the dashboard's onboarding read queries
  in authentication regression fixtures.
- `package.json`: dashboard verification scripts, no new dependencies.
- `src/features/dashboard/README.md`: this implementation record.

No SQL is required for this update. Existing SQL versions remain unchanged.

## Verification

```text
npm run test:dashboard
npm run test:dashboard:browser
npm run test:auth:browser
npm run build
npm run lint
```

Browser checks use mocked Supabase HTTP responses against the running app at
`http://localhost:5175` (`VIA_TEST_ORIGIN` overrides it). Chrome can be configured
with `CHROME_PATH`. They exercise complete Grade 11/12, missing-results and
incomplete-setup states at 375, 430, 768, 1024, 1280, 1440 and 1920 pixels, plus
shorter mobile/laptop heights. Screenshots/reports are saved locally under
`node_modules/.tmp/via-dashboard-content-qa`.

Verification on 16 October 2026: six dashboard model tests passed; 36 dashboard
layouts and nine What-If dialog layouts passed with no runtime errors or data
writes. The checks also covered sidebar/mobile navigation, keyboard focus and
Escape, error/retry states, real-field search, conditional banners, and exact
Grade 9/10 versus the combined early-stage choice. Authentication regression
flows and their 36 responsive cases passed. Onboarding/auth unit tests and SQL
release consistency checks passed. Production build passed; lint retains one
existing warning in LandingPage.tsx, and Vite retains its bundle-size advisory.
Browser tests used fixtures; they did not alter or inspect the owner's private
learner records through a live login.
