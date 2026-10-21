# Adaptive onboarding v3

Implemented scope: foundation, seven-stage selector, complete Grade 9 flow,
canonical dashboard integration and verification. Stop here before Grade 10.

## Apply and verify

Existing project: v1 and v2 were already applied. Apply the entire
`sql/adaptive_onboarding_setup_v3.sql` once. Do not rerun old releases.
The owner confirmed application and a PASS from `tests/adaptive_onboarding.sql`.
That transaction creates temporary users, then rolls everything back; no emails.
`sql/verify_adaptive_onboarding_setup.sql` provides read-only inspection.
No further database changes are required for this scope.

## Frontend architecture

`education-stages.ts` defines the seven stable values, labels, descriptions,
journey focus and dashboard categories. `flows.ts` separates implemented Grade 9,
existing v2 compatibility, and pending new branches. `flow-engine.ts` derives
visible questions, previous/next, optionality, progress, conditional visibility
and valid resume. Completion copy/destination belong to the flow configuration.

The existing provider keeps serialized saves, revisions, autosave, dirty-draft
warnings and failed-save recovery. The selector immediately persists the stage.
Shared progress and layout reuse the approved background, panels and option cards.
Grade 9 questions are optional; education stage is the only universal answer.
New unsupported branches stop on an honest pending screen without completion.
Mapped legacy users can continue the existing v2 flow without being forced into
an unimplemented branch. Selecting a different stage activates flow version 3.

Grade 9: Welcome → Stage → Interests → Activities/strengths → Results → School
subjects → Future curiosity → Ready. Building is a transient database check.
Back, Continue, Skip, finish-later and resume use the active flow. Results may be
entered manually or uploaded privately; upload does not claim OCR/analysis.
Previously uploaded reports remain selectable and use signed links.

The single shared nine-stage journey is Discover, Choose, Prepare, Match, Apply,
Fund, Stay, Study, Graduate. It is separate from wizard progress. Grade 9 only
emphasises Discover/Choose. Dashboard reads canonical profile.education_stage,
prioritises the Grade 10 Subject Guide even without marks, and displays actual
saved interests/subjects/curiosity in an honest placeholder. No recommendation,
eligibility, pathway-count or matching engine has been invented.

## Storage and legacy safety

Profiles contain education_stage and an explicit confirmation flag. Stable
legacy IDs map current-2→grade_11, current-3→grade_12, current-4→post_matric,
current-5→tertiary. current-1 remains unknown until the learner confirms.
Display labels never determine a learner's stage.

Legacy JSON answers are retained unchanged on adaptive saves and stage changes.
Existing rows are archived before migration; stage transitions and completions
also archive snapshots. Reports and their private storage policies are retained.
Stage-specific selections and academic versions persist independently of that
legacy JSON. Switching back restores available academic/selection history.
Only active stage data is projected into the dashboard; skipped fields are
excluded without deleting historical answers. Other stage inputs never fall
back to the legacy JSON in a v3 record.

New tables: via_onboarding_history, via_learner_selections,
via_academic_records, via_academic_results. Authenticated clients may read their
own rows, but write only through guarded functions. Functions validate catalog
IDs, active stage, applicable steps, ownership, marks, revision and completion.
Old clients cannot overwrite an adaptive row through the v2 save function.
No tertiary module, qualification or application-management schema was added.

## Verification and remaining scope

Run `npm run test:adaptive`, `test:onboarding`, `test:dashboard`, `test:auth`,
`test:adaptive:browser`, `test:dashboard:browser`, `test:auth:browser`,
`sql:check`, `lint` and `build`. Browser suites intercept Supabase requests;
the SQL suite separately exercises the applied database. They do not change a
real account. Browser artifacts are in node_modules/.tmp/via-adaptive-qa.

Responsive target widths: 375,430,768,1024,1280,1440,1920; additional 375×480
and 1280×650 cases. Long subject lists scroll inside the desktop panel; mobile
pages can scroll. Short screens and expanded report details may require scrolling
rather than clipping. Large image assets and the existing bundle size warning
remain outside this refactor. Lint's existing landing-page Date warning remains.

Next task: implement Grade 10 using this same engine and approved visual system.
Do not expand to Grade 11–Graduate before Grade 10 is independently verified.
