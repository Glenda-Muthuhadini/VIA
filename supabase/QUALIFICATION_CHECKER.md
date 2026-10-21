# Public qualification checker — v6 history

The current UI and connected catalogue use v7 plus the v8 link correction.
See [CONNECTED_DISCOVERY.md](CONNECTED_DISCOVERY.md) for current installation,
Grade 9–12 behavior and verification. This document preserves the v6 foundation;
its 40-record counts, two-grade UI and original RPC describe that earlier release.

## Installation and SQL history

Use **`sql/public_qualification_setup_v6.sql` once, directly after v4**.
The owner reported PASS for `tests/public_qualification.sql` after applying v6.
Read-only live checks separately confirmed ten published records per category
and correct qualification RPC results. Do not rerun an applied setup release.

`public_qualification_setup_v5.sql` is retained as a **failed release** for history.
It contained an unterminated string in the institution seed; its transaction did
not apply. Do not run v5. v6 contains the qualification foundation migration
`20261017000900_public_qualification.sql` and the corrected catalogue migration
`20261017001100_verified_discovery_catalogue_fix.sql`. The failed seed migration
`20261017001000_verified_discovery_catalogue.sql` is retained but excluded from v6.
For this repository's manual SQL Editor workflow use numbered bundles, not a
blind replay of every migration file. Older releases v1–v4 remain unchanged.

`npm run sql:check` checks that every historical bundle matches its source files;
that is a history check, not a claim that the failed v5 can execute.

## Data and official sources

The release input is `catalogue/public_catalogue_v5.json`, used only to prepare
database SQL. React never imports it and has no production fallback dataset.
Existing IDs are preserved so saved opportunities continue to work.

* Institutions: Wits, UCT, UP, False Bay TVET College, UJ, CPUT, DUT, UNISA,
  Nelson Mandela University and TUT.
* Programmes: the existing six computing programmes plus four UJ Mathematical
  Sciences combinations: Mathematics and Computer Science, Mathematics and
  Informatics, Mathematics and Mathematical Statistics, and the Financial
  Orientation combination.
* Funding: NSFAS, Funza Lushaka, Sasol Mainstream, SANRAL External, Transnet,
  ISFAP, Allan Gray Fellowship, Thuthuka, IDC External and CSIR.
* Accommodation: South Point KSI, Melridge House, 46 De Korte, 56 Jorissen,
  66 De Korte, 90 De Korte, Argon House, B-Hive, Blackburn House and Clifton Heights.

Every record retains official source URLs, names and verification dates.
New entries were reviewed on 17 October 2026. Previously verified 16 October
records retain their actual verification timestamps. Unknown scalar facts are
NULL; empty existing-schema arrays mean no verified values to display.
No unverified price, live room availability, distance or NSFAS approval was added.
Existing 2026 residence prices remain explicitly historical snapshots.

