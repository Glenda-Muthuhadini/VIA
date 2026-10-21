# Adaptive onboarding implementation report

## 1. Files created

| File | Purpose |
| --- | --- |
| `src/features/journey/journey.ts` | Shared nine-stage VIA journey. |
| `src/features/onboarding/config/education-stages.ts` | Seven canonical stages, labels, journey focus and dashboard categories. |
| `src/features/onboarding/config/flows.ts` | Grade 9, legacy compatibility and pending-branch configurations. |
| `src/features/onboarding/services/flow-engine.ts` | Active steps, conditions, previous/next, progress, optionality and valid resume. |
| `src/features/onboarding/components/OnboardingProgress.tsx` | Flow-driven progress using existing visual treatments. |
| `src/features/onboarding/components/OnboardingStepLayout.tsx` | Shared existing background/header/panel/navigation layout. |
| `src/features/onboarding/pages/AdaptiveChoicePage.tsx` | School subjects, future curiosity and pending branch screens. |
| `supabase/migrations/20261016000500_adaptive_onboarding_foundation.sql` | Canonical profiles, versioning, history, structured saves and access policies. |
| `supabase/migrations/20261016000600_grade9_catalog.sql` | Database-backed Grade 9 interest, activity and curiosity choices. |
| `supabase/sql/adaptive_onboarding_setup_v3.sql` | Paste-ready transaction containing both migrations in order. |
| `supabase/sql/verify_adaptive_onboarding_setup.sql` | Read-only schema and permission inspection. |
| `supabase/tests/adaptive_onboarding.sql` | Rolled-back database integration/security tests. |
| `supabase/ADAPTIVE_ONBOARDING.md` | Architecture, rollout, compatibility and verification documentation. |
| `supabase/ADAPTIVE_IMPLEMENTATION_REPORT.md` | This scope and file inventory. |
| `tests/adaptive-fixture.mjs` | Test-only catalog fixture derived from canonical migrations. |
| `tests/adaptive.test.mjs` | Adaptive navigation, branching, canonical stages and dashboard tests. |
| `scripts/check-adaptive-browser.mjs` | Intercepted Supabase browser flows and responsive/accessibility checks. |

## 2. Files modified

| File | Change |
| --- | --- |
| `src/App.tsx` | Added protected school-subjects, future-curiosity and pending routes. |
| `src/features/auth/services/profile.ts` | Loads canonical education stage and confirmation flag. |
| `src/features/auth/services/redirects.ts` | Allows new owned onboarding routes in safe authentication redirects. |
| `src/features/onboarding/services/model.ts` | Adaptive fields, catalog applicability, steps and safe normalization. |
| `src/features/onboarding/services/onboarding.ts` | Loads canonical profile and stage-specific structured data; uses guarded v3 RPCs while retaining v2 support. |
| `src/features/onboarding/context/onboarding-context.ts` | Exposes flow/stage selection and skipped-step save operations. |
| `src/features/onboarding/context/OnboardingProvider.tsx` | Extends existing queued autosave/revisions with stage changes, tracking and applicable-route guards. |
| `src/features/onboarding/components/OnboardingControls.tsx` | Flow-driven Back/Continue/Skip; retained Save & finish later. |
| `src/features/onboarding/components/CatalogIcon.tsx` | Supports shared journey icons using existing Lucide package. |
| `src/features/onboarding/components/ManualResultsDialog.tsx` | Optional Grade 9 report metadata; retained manual marks and accessible native dialog. |
| `src/features/onboarding/pages/WelcomePage.tsx` | Shared journey, dynamic progress and valid resume. |
| `src/features/onboarding/pages/CurrentStepPage.tsx` | Exact seven-stage selector, immediate save and legacy confirmation notice. |
| `src/features/onboarding/pages/InterestsStepPage.tsx` | Grade 9 copy/options and dynamic progress/navigation. |
| `src/features/onboarding/pages/PersonalityStepPage.tsx` | Grade 9 activities copy/options and dynamic progress/navigation. |
| `src/features/onboarding/pages/ResultsStepPage.tsx` | Grade 9 heading, existing-report selection and flow-driven controls. |
| `src/features/onboarding/pages/StudyPlanStepPage.tsx` | Dynamic progress/navigation for retained legacy flow; existing content preserved. |
| `src/features/onboarding/pages/PreferencesStepPage.tsx` | Dynamic progress/navigation for retained legacy flow; excluded from Grade 9. |
| `src/features/onboarding/pages/BuildingViaPage.tsx` | Checks real persistence with Grade 9-appropriate status content. |
| `src/features/onboarding/pages/ViaReadyPage.tsx` | Branch-specific copy, saved summaries and completion CTA/destination. |
| `src/features/onboarding/onboarding.css` | Scoped adaptive grids, subject-list scrolling, responsive controls and spacing. |
| `src/features/dashboard/services/dashboard-model.ts` | Uses canonical profile stage; Grade 9 Subject Guide priority; excludes hidden/skipped inputs. |
| `src/features/dashboard/services/feature-details.ts` | Honest Subject Guide placeholder showing actual saved information. |
| `src/features/dashboard/pages/DashboardPage.tsx` | Shared journey and Subject Guide dialog handoff; existing cards/art/sidebar preserved. |
| `src/features/dashboard/pages/DashboardPage.css` | Responsive nine-stage markers retaining the frosted treatment. |
| `scripts/build-supabase-sql.mjs` | Adds immutable v3 bundle generation/checking; old releases unchanged. |
| `scripts/check-dashboard-browser.mjs` | Canonical-stage fixtures and expectations; preserves regression coverage. |
| `scripts/check-onboarding-browser.mjs` | Runs the consolidated adaptive and legacy compatibility browser suite. |
| `tests/dashboard.test.mjs` | Canonical-stage fixtures and assertions instead of display-label inference. |
| `package.json` | Adds adaptive unit/browser test commands. No dependencies added. |
| `supabase/README.md` | Adds ordered v3 upgrade and verification instructions. |

