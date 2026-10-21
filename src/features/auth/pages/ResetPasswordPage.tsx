import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import backgroundImage from '../../../assets/images/Contemplative Valley Horizon.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { Button, GlassCard, Input } from '../../../components/ui'
import { useAuth } from '../../../hooks/useAuth'
import { supabase, initialAuthRedirectError } from '../../../services/supabase'
import { authErrorMessage } from '../services/redirects'
import { AuthStatus } from '../components/AuthStatus'

export function ResetPasswordPage() {
  const { session, isLoading, finishPasswordRecovery, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [completed, setCompleted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !session || completed) return
    setErrorMessage('')
    if (password.length < 8) { setErrorMessage('Your password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setErrorMessage('Passwords do not match.'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setErrorMessage(authErrorMessage(error, 'Your password could not be changed. Request a new reset link and try again.')); return }
      setCompleted(true)
      setPassword('')
      setConfirmPassword('')
      finishPasswordRecovery()
      try {
        await signOut()
        navigate('/login?reset=success', { replace: true })
      } catch {
        setErrorMessage('Your password was changed, but we could not sign you out. You can continue to your VIA or try logging out again.')
      }
    } catch {
      setErrorMessage('We could not connect to VIA. Check your connection and try again.')
    } finally { setIsSubmitting(false) }
  }

  if (isLoading) return <AuthStatus message="Checking your reset link…" />
  if (initialAuthRedirectError || (!session && !completed)) return <AuthStatus error message="This reset link is invalid or has expired. Request a new link to change your password." />

  return (
    <main className="via-product-page via-auth-page">
      <img src={backgroundImage} alt="" className="via-auth-background" />
      <div className="via-auth-wash" /><div className="via-auth-glow" />
      <section className="via-login-shell grid place-items-center">
        <GlassCard className="via-login-card" variant="light">
          <div className="text-center">
            <Link aria-label="VIA home" to="/"><img src={viaLogo} alt="VIA" className="via-card-logo" /></Link>
            <h1 className="via-product-eyebrow">CHOOSE A NEW PASSWORD</h1>
          </div>
          {completed ? <><p className="via-message via-message-success" role="status">Your password has been changed.</p><Link className="via-login-action" to="/onboarding/welcome">Continue to your VIA</Link></> : (
            <form className="via-signup-form" onSubmit={handleSubmit}>
              <Input label="New password" placeholder="New password" autoComplete="new-password" icon={<Lock size={20} />} value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'}
                action={<button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <Eye size={20} /> : <EyeOff size={20} />}</button>} />
              <Input label="Confirm new password" placeholder="Confirm new password" autoComplete="new-password" icon={<Lock size={20} />} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type={showPassword ? 'text' : 'password'} />
              {errorMessage && <p className="via-message via-message-error" role="alert">{errorMessage}</p>}
              <Button type="submit" isLoading={isSubmitting} loadingLabel="Updating password…" size="large" className="w-full" rightIcon={<ArrowRight size={20} />}>Update password</Button>
            </form>
          )}
          {completed && errorMessage && <p className="via-message via-message-error" role="alert">{errorMessage}</p>}
        </GlassCard>
      </section>
    </main>
  )
}
