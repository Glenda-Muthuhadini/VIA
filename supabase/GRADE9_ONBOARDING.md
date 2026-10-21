# Grade 9 onboarding — v12

This update extends the existing version 4 onboarding provider, layouts, controls,
authentication and Grade 9 dashboard. The six other onboarding branches keep their
existing order, questions, validation and completion behaviour.

## Deployment

1. Use the Supabase project configured by `VITE_SUPABASE_URL` for VIA. Do not apply
   this release to another project returned by a CLI account.
2. Confirm v11 is applied. If necessary, follow the existing ordered setup in
   [README.md](README.md) first; do not rerun already-applied releases or failed v5.
3. For SQL Editor, run the [smaller v12 files](sql/grade9_v12_sql_editor/README.md)
   separately in numbered order, after v11. The combined
   [sql/grade9_onboarding_setup_v12.sql](sql/grade9_onboarding_setup_v12.sql)
   is 4.65 MB and may exceed the editor's query size limit; retain it for direct
   database execution instead. Choose one packaging, not both. The same new
   migrations are applied in order:
   - `20261021001800_grade9_confirmed_onboarding.sql`
   - `20261021001900_grade9_school_directory.sql`
4. Run [tests/grade9_onboarding.sql](tests/grade9_onboarding.sql). Its fixture
   accounts, answers, reports and saves roll back. It sends no email.
5. Reload VIA and verify a signed-in Grade 9 learner against that project.

**Connected-project status (21 October 2026):** v12 applied to VIA project
`yalwuksprhgvtcmtysmz` using the newly authorized CLI login and linked Management
API queries. Prerequisite checks confirmed the v11 journey function was present
and v12 objects were absent. All 14 SQL Editor parts succeeded in order.
The live rollback-only Grade 9 SQL tests passed, including confirmation,
ownership, conflicts and all six other branches. The directory contains 25,500
schools across all nine provinces. Before/after counts remained unchanged:
three completed onboarding rows, two academic records, zero academic results
and three original reports. No fixture users remained after rollback.
Do not rerun v12 on this project. A signed-in browser walkthrough against live
Supabase and physical phone camera capture remain separate checks; browser tests
below use intercepted HTTP calls and real local extraction.

The live security advisor completed without error-level findings. It reported
warnings for executable SECURITY DEFINER RPCs (including the authenticated
Grade 9 save RPC), existing public RPCs and disabled leaked-password protection.
The live SQL tests verified anonymous denial, owner isolation and rejection of
direct Grade 9 writes; these checks do not constitute a full security audit.

## Flow

Stage selection → school details → Grade 9 report/results → editable confirmation
→ subject experience → interests → Grade 10 choice status → conditional subjects
being considered → future clarity/areas → completion screen → dashboard.

- School: province, directory selection or manual name, CAPS/IEB/Other/unsure.
- Results: camera capture, PDF/JPEG/PNG upload up to 10 MB, or manual subject/mark
  entry. Current school details and confirmed report-school metadata are separate.
- Confirmation: Grade 9, school, academic year, period and editable subjects/marks.
  Duplicate subjects and marks outside 0–100 are rejected. A conflicting detected
  grade requires the learner to explicitly correct the detection.
- Experience loads confirmed subjects automatically; feelings are separate from
  percentages.
- Interests retain the supplied list and explicit uncertainty.
- Known/partly-known Grade 10 plans reveal the FET consideration list. Not yet/help
  skip it. These IDs never overwrite current Grade 9 academic subject IDs.
- Future clarity reveals broad area choices when appropriate. No specific career
  is required. Explicit uncertainty is accepted.
- Continue from the last question saves without completing. **Go to My Dashboard**
  performs validated completion, then navigates to the existing dashboard.

Back, autosave, Save & finish later, revision-conflict protection, saved answer
editing and resuming all use the existing provider and controls. Completed
pre-v12 Grade 9 users retain completion and academic data; they are not forced to
repeat onboarding. New Grade 9 saves cannot use the old v11 RPC to bypass review.

