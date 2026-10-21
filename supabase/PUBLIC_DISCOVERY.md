# Public marketing and discovery implementation

**Current functionality:** the catalogue is now ten records per category and the
public qualification checker is implemented. Use corrected SQL v6, not failed v5.
See [QUALIFICATION_CHECKER.md](QUALIFICATION_CHECKER.md) for the current engine,
source audit, installation, private-upload behavior and verification limits.
The sections below record the original v4 implementation and its historical scope.

## Delivered routes and behavior

The original `/` landing page remains the homepage. Its photo, hero composition,
branding, typography, 100dvh height and minimal header are retained. The existing
whole-card hero links now open `/programmes`, `/institutions` and `/bursaries`.
The circular arrows remain their visual CTA, with subtle hover/focus feedback.
The unsupported student-count claim and illustrative avatar initials were removed.
The first card now states that exploration needs no account. No fourth hero card
was added.

At short mobile heights, the existing content area can scroll inside the hero to
prevent its headline overlapping the header. The hero remains 100dvh, its header
and product row remain accessible, and the normal-height composition is unchanged.

An Explore your options section follows the hero, with four premium entry cards.
The shared public header sits below the hero on the landing page and heads all
explorers. It offers Home, Institutions, Programmes, Bursaries and Accommodation,
with login/signup or My VIA actions. Tablet/mobile navigation uses a native
dialog menu. Discovery links were also added to the existing landing footer;
the explorer footer uses the light VIA logo. Existing public exploration/search
links elsewhere on the landing page now lead to discovery rather than signup.

All four explorers work without authentication. They share debounced search,
URL filters/page/detail state, bounded Supabase queries, cards, responsive filters,
native accessible detail dialogs, empty/loading/error/retry states and pagination.
Institution details contain searchable, paginated institution-specific programmes.
Details expose available requirements, dates, fees, provenance and official links.
Unknown values are omitted or explained. Application status uses verified dates
in the Africa/Johannesburg time zone; unknown dates never become Open.

Saving requires authentication and persists to owner-only saved opportunities.
Guests receive an optional auth prompt and can keep browsing. Login/signup return
to the selected public opportunity with its intent preserved. Returning to a Save
intent requires confirmation; visiting a crafted URL never automatically writes
private data. Save/unsave supports status, errors, reload and account isolation.
VIA Match/Money conversions disclose that those matching engines are not yet
implemented. They offer profile creation without inventing scores or outcomes.

## Current architecture reconciliation

Before editing, the current router, landing hero/page/styles, reusable components,
auth context/redirect handling and all six released migrations were inspected.
There was no existing public opportunity catalogue in the repository. No new
onboarding branch, dashboard intelligence change, auth configuration change or
report/storage change was needed. Only the auth return-path allowlist was extended
to the exact four public routes. Existing onboarding/dashboard source hashes and
all older released SQL hashes were verified unchanged.

The existing generic Modal was unsuitable for the required keyboard/focus behavior.
A discovery-scoped native dialog was added instead of changing unrelated callers.
Existing logos, font tokens, Lucide package, Supabase client and auth context are
reused. No dependencies were added or credentials changed.

## Database and Supabase actions

**v4 has been applied by the project owner. No further SQL is required.**
The owner also ran `supabase/tests/public_discovery.sql` and reported PASS.

For another environment, apply versions in order: auth v1, onboarding v2,
adaptive onboarding v3, then `sql/public_discovery_setup_v4.sql` once. Never rerun
old releases on an existing installation. The v4 transaction contains:

1. `migrations/20261016000700_public_discovery.sql`
2. `migrations/20261016000800_public_discovery_seed.sql`

The shared base `via_opportunities` owns identity, publication and provenance.
Normalized subtype/relationship tables are `via_institutions`, `via_campuses`,
`via_programmes`, `via_programme_requirements`, `via_application_cycles`,
`via_bursaries`, `via_bursary_eligibility`, `via_accommodations` and
`via_accommodation_institutions`. `via_saved_opportunities` has real opportunity
foreign keys and owner-only read/insert/delete policies.

`via_public_opportunities` is a security-invoker read projection of those tables,
not another dataset. `search_public_opportunities` executes with caller RLS,
accepts whitelisted/bounded search filters and returns at most 24 records per page
(the UI requests 12). It returns filter facets computed on the database rather
than downloading the catalogue for browser filtering. Public catalogue writes are
denied to browser roles. Unpublished records and their children remain private.
Private saved records are never accessible anonymously or across users.

## Curated seed and data quality

Four institutions: Wits, UCT, UP, False Bay TVET College.
Six programmes: Wits BSc Computer Science; UCT BA Informatics/Computer Science,
BBusSc Computer Science and BSc Computer Science major; UP BSc Computer Science;
False Bay NC(V) IT and Computer Science.
Two funding records: NSFAS Bursary and Funza Lushaka.
Two accommodation records: South Point KSI and Melridge House, associated with Wits.

See [PUBLIC_DISCOVERY_SOURCES.md](PUBLIC_DISCOVERY_SOURCES.md) for primary sources,
intake years and verification limits. UP information and residence rates remain
labelled 2026 snapshots. Source fields are retained on requirements, application
cycles and associations. Provider-only NSFAS accreditation claims are not promoted
to independent verification. No distance, live room availability, match score,
invented admission rule or guessed application URL was added. Logos/property
photos are optional and are not replaced with fabricated brand/property imagery.

## Files created

