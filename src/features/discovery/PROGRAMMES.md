# Programme catalogue and institution offerings

The programme page groups existing `via_public_opportunities` programme records
before filtering and pagination. Each underlying record remains an institution
offering with its own official name, campus, location, duration, APS, requirements
and stored URLs. No database schema or SQL release is changed.

`services/programme-model.ts` removes qualification prefixes and the suffix
“major” when comparing names. It preserves specialisations and subject
combinations, separates qualification levels, and keeps demo records separate
from published records. It does not infer equivalence from a broad field or
career keyword. A distinct programme with a different name stays separate unless
these conservative rules identify the same name. Institution counts use distinct
institution IDs. Unknown durations and career details stay unknown.

The RLS-protected public view is read in batches of 500. This ensures counts and
offering lists cover the complete catalogue rather than one server search page.
This is suitable for the current small catalogue; larger catalogues should move
the same grouping rules into a versioned database API with explicit canonical
programme identities. Existing offering IDs remain valid deep links.

`components/ProgrammeDetails.tsx` renders one accordion per institution. Where an
institution has multiple records for the same programme, an offering selector
keeps each record's requirements, campus and actions together. Only one
institution is expanded at a time. Demo offerings display a notice.

## Linked searches

- Funding links carry `programme=<offering UUID>` and `institution=<institution
  UUID>`. The frontend reads `via_bursary_programmes` and
  `via_bursary_institutions` and includes programme-linked or general
  institution-linked funding. It validates that the offering belongs to the
  selected institution. Existing provider filters still apply. Relationship
  matches are not a determination of personal funding eligibility.
- Accommodation links carry `institution` and the stored `campus` name when
  available. Campus matching uses the accommodation's institution association,
  not its programme or an unrelated institution's campus. Unknown campus
  associations are excluded when a specific campus is requested. If the offering
  has no campus, only the institution filter is applied.
- Unsupported programme/campus filters are handled in the service layer, not
  sent to the existing search RPC. Filtering finishes before pagination.
- “Apply Online” uses the offering's stored HTTPS `application_url` for the
  university's online application portal, opening in a new tab. Programme
  information/source URLs are not substituted for missing application links.

## Verification

```text
npm run test:programmes
npm run test:discovery
npm run test:programmes:browser
npm run build
npm run lint
```

The browser script reads the connected public catalogue without writing records.
It checks the grouped cards and modal at 375, 430, 768, 1024, 1280, 1440 and 1920
CSS pixels, plus shorter 375×480 and 1280×650 viewports. It then intercepts HTTP
responses with in-memory fixtures to verify multi-campus offering selection,
distinct subject marks, missing data and exact funding/accommodation matching.
Fixtures are never inserted into Supabase. Screenshots are saved under
`node_modules/.tmp/via-programmes-qa/`.