## Storage and permissions

| Information | Storage |
| --- | --- |
| Education stage | Existing `via_profiles.education_stage` |
| Current grade, school details, experience, planning and future areas | Owner-only `via_grade9_onboarding` |
| Unconfirmed editable extraction/manual draft | `via_grade9_onboarding.results_draft` |
| Original report | Existing private `via-school-reports` bucket and owner-only `via_onboarding_reports` metadata |
| Confirmed current academic data | Existing `via_onboarding.journey_answers` |
| Confirmed academic history and percentages | Existing `via_academic_records` / `via_academic_results` |
| Completion, current step and revision | Existing `via_onboarding` |
| Previous onboarding versions and completion snapshots | Existing `via_onboarding_history` |

Authenticated clients can read only their Grade 9 row and cannot directly insert,
update or delete it. The new RPC derives ownership from `auth.uid()`, validates
report ownership and catalogue IDs, locks revisions and confirms academic results
atomically. Uploading, extracting, autosaving a draft or editing current school
details cannot create academic results. Original files remain separate.

## Actual report processing

Grade 9 reuses the existing lazy-loaded PDF.js/Tesseract reader. PDF text layers
are read directly; scanned pages and JPEG/PNG images use actual local OCR.
Subject and percentage parsing is conservative. Metadata is identified from the
report text, with missing/ambiguous values left for the learner to supply.

The original is uploaded first, then a private resumable draft is saved before
processing. A learner returning during/after interrupted extraction can use
**Read Saved Report**. Extraction failure offers retry or manual correction;
it never inserts example marks. Corrections remain a draft until Confirm Results.

OCR runs in the browser using locally served workers, engines and the English
model prepared by `predev`/`prebuild`. There is no external OCR API and no new
private key or frontend environment variable. The existing public Supabase URL
and anonymous key remain the only browser connection configuration.

## School directory provenance

The seed contains 25,500 open institutions from the official DBE EMIS National
Quarter 3 of 2025 masterlist, downloaded on 21 October 2026. Only EMIS ID, school
name, province and source metadata are retained. No contacts, staff names,
coordinates or learner information are imported.

Source: [DBE EMIS downloads](https://www.education.gov.za/EMIS/EMISDownloads/tabid/466/Default.aspx).
Directory snapshot dates are not claims that a school's current details have been
reverified. Manual entry remains available for missing or changed schools.

`scripts/build-grade9-school-directory.mjs` reproduces the new seed from the DBE
XLSX using Node's built-in ZIP decompression. Future refreshes must use a new
timestamped migration and numbered release, preserving v12.

## Verification

```text
npm run test:grade9:onboarding
npm run test:grade9:onboarding:sql
npm run test:grade9:onboarding:browser
npm run test:journey:browser -- --flows-only
npm run test:grade9:browser
npm run test:grade10:browser
npm run build
npm run lint
npm run sql:check
```

The SQL runner uses the existing temporary PGlite installation. For a fresh
workspace, install that test-only engine with:
`npm install --prefix node_modules/.tmp/via-sql-validation @electric-sql/pglite`.
It is not an application dependency.

The Grade 9 browser runner exercises the actual UI and actual PostgreSQL save
functions in a disposable database. HTTP auth/storage are intercepted with fixture
accounts and original fixture bytes. PDFs and images pass through real PDF/OCR
processing, not mocked extraction. It covers login, school search/manual entry,
draft resume, corrections, duplicate/range errors, confirmed-only academics,
experience, conditional navigation, save failure/retry, final completion, manual
marks including zero, old completed users and responsive layouts at 375, 430,
768, 1024, 1280, 1440 and 1920 widths, plus short viewports and reduced keyboard
height. Artifacts: `node_modules/.tmp/via-grade9-onboarding-qa`.

The camera input and capture/file-chooser path are checked using a real JPEG OCR
fixture. Physical phone-camera hardware cannot be exercised in headless Chrome
and remains a device verification step. No real users, emails, live report
uploads or connected-project database writes are created by these tests.