| File | Purpose |
| --- | --- |
| `src/features/discovery/services/model.ts` | Shared catalogue types, page/filter configuration, safe URLs, URL parsing, date/status helpers. |
| `src/features/discovery/services/discovery.ts` | Bounded search, detail fetching and owner-checked private save operations. |
| `src/features/discovery/pages/DiscoveryPage.tsx` | Shared route-driven explorer, query state, loading/errors, detail/filter/conversion state and saving. |
| `src/features/discovery/components/PublicLayout.tsx` | Shared public header, responsive navigation and light-logo footer. |
| `src/features/discovery/components/PublicDialog.tsx` | Native modal/sheet with Escape, focus trapping/restoration and responsive scrolling. |
| `src/features/discovery/components/FilterControls.tsx` | Data-derived filters reused in the desktop sidebar and mobile sheet. |
| `src/features/discovery/components/OpportunityCard.tsx` | Shared readable opportunity card with public view and private save actions. |
| `src/features/discovery/components/OpportunityDetails.tsx` | Overview/requirements/application tabs, institution programmes, sources, external links and conversions. |
| `src/features/discovery/components/AuthConversionPrompt.tsx` | Optional, context-preserving authentication and honest matching handoff. |
| `src/features/discovery/components/ExploreOptions.tsx` | Four public landing entry cards. |
| `src/features/discovery/components/icons.ts` | Shared existing Lucide icons. |
| `src/features/discovery/discovery.css` | Scoped responsive VIA presentation, dialog/sheet and accessibility styles. |
| `supabase/migrations/20261016000700_public_discovery.sql` | Shared normalized catalogue, public RLS/projection/search and private saves. |
| `supabase/migrations/20261016000800_public_discovery_seed.sql` | Source-backed 14-opportunity prototype seed. |
| `supabase/sql/public_discovery_setup_v4.sql` | Immutable paste-ready v4 release. |
| `supabase/sql/verify_public_discovery_setup.sql` | Read-only schema/permissions/count checks. |
| `supabase/tests/public_discovery.sql` | Rolled-back public access, search, publication and private-save tests. |
| `supabase/PUBLIC_DISCOVERY.md` | This implementation, rollout and exact-file report. |
| `supabase/PUBLIC_DISCOVERY_SOURCES.md` | Official source register and data-quality limits. |
| `scripts/check-discovery-live.mjs` | Read-only anonymous checks against the applied catalogue. |
| `scripts/check-discovery-browser.mjs` | Functional/responsive/accessibility browser checks with intercepted requests. |
| `tests/discovery.test.mjs` | Filters, safe links, status boundaries and authentication-context tests. |
| `tests/fixtures/discovery.json` | Test-only snapshot of the applied public catalogue, never a production fallback. |

## Files modified

| File | Change |
| --- | --- |
| `src/App.tsx` | Added the four public routes under the shared public layout, outside RequireAuth. |
| `src/features/auth/services/redirects.ts` | Allows the four exact public routes as safe auth return destinations. |
| `src/features/landing/components/Hero.tsx` | Public destinations for the three existing glass cards; removed unsupported student count/avatars. |
| `src/features/landing/components/Hero.css` | Card focus/border/arrow response, reduced motion, 100dvh and an accessible short-mobile content area. |
| `src/features/landing/pages/LandingPage.tsx` | Public navigation below hero, Explore your options, public exploration links and footer links. |
| `scripts/build-supabase-sql.mjs` | Generates/checks v4 while preserving releases v1–v3. |
| `package.json` | Adds discovery unit/browser/live check commands; no new dependencies. |
| `supabase/README.md` | Ordered v4 installation and verification instructions. |

## Verification

The owner confirmed the applied SQL transaction tests passed. Read-only live API
checks passed for anonymous access to all four kinds, institution/programme
relationships, name/location/APS/price/open-date filters and anonymous private-save
denial. This is separate from browser fixtures; no real user was changed by UI tests.

25 unit tests pass: five discovery, four authentication, five legacy onboarding,
five adaptive onboarding and six dashboard. SQL bundle comparisons pass for v1–v4.
TypeScript and the production build pass. Lint completes with the existing
landing-page Date purity warning; the existing large-JavaScript-bundle warning
remains. No new lint error was introduced.

Browser discovery checks cover anonymous browsing, query persistence on refresh,
institution programmes, requirements, application information, safe external
links, truthful conversions, context-preserving login, private save/reload/unsave,
failure recovery, pagination, empty states and detail errors. Each explorer's
listing/details and responsive filters/navigation is checked at 375,430,768,1024,
1280,1440,1920 and the additional 375×480/1280×650 cases. The landing page is also
checked, including exact 100dvh hero height and all seven discovery entry links.
The hero product bar retains its intentional local horizontal scrolling; the page
itself must not horizontally scroll. Screenshots/reports are in
`node_modules/.tmp/via-discovery-qa`.

Authentication, adaptive onboarding and dashboard regression scripts are retained
and run separately. Those tests intercept API calls and do not change real accounts.

## Remaining limits

This is a curated prototype, not a complete national catalogue. Data requires
ongoing source verification; it is not a live availability feed. Some filter
choices naturally have no verified matches. Complete admissions evaluation, VIA
Match, VIA Money matching, Pathway Impact and personalised recommendation handoff
remain future work; their public CTAs disclose this. The existing authenticated
dashboard Saved summary is not connected to this new saved-opportunity source in
this scope. Its future integration can reuse this same table without duplication.
The existing dashboard and onboarding designs/logic were deliberately preserved.
