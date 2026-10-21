import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) in .env.local.')
const root = url.replace(/\/$/, '')
const report = { keyType: key.startsWith('sb_publishable_') ? 'publishable' : key.split('.').length === 3 ? 'legacy anon JWT' : 'unrecognised', checks: [] }
for (const endpoint of ['/auth/v1/settings', '/rest/v1/via_profiles?select=id&limit=0']) {
  try {
    const response = await fetch(root + endpoint, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) })
    const body = await response.json()
    const expectedPrivateTable = !endpoint.includes('settings') && body.code === '42501'
    report.checks.push({ endpoint, status: response.status, ...(endpoint.includes('settings') ? { emailEnabled: body.external?.email, emailAutoConfirm: body.mailer_autoconfirm, signupDisabled: body.disable_signup } : { publicApiReachable: response.ok || expectedPrivateTable, anonymousProfileAccessDenied: expectedPrivateTable, error: response.ok || expectedPrivateTable ? undefined : body.message }) })
    if (!response.ok && !expectedPrivateTable) process.exitCode = 1
  } catch (error) { report.checks.push({ endpoint, error: error.message }); process.exitCode = 1 }
}
// A reserved .invalid address exercises the real login endpoint without sending
// email, creating an account, or touching an existing user's password.
try {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { error } = await client.auth.signInWithPassword({ email: 'via-connectivity-check@example.invalid', password: 'NotAnExistingAccount-ConnectivityOnly-2026' })
  report.checks.push({ endpoint: '/auth/v1/token', status: error?.status, code: error?.code, expectedInvalidCredentials: error?.code === 'invalid_credentials' })
  if (error?.code !== 'invalid_credentials') process.exitCode = 1
} catch (error) { report.checks.push({ endpoint: '/auth/v1/token', error: error.message }); process.exitCode = 1 }
console.log(JSON.stringify(report, null, 2))
