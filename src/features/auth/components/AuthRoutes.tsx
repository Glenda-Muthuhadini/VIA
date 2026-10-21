import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import { AuthStatus } from './AuthStatus'
import { getAuthDestination } from '../services/redirects'

export function RequireAuth() {
  const { session, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <AuthStatus message="Restoring your VIA session…" />
  if (!session) return <Navigate to={`/login?${new URLSearchParams({ next: location.pathname + location.search })}`} replace />
  return <Outlet />
}

export function GuestOnly() {
  const { session, isLoading, isRecoveringPassword } = useAuth()
  const location = useLocation()
  if (isLoading) return <AuthStatus message="Restoring your VIA session…" />
  if (isRecoveringPassword && session) return <Navigate to="/reset-password" replace />
  if (session) return <Navigate to={location.pathname === '/signup' ? '/onboarding/welcome' : getAuthDestination(location.search)} replace />
  return <Outlet />
}

export function RecoveryRedirect() {
  const { session, isRecoveringPassword } = useAuth()
  const location = useLocation()
  if (session && isRecoveringPassword && !['/reset-password', '/auth/callback'].includes(location.pathname)) {
    return <Navigate to="/reset-password" replace />
  }
  return null
}
