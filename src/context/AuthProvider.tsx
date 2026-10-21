import { type ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import { supabase, initialRecoveryRedirect } from '../services/supabase'
import { getProfile, type ViaProfile } from '../features/auth/services/profile'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileState, setProfileState] = useState<{ userId: string; profile: ViaProfile | null } | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileRevision, setProfileRevision] = useState(0)
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(initialRecoveryRedirect)

  useEffect(() => {
    let active = true
    let eventRevision = 0
    // Keep this callback synchronous: profile queries run in a separate effect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      eventRevision += 1
      setSession(nextSession)
      setIsLoading(false)
      setError(null)
      if (event === 'PASSWORD_RECOVERY') setIsRecoveringPassword(true)
      if (event === 'SIGNED_OUT') setIsRecoveringPassword(false)
    })
    const revision = eventRevision
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || eventRevision !== revision) return
      setSession(data.session)
      setError(sessionError ? 'We could not restore your session. Please log in again.' : null)
      setIsLoading(false)
    }).catch(() => {
      if (!active || eventRevision !== revision) return
      setSession(null)
      setError('We could not connect to VIA. Check your connection and try again.')
      setIsLoading(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    let active = true
    if (!userId) return
    void getProfile(userId).then(profile => {
      if (!active) return
      setProfileState({ userId, profile })
      setProfileError(profile ? null : 'Your profile could not be loaded. Please try again.')
    }).catch(() => {
      if (!active) return
      setProfileState({ userId, profile: null })
      setProfileError('Your profile could not be loaded. Please try again.')
    })
    return () => { active = false }
  }, [userId, profileRevision])

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError) throw signOutError
    setSession(null)
    setProfileState(null)
    setProfileError(null)
    setIsRecoveringPassword(false)
  }

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null,
      profile: userId && profileState?.userId === userId ? profileState.profile : null,
      isLoading, error, profileError: userId && profileState?.userId === userId ? profileError : null,
      isRecoveringPassword, finishPasswordRecovery: () => setIsRecoveringPassword(false),
      refreshProfile: () => setProfileRevision(value => value + 1), signOut,
    }}>{children}</AuthContext.Provider>
  )
}
