import { type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useOnboarding } from '../context/onboarding-context'

export function OnboardingHomeLink({ children }: { children: ReactNode }) {
  const { status, busy, save } = useOnboarding()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  return <Link aria-label="VIA home" aria-disabled={busy || leaving} to="/" onClick={async event => {
    event.preventDefault()
    if (busy || leaving) return
    setLeaving(true)
    try {
      if (status !== 'saved') await save()
      navigate('/')
    } catch { /* Remain on the screen with the shared save error. */ }
    finally { setLeaving(false) }
  }}>{children}</Link>
}
