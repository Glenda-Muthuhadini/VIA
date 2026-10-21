import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import backgroundImage from '../../../assets/images/Contemplative Valley Horizon.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { Button, GlassCard, Input } from '../../../components/ui'
import { supabase } from '../../../services/supabase'
import { authCallbackUrl, authErrorMessage, authPageLink, getAuthDestination } from '../services/redirects'

type LoginForm = {
  email: string
  password: string
}

const initialForm: LoginForm = {
  email: '',
  password: '',
}

function validateLoginForm(form: LoginForm) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Please enter a valid email address.'
  }

  if (!form.password) {
    return 'Please enter your password.'
  }

  return ''
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const destination = getAuthDestination(location.search)
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function updateField<K extends keyof LoginForm>(
    field: K,
    value: LoginForm[K],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setErrorMessage('')
    setSuccessMessage('')
    setNeedsConfirmation(false)

    const validationError = validateLoginForm(form)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
      if (error) {
        setNeedsConfirmation(error.code === 'email_not_confirmed')
        setErrorMessage(authErrorMessage(error, 'We could not log you in. Check your connection and try again.'))
        return
      }
      navigate(destination, { replace: true })
    } catch {
      setErrorMessage('We could not connect to VIA. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendConfirmation() {
    if (isSubmitting || !form.email.trim()) return
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: form.email.trim(), options: { emailRedirectTo: authCallbackUrl(destination) } })
      if (error) throw error
      setSuccessMessage('If your account needs confirmation, we have sent a new link. Please check your inbox.')
    } catch (error) {
      setErrorMessage(authErrorMessage(error, 'We could not send another link. Please try again later.'))
    } finally { setIsSubmitting(false) }
  }

  return (
    <main className="via-product-page via-auth-page">
      <img
        src={backgroundImage}
        alt=""
        className="via-auth-background"
      />
      <div className="via-auth-wash" />
      <div className="via-auth-glow" />

      <section className="via-login-shell relative z-[1] grid h-full place-items-center px-6 py-8">
        <GlassCard className="via-login-card" variant="light">
          <div className="text-center">
            <Link aria-label="VIA home" to="/">
              <img
                src={viaLogo}
                alt="VIA"
                className="via-card-logo mx-auto object-contain"
              />
            </Link>
            <h1 className="via-product-eyebrow">LOG IN TO VIA</h1>
          </div>

          <form className="via-signup-form" onSubmit={handleSubmit}>
            <Input
              autoComplete="email"
              icon={<Mail size={20} />}
              onChange={(event) => updateField('email', event.target.value)}
              label="Email address"
              placeholder="Email address"
              type="email"
              value={form.email}
            />

            <Input
              action={
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="via-focus-ring grid place-items-center rounded-[var(--radius-sm)] transition hover:text-[color:var(--via-primary-dark)]"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              }
              autoComplete="current-password"
              icon={<Lock size={20} />}
              onChange={(event) => updateField('password', event.target.value)}
              label="Password"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
            />

            <div className="text-right text-sm font-semibold">
              <Link className="via-login-action underline" to={authPageLink('/forgot-password', destination)}>
                Forgot password?
              </Link>
            </div>

            {errorMessage ? (
              <p className="via-message via-message-error" role="alert">{errorMessage}</p>
            ) : null}
            {(successMessage || new URLSearchParams(location.search).get('reset') === 'success') && <p className="via-message via-message-success" role="status">{successMessage || 'Your password has been updated. Log in with your new password.'}</p>}
            {needsConfirmation && <Button variant="ghost" disabled={isSubmitting} onClick={resendConfirmation}>Resend confirmation email</Button>}

            <Button
              className="via-create-button w-full"
              isLoading={isSubmitting}
              loadingLabel="Logging in..."
              rightIcon={<ArrowRight size={21} />}
              size="large"
              type="submit"
            >
              Log in
            </Button>
          </form>

          <p className="via-login-link text-center font-medium">
            New to VIA?{' '}
            <Link className="via-login-action font-bold underline" to={authPageLink('/signup', destination)}>
              Create account
            </Link>
          </p>
        </GlassCard>
      </section>
    </main>
  )
}
