// Opt-in live test: creates an account and requests a recovery email.
// Use only with an address whose owner has authorised this test.
import { randomBytes } from 'node:crypto'
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email || !email.includes('@')) throw new Error('Pass an authorised test email as the first argument.')
const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const password = randomBytes(32).toString('base64url') + '!aA9'
const report = {}
const safeError = error => ({ status: error.status, code: error.code, message: error.message })
try {
  const signup = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } })
  if (signup.error) {
    report.signup = safeError(signup.error)
    process.exitCode = 1
  } else if (signup.data.session) {
    report.signup = 'Session created; email confirmation is disabled.'
    const { data, error } = await client.from('via_profiles').select('id').eq('id', signup.data.user.id).maybeSingle()
    report.profile = error ? safeError(error) : data?.id === signup.data.user.id ? 'Signup trigger and owner read passed.' : 'Profile missing.'
    if (error || !data) process.exitCode = 1
    const logout = await client.auth.signOut({ scope: 'local' })
    report.logout = logout.error ? safeError(logout.error) : 'Passed.'
    const login = await client.auth.signInWithPassword({ email, password })
    report.login = login.error ? safeError(login.error) : 'Passed.'
    if (login.error || logout.error) process.exitCode = 1
  } else {
    report.signup = 'No immediate session: check inbox, confirmation settings or existing account. No existing password was changed.'
  }
  const recovery = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })
  report.recovery = recovery.error ? safeError(recovery.error) : 'Recovery request accepted; inbox delivery and link completion require owner verification.'
  if (recovery.error) process.exitCode = 1
} finally {
  await client.auth.signOut({ scope: 'local' })
  console.log(JSON.stringify(report, null, 2))
}
