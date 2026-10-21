# Funding cards and details

`FundingCard` shows the stored name, provider, type, coverage and closing date,
with a separate Save control. The title button stretches across the card; Save
has its own hit area and retains the existing authentication/saved-opportunity
flow.

`FundingDetails` uses one scrollable reading flow: About, What it covers, Who can
apply, What can I study, Where can I study (when restricted), What do I need, and
the official application action. There are no tabs or related-opportunity panels.
Missing values are described as not listed. No coverage, eligibility, documents
or URLs are invented. Demo records keep an explicit notice.

Data comes from the existing public opportunity document. The displayed
institution list is the view's projection of `via_bursaries.institution_ids`, not
an inferred restriction based on nearby institutions or programme associations.
Applicable programme links are read through `via_bursary_programmes` and the
RLS-protected public view, with complete paginated reads. Equivalent programme
names are grouped for display. A programme-load error leaves the funding fields
visible and offers a retry. Apply uses only the stored safe HTTPS
`application_url` and opens in a new tab.

The closing-date helper uses the newest recorded application year. An unknown
deadline for that year is not replaced with an older intake's date.

No SQL migrations, application submissions or account changes are involved.

## Verification

```text
npm run test:funding
npm run test:funding:browser
npm run build
npm run lint
```

Browser checks read public data and test 375, 430, 768, 1024, 1280, 1440 and 1920
CSS-pixel widths, plus 375×480 and 1280×650 viewports. They verify full-card
clicking, guest Save isolation, Save inside the modal, coverage accuracy,
conditional institutions, accessible application actions, modal sizing and
overflow. In-memory HTTP fixtures test missing data, linked programmes and retry;
fixtures are never written to Supabase. Screenshots are stored in
`node_modules/.tmp/via-funding-qa/`.
