import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import { initialAuthRedirectError } from '../../../services/supabase'
import { getAuthDestination } from '../services/redirects'
import { AuthStatus } from '../components/AuthStatus'

export function AuthCallbackPage() {
  const { session, isLoading, isRecoveringPassword, error } = useAuth()
  const location = useLocation()
  // Supabase's browser client consumes and removes confirmation tokens from the URL.
  if (initialAuthRedirectError) return <AuthStatus error message="This link is invalid or has expired. Please request a new link." />
  if (isLoading) return <AuthStatus message="Confirming your VIA account…" />
  if (!session) return <AuthStatus error message={error ?? 'We could not confirm this link. It may have expired or already been used.'} />
  return <Navigate to={isRecoveringPassword ? '/reset-password' : getAuthDestination(location.search)} replace />
}
