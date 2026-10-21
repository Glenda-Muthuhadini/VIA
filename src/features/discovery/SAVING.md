# Shared cards and saving

Institution, programme, funding and accommodation cards use `SaveButton` with
a 22px heart in a 46px control in the upper-right corner. An outlined heart is
unsaved and a filled heart is saved. The button stops click propagation and
stays above the stretched details button. Keyboard users can focus the details
button and heart independently. Institution application links remain inside the
details modal so the card surface consistently opens details.

`DiscoveryPage` owns saved state for both cards and details. Authenticated
changes use the existing `via_saved_opportunities` table and are reflected only
after the write succeeds. Guests go directly to `/login` with a safe `next`
destination containing the item ID and save intent; no save is written before
authentication. The requested save resumes once the session and saved state
have loaded. Programme groups use their deterministic representative opportunity
ID in the existing schema. No database changes are needed.

The dashboard reads the signed-in user's saved IDs and joins published catalogue
documents to determine each item's type. Its Saved panel contains Saved
Institutions, Saved Programmes, Saved Funding and Saved Accommodation, with
links back to details. The respective dashboard navigation panels show the same
categories. Failed reads are reported as unavailable, rather than empty lists.

Run `npm run test:saves:browser` against the running app on port 5175 (or set
`VIA_TEST_ORIGIN`). Chrome checks all four card/modal types at seven standard
widths and two short viewport sizes. It verifies whole-card clicks, matching
heart geometry, direct guest login, absence of guest writes, login return,
Save/Unsave state synchronisation, reload persistence and dashboard categories.
Auth and database requests are intercepted with in-memory fixtures; this does
not verify live authenticated database policies or create real accounts/records.
Screenshots are written to `node_modules/.tmp/via-save-qa`.
