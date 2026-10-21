import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { ViaProfile } from '../features/auth/services/profile'

export type AuthState = {
  session: Session | null
  user: User | null
  profile: ViaProfile | null
  isLoading: boolean
  error: string | null
  profileError: string | null
  isRecoveringPassword: boolean
  finishPasswordRecovery: () => void
  refreshProfile: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
