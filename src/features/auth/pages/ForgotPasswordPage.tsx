import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation } from 'react-router'
import backgroundImage from '../../../assets/images/Contemplative Valley Horizon.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { Button, GlassCard, Input } from '../../../components/ui'
import { supabase } from '../../../services/supabase'
import { authErrorMessage, authPageLink, getAuthDestination } from '../services/redirects'

type ForgotPasswordForm = {
  email: string
}

const initialForm: ForgotPasswordForm = {
  email: '',
}

function validateForgotPasswordForm(form: ForgotPasswordForm) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Please enter a valid email address.'
  }

  return ''
}

export function ForgotPasswordPage() {
  const location = useLocation()
  const destination = getAuthDestination(location.search)
  const [form, setForm] = useState(initialForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setErrorMessage('')
    setSuccessMessage('')

    const validationError = validateForgotPasswordForm(form)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        form.email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      )

      if (error) {
        setErrorMessage(authErrorMessage(error, 'We could not send your reset link. Please try again later.'))
        return
      }

      setSuccessMessage(
        'If an account exists for this email, you will receive a password reset link. Please check your inbox.',
      )
      setForm(initialForm)
    } catch {
      setErrorMessage('We could not connect to VIA. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
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
            <h1 className="via-product-eyebrow">RESET YOUR PASSWORD</h1>
          </div>

          <form className="via-signup-form" onSubmit={handleSubmit}>
            <Input
              autoComplete="email"
              icon={<Mail size={20} />}
              onChange={(event) => setForm({ email: event.target.value })}
              label="Email address"
              placeholder="Email address"
              type="email"
              value={form.email}
            />

            {errorMessage ? (
              <p className="via-message via-message-error" role="alert">{errorMessage}</p>
            ) : null}

            {successMessage ? (
              <p className="via-message via-message-success" role="status">
                {successMessage}
              </p>
            ) : null}

            <Button
              className="via-create-button w-full"
              isLoading={isSubmitting}
              loadingLabel="Sending link..."
              rightIcon={<ArrowRight size={21} />}
              size="large"
              type="submit"
            >
              Send reset link
            </Button>
          </form>

          <p className="via-login-link text-center font-medium">
            <Link className="via-login-action inline-flex items-center gap-2 font-bold underline" to={authPageLink('/login', destination)}>
              <ArrowLeft size={16} />
              Back to login
            </Link>
          </p>
        </GlassCard>
      </section>
    </main>
  )
}
