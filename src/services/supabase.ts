import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) environment variable')
}

const redirectHash = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1))
const redirectQuery = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
export const initialRecoveryRedirect = redirectHash.get('type') === 'recovery'
export const initialAuthRedirectError = redirectHash.has('error') || redirectQuery.has('error')

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
})
