import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import backgroundImage from '../../../assets/images/Contemplative Valley Horizon.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import {
  Button,
  Checkbox,
  GlassCard,
  Input,
} from '../../../components/ui'
import { supabase } from '../../../services/supabase'
import { authCallbackUrl, authErrorMessage, authPageLink, getAuthDestination } from '../services/redirects'

type SignUpForm = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  acceptedTerms: boolean
}

const initialForm: SignUpForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
}

function validateForm(form: SignUpForm) {
  if (!form.firstName.trim()) {
    return 'Please enter your first name.'
  }

  if (!form.lastName.trim()) {
    return 'Please enter your last name.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Please enter a valid email address.'
  }

  if (form.password.length < 8) {
    return 'Your password must be at least 8 characters.'
  }

  if (form.password !== form.confirmPassword) {
    return 'Passwords do not match.'
  }

  if (!form.acceptedTerms) {
    return 'Please agree to the Terms of Service and Privacy Policy.'
  }

  return ''
}

export function SignUpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const destination = getAuthDestination(location.search)
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField<K extends keyof SignUpForm>(
    field: K,
    value: SignUpForm[K],
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

    const validationError = validateForm(form)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setIsSubmitting(true)

    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: authCallbackUrl('/onboarding/welcome'),
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
          },
        },
      })

      if (error) {
        setErrorMessage(authErrorMessage(error, 'We could not create your account. Check your connection and try again.'))
        return
      }

      if (data.user?.identities?.length === 0) {
        setErrorMessage('An account with this email may already exist. Try logging in instead.')
        return
      }

      if (data.session) {
        navigate('/onboarding/welcome', { replace: true })
        return
      }

      setSuccessMessage(
        'Account created. Please check your email to verify your account before continuing.',
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
              <h1 className="via-product-eyebrow">CREATE YOUR VIA ACCOUNT</h1>
            </div>

            <form className="via-signup-form" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  autoComplete="given-name"
                  maxLength={100}
                  icon={<User size={20} />}
                  onChange={(event) =>
                    updateField('firstName', event.target.value)
                  }
                  label="First name"
                  placeholder="First name"
                  value={form.firstName}
                />
                <Input
                  autoComplete="family-name"
                  maxLength={100}
                  icon={<User size={20} />}
                  onChange={(event) =>
                    updateField('lastName', event.target.value)
                  }
                  label="Last name"
                  placeholder="Last name"
                  value={form.lastName}
                />
              </div>

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
                autoComplete="new-password"
                icon={<Lock size={20} />}
                onChange={(event) => updateField('password', event.target.value)}
                label="Password"
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
              />

              <Input
                action={
                  <button
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                    className="via-focus-ring grid place-items-center rounded-[var(--radius-sm)] transition hover:text-[color:var(--via-primary-dark)]"
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    type="button"
                  >
                    {showConfirmPassword ? (
                      <Eye size={20} />
                    ) : (
                      <EyeOff size={20} />
                    )}
                  </button>
                }
                autoComplete="new-password"
                icon={<Lock size={20} />}
                onChange={(event) =>
                  updateField('confirmPassword', event.target.value)
                }
                label="Confirm password"
                placeholder="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
              />

              <Checkbox
                checked={form.acceptedTerms}
                className="via-agreement font-medium"
                label={
                  <>
                  I agree to the{' '}
                  <a className="font-semibold text-[color:var(--via-primary-dark)] underline" href="/terms">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a className="font-semibold text-[color:var(--via-primary-dark)] underline" href="/privacy">
                    Privacy Policy
                  </a>
                  .
                  </>
                }
                onChange={(event) =>
                  updateField('acceptedTerms', event.target.checked)
                }
              />

              {errorMessage ? (
                <p className="via-message via-message-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="via-message via-message-success" role="status">
                  {successMessage}
                </p>
              ) : null}

              <Button
                className="via-create-button w-full"
                isLoading={isSubmitting}
                loadingLabel="Creating account..."
                rightIcon={<ArrowRight size={21} />}
                size="large"
                type="submit"
              >
                Create account
              </Button>
            </form>

            <p className="via-login-link text-center font-medium text-slate-500">
              Already have an account?{' '}
              <Link className="via-login-action font-bold underline" to={authPageLink('/login', destination)}>
                Log in
              </Link>
            </p>
          </GlassCard>
      </section>
    </main>
  )
}