Primary admissions sources are each UJ programme page and the
[official 2027 prospectus](https://www.uj.ac.za/wp-content/uploads/2026/07/uj_undergrad_prospectus2027_online_25jun2026.pdf),
printed pages 16 and 89. The prospectus gives the six-subject APS system and the
four programme thresholds. Other sources are linked individually in the data.

`catalogue/link_verification_v5.json` records the separate direct HTTPS audit:
41 of 59 destinations succeeded; 18 returned access blocks or connection errors.
UJ/UP returned anti-bot pages. CPUT, NSFAS, Funza, Transnet's application portal
and the ISFAP application portal failed the direct connection check. Their URLs
were corroborated with official source pages/search indexing, but uninterrupted
access from a learner's browser must not be claimed on that basis. There were
no invented replacement URLs. The report preserves the limitations for review.
The separate `catalogue/browser_link_review_v6.json` records browser follow-up:
CPUT's Apply Online page, Funza Lushaka and the NSFAS FAQs rendered readable
provider content. Nine UJ/UP destinations showed security challenges; six other
destinations produced partial/empty content during the check. Those fifteen are
not certified as working by the browser audit.

## Conservative eligibility engine

`via_admission_rules` stores programme/intake-specific rules, required subject
alternatives and percentages, scoring system, completeness, endorsement and
source metadata. Rules are admin-published; browser roles cannot write them.
`check_public_qualification` is a security-invoker, read-only RPC. It never saves
submitted marks and returns bounded pages from each result category.

Currently supported: the four verified 2027 UJ combinations, using NSC/IEB
achievement ratings for exactly six academic subjects, excluding Life Orientation.
Mathematics must be at least 70%, English HL/FAL at least 60%, with APS 31 or 33
according to the programme. The learner must confirm NSC/IEB Grade 11/12 results,
marks, and bachelor endorsement. Additional-subject combinations, other
qualifications, missing subjects, unconfirmed endorsement, missing rules and
unsupported intakes produce an unknown/check-institution result, not approval.
Alternative Mathematics/literacy and English or Afrikaans HL/FAL cannot double
count. A higher APS never compensates for a mandatory subject failure.

“Close matches” means exactly one evaluated requirement is not met, with all
others known. Every failed check and actual/required value is shown. Multiple
failures appear under Requirements not met. Unknown rules are kept separate.
No personal match percentage, guaranteed admission or funding eligibility is
generated. Deadlines and selection remain the institution's responsibility.

## UI, uploads and privacy

The existing landing Check What I Qualify For button opens the checker directly.
Institutions/Programmes have a checker entry point, and programme detail CTAs open
the same modal. `/programmes?check=1` opens it directly, without requiring login.
Viewing a result opens the existing programme detail/application experience.
Funding detail CTAs save/unsave using existing owner-only saved opportunities.

The manual subject/mark editor is extracted from ManualResultsDialog and shared
with onboarding. Its onboarding save behavior remains unchanged. Public subjects
and available intake years come from Supabase. Logged-in users can copy their
current saved results or use different marks; calculations never update official
academic records or onboarding answers. Account changes unmount and clear the
checker state. No learner marks are put in URLs or persistent browser storage.

The compact popup starts with three equal method cards and no result fields.
Manual entry opens only after choosing that method. Upload/photo methods open an
editable review after extraction. Switching methods cancels pending extraction;
closing or changing accounts clears temporary files and marks. Grade 11/12 is a
two-button choice. The three former confirmation checkboxes are removed; pressing
the submit button checks the reviewed results. Results display only verified meets.

The existing qualification RPC, institution APS and subject thresholds remain
unchanged. Instead of asking a learner to assert a bachelor pass, the UI supplies
a conservative academic threshold from seven entered subjects: six academic
subjects plus Life Orientation, all at least 30%, four academic marks at least
50%, two language subjects, and a Home Language at least 40%. Incomplete sets cannot claim a pass.
This is an academic preview, not certification or guaranteed admission. Source:
[DBE NSC requirements](https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/tabid/338/Default.aspx).

Logged-in uploads reuse `uploadReport`, the private `via-school-reports` bucket and owned
`via_onboarding_reports` metadata. PDF/JPG/PNG up to 10 MB are accepted. The photo
input requests `capture="environment"`, with a file picker where camera capture
is unsupported. Guests can also select reports/photos without login: the file is
held in browser memory with an open-report link, never uploaded to Supabase or
persisted. The object URL is revoked on replacement, account change or closing.
Only saving a report to a VIA account requires login; checking stays public.

PDF.js reads text PDFs and renders scanned PDF pages. Tesseract.js performs real
OCR for PNG/JPG photos and scanned pages, entirely in browser workers. Runtime
files and the English recognition model are served locally by VIA, prepared from
npm dependencies by `scripts/prepare-report-reader.mjs` before dev/build. No OCR
API key, external document-processing service or SQL migration is needed. The
reader is lazy-loaded only when a file is selected. Reports are limited to 10 MB
and PDFs to five pages; images are bounded before OCR to limit mobile memory.
Exact catalogue labels and safe aliases map detected subjects to database IDs.
Multiple mark columns, conflicting values and ambiguous languages are left blank
or unmatched, never guessed. Every detected result is editable before submission.

## Verification commands and limits

* `npm run build`, `npm run lint`, `npm run test:qualification`.
* `npm run check:qualification`: read-only checks against the real Supabase project.
* `npm run test:qualification:browser`: actual text-PDF, scanned-PDF, PNG and JPG
  extraction from synthetic reports, live qualification RPC, manual entry,
  cancellation/error states and nine responsive viewports; no private writes.
* `node scripts/check-discovery-browser.mjs --functional-v6 --checker-only`:
  the above suite plus saved-result reuse and authenticated private upload/failure
  behavior with intercepted private writes. Omit `--checker-only` for catalogue QA.
* `npm run check:discovery:links`: repeat the external HTTPS availability audit.
* `npm run test:qualification:sql`: execute v1–v4 + corrected v6, qualification,
  discovery, adaptive and legacy tests in disposable PostgreSQL/WASM. For a fresh
  checkout first install the test engine outside application dependencies:
  `npm install --prefix node_modules/.tmp/via-sql-validation --no-save --package-lock=false @electric-sql/pglite`.

The disposable PostgreSQL SQL tests and owner-run live SQL tests passed. Live
read-only checks passed for 40 records, positive APS 36 outcomes, Mathematics 66%
failures, endorsement/intake restrictions and invalid marks. Private storage
transport is intercepted in browser automation and needs a separate real-account
manual confirmation; it must not be described as a live upload test. Native camera
hardware is not available to headless Chrome, so only capture configuration and
photo-file selection can be automated. External blocked sites remain a separate
verification limit, not a reason to fabricate destinations.

## Files changed for this feature

| Files | Change |
| --- | --- |
| `src/components/academic/SubjectResultsEditor.tsx` | Shared controlled subject/mark fields extracted from the existing manual-results dialog. |
| `src/features/onboarding/components/ManualResultsDialog.tsx` | Reuses the shared editor; keeps onboarding save, grade and navigation behavior. |
| `src/features/discovery/components/QualificationChecker.tsx`, `qualification.css` | Public accessible checker, real uploads/manual entry, saved-result reuse, result explanations and responsive dialog styling. |
| `src/features/discovery/services/qualification.ts`, `qualification-input.ts` | Public metadata/checker RPC, owner-only academic reads and input validation. |
| `src/features/discovery/pages/DiscoveryPage.tsx` | Checker entry points, URL/auth return state and programme handoff. |
| `src/features/discovery/components/OpportunityDetails.tsx` | Real qualification CTA and funding save/unsave CTA. |
| `src/features/landing/pages/LandingPage.tsx` | Existing qualification button opens the working modal. |
| `supabase/migrations/20261017000900_public_qualification.sql` | Published admissions rules and read-only checker/subject RPCs. |
| `supabase/migrations/20261017001000_verified_discovery_catalogue.sql` | Preserved failed seed release; not included in corrected v6. |
| `supabase/migrations/20261017001100_verified_discovery_catalogue_fix.sql` | Corrected 40-record database seed preserving existing opportunity IDs. |
| `supabase/sql/public_qualification_setup_v5.sql`, `public_qualification_setup_v6.sql` | Failed historical release and corrected paste-ready release. |
| `supabase/catalogue/public_catalogue_v5.json`, `link_verification_v5.json`, `browser_link_review_v6.json` | Database-release source data and honest external-link audit reports; never frontend fallbacks. |
| `supabase/tests/public_qualification.sql`, `public_discovery.sql` | Qualification/security assertions and catalogue-size-independent filter regression. |
| `scripts/prepare-discovery-v5.mjs`, `build-discovery-catalogue.mjs`, `build-supabase-sql.mjs` | Catalogue preparation, immutable seed generation and numbered SQL bundles. |
| `scripts/check-qualification-live.mjs`, `check-qualification-sql-local.mjs`, `check-discovery-links.mjs`, `check-discovery-browser.mjs` | Live public checks, disposable PostgreSQL regressions, URL audit and browser/SDK scenarios. |
| `tests/qualification.test.mjs`, `package.json` | Input/data-integrity tests and verification commands; no application dependencies added. |
| `supabase/README.md`, `PUBLIC_DISCOVERY.md`, `QUALIFICATION_CHECKER.md` | Current installation, failed-version history, source limits, behavior and exact-file inventory. |

The compact extraction update additionally changes `QualificationChecker.tsx`,
`qualification.css`, `package.json`, `package-lock.json`, `.gitignore` and the
browser runner. New files: `src/features/discovery/services/report-reader.ts`,
`report-results.ts`, `scripts/prepare-report-reader.mjs`,
`scripts/check-report-reader-browser.mjs`, and `tests/report-results.test.mjs`.
The shared onboarding editor, existing pages and database SQL are unchanged by
this update. Generated `public/vendor/report-reader/` assets are ignored by Git
and regenerated before development/production builds.
