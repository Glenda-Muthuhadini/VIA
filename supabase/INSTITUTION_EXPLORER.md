# Simplified institution explorer — v9

Installation: run `sql/institution_explorer_setup_v9.sql` once after v8, followed
by `tests/institution_explorer.sql`. The owner reported PASS. Local disposable
PostgreSQL tests also passed. Earlier released migrations and bundles are unchanged.

## Behavior

Institution cards show name/type/province, fee, deadline and a calculated APS range.
Unknown fees remain “Check institution”; unknown/incompatible scores show “Varies
by programme”. The latest stored intake supplies application facts; a displayed
deadline does not imply applications are currently open. Save and Apply remain
separate controls. A stretched native button makes the card keyboard accessible
and clickable without nesting interactive elements.

The institution modal has one heading, a programme search and native faculty
accordions. Expanded rows contain only programme name, APS and View Programme.
There are no institution tabs, requirement paragraphs, promotional blocks or
source cards. Programme rows route into the existing programme detail dialog,
where requirements, duration, faculty, campus (if present) and application
information remain available. Institution and programme application actions use
the label Apply with a safe external link and an accessible new-tab announcement.
Other public experiences, branding, authentication and onboarding are preserved.

## Database

`via_faculties` stores academic-unit names and provenance. Colleges and TVET
study areas retain their real organizational names. Every programme has a
required `faculty_id` and a composite foreign key that prevents attaching it to
another institution's faculty. Existing faculty text is kept synchronized for
compatibility with all existing public projections and matching services.

`via_institution_programme_scores` reads published programmes and their newest
admissions rules. `public_institution_summaries` calculates batched card ranges.
`public_institution_faculties` searches programme names server-side across every
faculty, returning compact programme rows. Adding/removing a linked programme
changes these read projections automatically. Renaming a faculty updates the
existing text projection. Latest-rule and programme minimum APS updates are kept
in sync, so the existing matching and detail endpoints use the same score.

Faculty/institution ranges are shown only when every programme in that group has
complete comparable verified scoring, one scoring system and one intake year.
Conditional APS alternatives are included: UJ accountancy is 22–24, not an
unconditional APS 22. UJ's current catalogue range is 22–33; UNISA's is 15.
An unsupported or mixed scoring system never becomes an invented university-wide
range. Programme rows may show a verified published APS even when the full
eligibility calculation is unsupported. Existing scoring rules are not lowered.

All ten demo institutions have at least one faculty-linked programme and a stored
official application destination. Previously missing application links for UP,
False Bay and DUT use their official application guidance pages; no portal URL
is constructed. Fees/dates/requirements are not invented to fill missing fields.
There are still 21 programmes; this update organizes the existing catalogue.

Public callers have read-only access to published academic units and score
projections. Trigger functions use an empty search path and run with caller
privileges. No learner tables, authentication, credentials or report storage change.

## Official sources reviewed

Existing named faculties use their programme source records. Previously missing
or new unit names were checked against official institution pages:

- [UP undergraduate programmes](https://www.up.ac.za/faculty-of-engineering-built-environment-it/undergraduate-programmes)
- [False Bay ICT study area](https://falsebaycollege.co.za/campuses/fish-hoek-campus/)
- [CPUT Informatics and Design](https://www.cput.ac.za/faculties/fid)
- [DUT academic faculties](https://www.dut.ac.za/academic/)
- [TUT ICT faculty](https://www.tut.ac.za/ict/)
- [UJ public relations programmes](https://www.uj.ac.za/faculties/humanities/school-of-communication/department-of-strategic-communication/programmes/)
- [UJ Business and Economics](https://www.uj.ac.za/faculties/college-of-business-and-economics/)
- NMU's existing official EBET prospectus and UNISA's existing qualification pages
  remain stored with those programmes.

Application guidance: [UP](https://www.up.ac.za/online-application/apply-online),
[False Bay](https://falsebaycollege.co.za/study-here/apply-now/),
[DUT](https://www.dut.ac.za/admissions/). External websites can block automated
clients or change independently of VIA; their continued uptime is not guaranteed.

## Changed files

| File | Change |
| --- | --- |
| `src/features/discovery/components/InstitutionCard.tsx` | New compact clickable institution card using existing styling and Save callbacks. |
| `src/features/discovery/components/InstitutionDetails.tsx` | New faculty accordion browser, server search and one Apply footer. |
| `src/features/discovery/components/institutions.css` | Scoped card/accordion styles and responsive modal/footer layouts. |
| `src/features/discovery/components/OpportunityCard.tsx` | Delegate institutions to the new card; preserve other cards. |
| `src/features/discovery/components/OpportunityDetails.tsx` | Delegate institutions to faculty browsing, reuse programme details, simplify programme Apply and expose existing campus data. |
| `src/features/discovery/pages/DiscoveryPage.tsx` | Remove unused state/callback for saving programmes inside the removed institution card grid. |
| `src/features/discovery/services/institutions.ts` | Public faculty/summary RPC clients and display helpers. |
| `src/features/discovery/services/discovery.ts` | Hydrate institution search cards with batched score summaries. |
| `src/features/discovery/services/model.ts` | Optional calculated institution range type. |
| `supabase/migrations/20261018001500_institution_faculties.sql` | Faculty relationships, canonical names/scores, public projections and missing official Apply links. |
| `supabase/sql/institution_explorer_setup_v9.sql` | Paste-ready v9 release. |
| `supabase/tests/institution_explorer.sql` | Rollback tests for relationships, searches, score updates, automatic programme inclusion/removal and permissions. |
| `scripts/build-supabase-sql.mjs` | Include v9 without changing historical bundles. |
| `scripts/check-qualification-sql-local.mjs` | Execute v9 and its tests after previous release checks. |
| `scripts/check-institution-browser.mjs` | Live catalogue and browser checks for the new hierarchy and responsive layouts. |
| `scripts/check-report-reader-browser.mjs` | Follow faculty navigation in the existing qualification regression test. |
| `scripts/check-discovery-browser.mjs` | Support the new institution RPCs and replace old institution-tab test navigation. |
| `supabase/README.md` | Installation order and v9 test link. |
| `supabase/INSTITUTION_EXPLORER.md` | This implementation/source/change record. |

## Verification commands

```
node scripts/build-supabase-sql.mjs --check
node scripts/check-qualification-sql-local.mjs
node scripts/check-institution-browser.mjs
node scripts/check-report-reader-browser.mjs
node scripts/check-discovery-browser.mjs
node --experimental-strip-types --test tests/discovery.test.mjs tests/qualification.test.mjs tests/report-results.test.mjs
npm run build
npm run lint
```

The institution browser runner uses real anonymous Supabase reads, checks all ten
institution relationships, and tests 375, 430, 768, 1024, 1280, 1440 and 1920 widths
plus short mobile/laptop heights. It covers card hit areas, guest saving, native
keyboard accordions, search/empty/reset, programme requirements, safe Apply links,
hidden modal scrollbars and reachable actions. The broader discovery runner uses
fixtures for private save/auth actions; it does not change real user accounts.

Completed verification: build passed; 12 discovery/qualification/parser unit tests
passed; all local SQL release/access tests passed; live v9 relationship checks
passed; institution and qualification browser suites passed at all nine viewport
cases. The broader discovery browser suite passed Save/reload/unsave (including
authenticated institution saving), filters, failures/retry, pagination and responsive
dialogs across all four discovery pages. Its landing checks also passed without
landing changes. Lint reports only the existing landing-page `Date` render warning.
