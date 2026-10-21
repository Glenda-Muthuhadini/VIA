# Account routing and dashboard loading

The dashboard is rendered only after the signed-in user's profile, onboarding
record and answers have loaded. A neutral loading screen is shown meanwhile.
Failures show a retry screen without rendering a default dashboard. Missing
onboarding records open welcome; unfinished records resume the existing flow.
Unknown or unconfirmed education stages return to stage selection. A saved
`ready` step alone is not completion: `completed_at` must be present.
Save & finish later saves unfinished answers and returns to the public landing
page. Returning to the account resumes onboarding; it cannot open a dashboard
until completion. Completed users reviewing answers can return to their dashboard.

The dashboard data hook scopes every result to its user ID and request version.
Old requests cannot replace the next account's data. The dashboard content is
keyed by user ID so account changes reset open dialogs, search and other local
state. Profile, record and report ownership are checked before using responses.
These browser routing checks complement database RLS; they do not replace it.

Signup always leads to onboarding, both with immediate sessions and email
confirmation. Ordinary login defaults to the guarded dashboard. Explicit safe
destinations are preserved for login, and protected dashboard links still check
onboarding completion.

Profile and onboarding reads run in parallel. Concurrent reads for the same
profile share an in-flight promise; resolved private profiles are not cached.
Saved opportunities load concurrently in the background and have a separate
loading state, so optional saved-item requests cannot delay the dashboard.
Network latency still affects required reads; no artificial loading delay is used.

Verification:

- `npm run test:auth:routing`: completion, stage, legacy resume and redirect rules.
- `npm run test:auth:routing:browser`: actual React and Supabase SDK with
  intercepted HTTP, delayed profile/record/saved reads, one profile request,
  switching accounts with late responses, logout/login, immediate signup,
  confirmation callback, direct dashboard access, failed reads and owner mismatch.
  A DOM observer checks every dashboard commit for owner, stage and name.
  Loading, dashboard and retry layouts are checked at 375, 430, 768, 1024, 1280,
  1440 and 1920 px, plus short mobile and laptop heights.
- Existing auth, Grade 9 and the six other onboarding browser flows remain
  regression checks. Browser fixtures do not create live accounts or send email.

No database migration is needed for this routing update.