## 3. Migration

v3 contains migrations 00500 and 00600. Released auth v1, onboarding v2 and their
four migrations remain unchanged. `npm run sql:check` confirms all release bundles
match their sources. No Supabase credentials, storage bucket or authentication
configuration changed.

## 4. Supabase action

The owner confirmed **Adaptive SQL applied** and **PASS** from the adaptive SQL
tests. No additional SQL is required for the implemented scope. Retain v3 for
future fresh environments; apply after v1/v2, once per environment.

## 5. Architecture

One configuration/engine drives stage branching, conditional visibility,
navigation, progress, optional questions and resume. Existing provider queues,
revision conflicts and private report handling remain. New flows use normalized
stage-specific selections and versioned academic records. No unused tertiary
academic-management schema was introduced.

## 6. Grade 9

Welcome → Education stage → Interests → Activities → Results → School subjects
→ Future curiosity → Ready. Results support actual upload, manual entry and Skip.
All five Grade 9 questions are optional. The completion CTA opens the dashboard's
honest Subject Guide placeholder. University, funding and accommodation questions
are absent from the Grade 9 flow.

## 7. Legacy handling

Stable IDs current-2/3/4/5 map to grade_11/grade_12/post_matric/tertiary.
current-1 requires confirmation without guessing Grade 9/10. Old JSON, completion
history, users and report metadata remain. Existing mapped users retain the v2
flow; stage transitions activate v3. Returning to a stage restores retained
selections/academic data, while inactive and skipped answers stay out of the
current dashboard projection.

## 8. Dashboard

Reads profile.education_stage, never display labels. Grade 9 prioritises
"Build your Grade 10 subject plan" even without marks. Subject Guide shows saved
interests, school subjects and future curiosity. Academic Snapshot uses real
marks or its empty state. The nine-stage journey is shared with onboarding;
Grade 9 only emphasises Discover/Choose. Existing visual components remain.

## 9. Tests

20 unit tests: auth redirects (4), legacy onboarding model (5), dashboard (6),
adaptive engine/dashboard (5). Applied Supabase transaction suite: PASS confirmed
by owner. API health check verified auth enabled, reachable database API,
anonymous profile denial and expected invalid-login rejection.

Browser suites use intercepted Supabase fixtures, separately from the SQL tests:

- Adaptive: selections, private report upload, signed report UI, manual results,
  Back/Continue/Skip, finish-later, refresh/resume, logout/login, completion,
  stage transitions, legacy confirmation/flow, failed saves, revision conflicts
  and load-error retry. 90 page/viewport cases; manual-results and Subject Guide
  dialogs also checked at nine sizes. Route assertions, horizontal overflow,
  card overlap and control reachability checked.
- Dashboard regression: 36 layouts plus 9 What-If dialog layouts; search,
  conditional banners, mobile navigation and no fabricated account data.
- Authentication regression: 36 layouts plus login, signup/confirmation,
  recovery/reset, logout and protected-route behavior.

Widths: 375,430,768,1024,1280,1440,1920. Additional heights: 375×480 and 1280×650.
Screenshots/reports remain under node_modules/.tmp/via-adaptive-qa,
via-dashboard-content-qa and via-auth-qa. Browser fixtures do not modify real users.

## 10. Build, lint and typecheck

Production build and TypeScript checks pass. All unit suites pass. SQL bundle
checks pass. Lint completes with the pre-existing landing-page Date purity
warning. Production build retains the existing large-bundle warning.

## 11. Remaining limits

No OCR, subject recommendations, eligibility calculation or matching engine is
claimed. New Grade 10–Graduate branches intentionally remain pending. The legacy
v2 path remains available for mapped existing users. Short viewports and expanded
report details can scroll to keep every action accessible. Real-account UI
interaction was not automated; browser behavior used fixtures and database
semantics were verified by the applied SQL tests. No landing/auth visual redesign
or unrelated Supabase configuration changes were made.

## 12. Next task

Implement and independently verify the Grade 10 branch using the existing
adaptive engine and approved UI, then stop before expanding to Grade 11.
