import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeAuthDestination, getAuthDestination, authPageLink, authErrorMessage } from '../src/features/auth/services/redirects.ts'

test('keeps valid protected destinations and opportunity context', () => {
  assert.equal(getAuthDestination(''), '/dashboard')
  assert.equal(safeAuthDestination('/onboarding/confirm-results'), '/onboarding/confirm-results')
  assert.equal(safeAuthDestination('/dashboard/subject-choices#maths'), '/dashboard/subject-choices#maths')
  assert.equal(safeAuthDestination('/dashboard/results#access_token=do-not-forward'), '/dashboard/results')
  assert.equal(safeAuthDestination('/dashboard?view=match&programme=abc'), '/dashboard?view=match&programme=abc')
  assert.equal(safeAuthDestination('/onboarding/interests'), '/onboarding/interests')
  assert.equal(safeAuthDestination('/dashboard#access_token=do-not-forward'), '/dashboard')
})

test('rejects external, malformed and authentication redirect loops', () => {
  for (const value of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/login', '/auth/callback', '/reset-password', '/dashboard\n', '/%2f%2fevil.example', '/onboarding/unknown', 'javascript:alert(1)']) {
    assert.equal(safeAuthDestination(value), '/onboarding/welcome', String(value))
  }
})

test('carries a validated destination between auth screens', () => {
  const next = '/dashboard?view=match&programme=abc'
  const link = authPageLink('/signup', next)
  assert.equal(getAuthDestination(link.slice(link.indexOf('?'))), next)
  assert.equal(getAuthDestination('?next=https%3A%2F%2Fevil.example'), '/onboarding/welcome')
})

test('handles expected Supabase failures without exposing token-bearing errors', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /email or password/i)
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /confirm/i)
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /wait/i)
  assert.equal(authErrorMessage({ message: 'sensitive server detail' }, 'Try again'), 'Try again')
})
