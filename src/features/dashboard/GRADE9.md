# Grade 9 dashboard

The existing dashboard shell, profile guard and visual identity are preserved.
Home is a compact summary. Detailed content has its own route, with active
sidebar links on desktop and the existing navigation dialog on mobile:

| Page | Route | Purpose |
| --- | --- | --- |
| Home | `/dashboard` | One next action, result average, shortlist count and a compact Maths comparison link |
| My Results | `/dashboard/results` | Confirmed report, CAPS levels, insights, private originals, report history and progress |
| Subject Choices | `/dashboard/subject-choices` | Maths comparison, reflection, subject exploration, comparison and shortlist |
| Study Pathways | `/dashboard/study-pathways` | Subject combinations, saved interests, careers and university/UoT/TVET routes |
| Next Steps | `/dashboard/next-steps` | Eight planning actions, calculated readiness and one next recommendation |
| VIA Assist | `/dashboard/assist` | Searchable authored explanations and links to the right page |

Settings stays in its existing position. Other education stages retain their
current dashboards. Known, owner-matched account data and completed onboarding
are still required before rendering any dashboard.

Home shows an equal-weight average of actual recorded marks and the actual
shortlist count. It has one primary action and two small summary cards, with
translucent glass surfaces over a soft mint background. Subject lists, strengths,
areas needing attention, interests and planning detail stay in their own pages.
Home does not show the full results table, detailed recommendations, career
explorer or checklist. It does not fetch
programme requirements or report history. Detail pages load those sources when
needed. Missing information is labelled rather than replaced with demo data.

Sidebar pages use the same glass surfaces and progressive disclosure. Results
keeps confirmed marks and review visible, with history, strengths and progress
expandable. Subject Choices initially shows six compact subject cards and can
reveal the full catalogue; rationale appears when exploring a subject. Maths and
other comparisons expand on request. Study Pathways starts with one field's
careers and subjects, with routes and supporting discovery panels expandable.
Next Steps combines progress and the next action, with a single expandable
checklist. VIA Assist starts with four questions and search; answers appear on
selection. Deep links open their containing panels automatically. Expanding a
panel does not save or complete a planning action.

The subject shortlist is a plan, not confirmed Grade 10 subjects. V13 stores it
and explicit planning actions in owner-only `via_grade9_plans`, separate from
onboarding and confirmed academics. Opening pages does not complete actions.
Failed saves leave progress unchanged and expose retry. Changing the shortlist
clears final plan review; changing the saved results invalidates their older
review fingerprint. Existing onboarding shortlists seed the new plan.

Maths guidance uses DBE CAPS and official admissions examples. There is no
universal APS penalty for Maths Lit; specific subject requirements remain
separate from APS. The subject-switch discussion explains school approval,
deadlines and the difficulty of catching up in Mathematics. Guidance does not
choose for the learner or promise admission. `grade9-education.ts` records the
primary sources checked on 21 October 2026. VIA Assist is an authored guide,
not an external AI service.

Results history contains only actual owner records and signed private originals.
Same-subject changes use known academic years and report periods, not upload
dates. Missing terms and Grade 8 reports are never invented; earlier originals
remain preserved. Adding, scanning, uploading and manual results use the existing
Grade 9 review-and-confirm flow.

Verification:

```text
npm run test:grade9
npm run test:grade9:planning
npm run test:grade9:planning:sql
npm run test:grade9:browser
npm run test:grade10:browser
npm run test:auth:routing:browser
npm run build
npm run lint
```

The Grade 9 browser audit uses the actual SDK, intercepted HTTP and disposable
v1–v13 SQL. It covers all route links, persisted/reloaded plans, failure/retry,
actual report changes, reflection/comparisons and action-based readiness. All six
pages are checked at 375, 430, 768, 1024, 1280, 1440 and 1920 px, plus short
mobile/laptop heights (54 layouts); forms also use a 375×360 viewport. Artifacts
are under `node_modules/.tmp/via-grade9-qa`.

V13 was applied to VIA and its rollback-only SQL checks passed. See
`supabase/GRADE9_DASHBOARD.md` for live verification and deployment history.
Local browser tests are separate from a real learner signing in against Supabase.
