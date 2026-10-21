export const defaultAuthDestination = '/onboarding/welcome'

// Only application-owned destinations can be used after authentication.
export function safeAuthDestination(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some(character => character.charCodeAt(0) <= 32)) {
    return defaultAuthDestination
  }

  const destination = new URL(value, 'https://via.invalid')
  if (destination.origin !== 'https://via.invalid' ||
    !(/^\/dashboard(?:\/(?:results|subject-choices|study-pathways|next-steps|assist))?$/.test(destination.pathname) || /^\/(institutions|programmes|bursaries|accommodation)$/.test(destination.pathname) || /^\/onboarding\/(welcome|current|interests|results|personality|study-plan|preferences|school-subjects|future-curiosity|stage-pending|building|ready|career-interests|study-interests|programmes|study-location|applications|funding|matric-year|current-activity|institution|enrolled-programme|campus|starting-year|year-of-study|accommodation-status|registration|support|school-details|confirm-results|subject-experience|subject-choice|subjects-considering|future-interests)$/.test(destination.pathname))) {
    return defaultAuthDestination
  }

  const anchor = destination.pathname === '/dashboard/subject-choices' && ['#maths','#my-plan','#subject-comparison'].includes(destination.hash) ? destination.hash : ''
  return destination.pathname + destination.search + anchor
}

export function getAuthDestination(search: string) {
  const next = new URLSearchParams(search).get('next')
  return next === null ? '/dashboard' : safeAuthDestination(next)
}

export function authPageLink(path: '/login' | '/signup' | '/forgot-password', destination: string) {
  return `${path}?${new URLSearchParams({ next: safeAuthDestination(destination) })}`
}

export function authCallbackUrl(destination: string) {
  return `${window.location.origin}/auth/callback?${new URLSearchParams({ next: safeAuthDestination(destination) })}`
}

export function authErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code)
    if (code === 'invalid_credentials') return 'Your email or password is incorrect.'
    if (code === 'email_not_confirmed') return 'Please confirm your email before logging in.'
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many attempts. Please wait a moment and try again.'
    if (code === 'user_already_exists') return 'An account with this email already exists. Please log in or reset your password.'
    if (code === 'same_password') return 'Choose a password different from your current password.'
    if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.'
  }
  return fallback
}
