# Authentication integration — 2026-10-16

## Verification

- Production TypeScript/Vite build passed.
- Four redirect/error-handling unit tests passed.
- Browser tests passed login errors, successful login, profile name, session reload,
  logout, signup metadata, confirmation callback, resend, recovery callback,
  password mismatch/update, and expired links using intercepted Supabase fixtures.
- All 36 form layout checks passed: four auth pages at 375, 430, 768, 1024,
  1280, 1440, and 1920 pixels, plus short mobile/laptop heights.
- Live Supabase test passed signup, profile trigger/owner read, logout and login.
- Anonymous access to the live profile table was denied as intended.
- The owner confirmed that the actual reset email arrived and that resetting
  their password and logging in worked.
- Email confirmation is currently disabled in project settings. The enabled
  confirmation/resend flow was tested with browser fixtures, not a live email.
- The setup SQL was applied by the owner. The release bundle matches its two
  migrations. The full transactional SQL policy test is provided but has not
  been executed against this project; live owner/anonymous checks do not replace
  that cross-user/protected-column test.
- Lint has one existing warning in LandingPage.tsx about Date during rendering.
  The build also reports its bundle-size advisory.

## Exact implementation files

Paths below are relative to the project root. Existing unrelated working-tree
changes are not part of this integration.

| File | Change |
| --- | --- |
| `src/App.tsx` | Auth callback/reset routes, guest/private route guards, recovery redirect |
| `src/main.tsx` | Mount shared auth provider within the existing router |
| `src/services/supabase.ts` | Explicit SPA session options and initial redirect detection; credentials unchanged by implementation |
| `src/context/auth-context.ts` | Shared typed auth context |
| `src/context/AuthProvider.tsx` | Session subscription, restoration, profile loading, recovery state, logout |
| `src/hooks/useAuth.ts` | Typed auth hook |
| `src/features/auth/components/AuthRoutes.tsx` | Guest/private route guards and password-recovery routing |
| `src/features/auth/components/AuthStatus.tsx` | Existing-style loading and invalid-link states |
| `src/features/auth/pages/AuthCallbackPage.tsx` | Email confirmation callback handling |
| `src/features/auth/pages/ResetPasswordPage.tsx` | New-password form and Supabase password update |
| `src/features/auth/pages/LoginPage.tsx` | Reliable submission/error handling, safe redirects, resend confirmation |
| `src/features/auth/pages/SignUpPage.tsx` | Signup metadata, callback URL, validation and session/confirmation paths |
| `src/features/auth/pages/ForgotPasswordPage.tsx` | Recovery URL, safe messaging, submission/error handling |
| `src/features/auth/services/profile.ts` | Typed private profile query |
| `src/features/auth/services/redirects.ts` | Allowlisted destinations, auth links, friendly errors |
| `src/features/dashboard/pages/DashboardPage.tsx` | Actual account name/email, logout and profile retry |
| `src/features/dashboard/pages/DashboardPage.css` | Profile-name wrapping and profile-load notice |
| `package.json` | Auth/SQL verification commands; no new dependencies |
| `AGENTS.md` | Permanent requirement to preserve numbered SQL versions |
| `scripts/build-supabase-sql.mjs` | Build/check immutable paste-ready SQL release |
| `scripts/check-supabase.mjs` | Safe live settings, private-table and invalid-login connectivity checks |
| `scripts/check-auth-browser.mjs` | Mocked Supabase browser integration and responsive checks |
| `scripts/check-auth-live.mjs` | Explicit opt-in live account/profile/login/recovery test |
| `tests/auth-redirects.test.mjs` | Safe redirect and auth error tests |
| `supabase/migrations/20261016000100_via_auth_profiles.sql` | Versioned profile table, RLS, grants and timestamp trigger |
| `supabase/migrations/20261016000200_via_auth_profile_bootstrap.sql` | Versioned signup trigger and existing-user profile backfill |
| `supabase/sql/auth_setup_v1.sql` | Paste-ready v1 release containing both migrations |
| `supabase/sql/verify_auth_setup.sql` | Read-only database configuration checks |
| `supabase/tests/auth_profiles.sql` | Rolled-back trigger/access-policy integration test |
| `supabase/README.md` | SQL versions, dashboard/email setup and verification instructions |
| `supabase/AUTH_CHANGELOG.md` | This exact file manifest and verification record |

The owner separately updated `.env.local` with the matching public project key.
No credentials, tokens or test passwords were added to source control.
Generated browser screenshots/reports are local under `node_modules/.tmp/via-auth-qa`.
Existing landing and onboarding source files, UI components and global styling
were compared against the initial source hashes and left unchanged.
