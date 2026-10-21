# Accommodation cards and details

Cards open a scrollable details dialog and provide an independent Save button.
Save is also available inside the dialog. Guests go directly to the existing
login screen with the accommodation and save intent preserved. Authentication
resumes the requested save. Authenticated users can save or remove it using
the existing saved-opportunities service. See `SAVING.md` for the shared behaviour.

The UI uses catalogue fields only. Missing photos receive a neutral card
placeholder and are omitted inside the dialog. Missing prices, amenities,
institution associations, distances and contacts are never invented. Empty
detail sections are hidden. Only explicitly stored on-campus, private or
institution-accredited labels are normalised; NSFAS compatibility and institution
ownership do not establish accreditation. Optional structured address, phone and
email values are supported if supplied by the catalogue, alongside existing
freeform contact data. No schema changes are required.

Official actions use a safe stored application URL or website URL, in a new tab.
There is no fallback to a source URL or a generated application address.

Verification:

- `npm run test:accommodation`: price, distance, type, contact and login-return rules.
- `npm run test:accommodation:browser`: running app on port 5175 (override with
  `VIA_TEST_ORIGIN`), local Chrome, public catalogue reads and responsive checks
  at 375, 430, 768, 1024, 1280, 1440 and 1920 pixels, including short viewports.
  Fixtures cover photos, missing data, contact details, exact amenities and
  distances and source-only sections. `npm run test:saves:browser` covers shared
  guest login context, Save persistence and Unsave. Fixture auth and
  database writes are intercepted in memory; they do not verify live authenticated
  database policies. Screenshots are stored in `node_modules/.tmp/via-accommodation-qa`.
