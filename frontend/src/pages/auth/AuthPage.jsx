import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Leaf } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import Footer from '../../components/layout/Footer.jsx'
import Navbar from '../../components/layout/Navbar.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { getApiErrorMessage } from '../../services/authService.js'

const publicRoles = [
  { value: 'provider', label: 'Food provider' },
  { value: 'ngo', label: 'NGO or community kitchen' },
  { value: 'volunteer', label: 'Delivery volunteer' },
]

function validateForm(form, mode) {
  const errors = {}
  const email = form.email.trim()

  if (mode === 'register' && !form.name.trim()) {
    errors.name = 'Please enter your name.'
  }
  if (!email) {
    errors.email = 'Please enter your email address.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (!form.password) {
    errors.password = 'Please enter your password.'
  } else if (mode === 'register' && form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  } else if (
    mode === 'register' &&
    new TextEncoder().encode(form.password).length > 72
  ) {
    errors.password = 'Password cannot exceed 72 UTF-8 bytes.'
  }
  if (mode === 'register' && form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }
  if (mode === 'register' && !publicRoles.some(({ value }) => value === form.role)) {
    errors.role = 'Choose a valid account type.'
  }
  return errors
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { getDashboardPath, isAuthenticated, login, register, status, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'provider',
    organizationName: '',
    phone: '',
    address: '',
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (status === 'loading') {
    return (
      <div className="site-shell">
        <Navbar />
        <main className="route-loading"><Loading label="Checking your session…" /></main>
        <Footer />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate replace to={getDashboardPath(user.role)} />
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setApiError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationErrors = validateForm(form, mode)
    setErrors(validationErrors)
    setApiError('')
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      const credentials = isRegister
        ? {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            organizationName: form.organizationName.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
          }
        : { email: form.email.trim(), password: form.password }
      const user = isRegister
        ? await register(credentials)
        : await login(credentials)
      const requestedPath = location.state?.from?.pathname
      const safeRequestedPath = requestedPath?.startsWith(`/${user.role}/`)
        ? requestedPath
        : null
      navigate(safeRequestedPath || getDashboardPath(user.role), { replace: true })
    } catch (error) {
      setApiError(
        error instanceof Error && !error.response
          ? error.message
          : getApiErrorMessage(error),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const passwordType = showPassword ? 'text' : 'password'

  return (
    <div className="site-shell">
      <Navbar />
      <main className="auth-page">
        <div className="auth-layout">
          <section className="auth-aside">
            <span className="auth-aside-mark"><Leaf aria-hidden="true" /></span>
            <span className="eyebrow">{isRegister ? 'Join the network' : 'Welcome back'}</span>
            <h1>{isRegister ? 'Good food goes further together.' : 'Good to have you back.'}</h1>
            <p>
              {isRegister
                ? 'Connect with local partners and make food sharing easier for your community.'
                : 'Sign in to pick up where you left off and stay connected with your partners.'}
            </p>
            <Link className="auth-back-link" to="/">
              <ArrowLeft aria-hidden="true" /> Back to home
            </Link>
          </section>

          <Card className="auth-form-card">
            <div className="auth-form-heading">
              <span className="eyebrow">{isRegister ? 'Create your account' : 'Account access'}</span>
              <h2>{isRegister ? 'Get started with SurplusSync' : 'Sign in to your account'}</h2>
              <p>
                {isRegister
                  ? 'Choose how you would like to take part.'
                  : 'Enter the email and password associated with your account.'}
              </p>
            </div>

            {apiError && (
              <div className="auth-alert" role="alert">
                {apiError}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {isRegister && (
                <>
                  <label className="form-field">
                    <span>Full name <span className="required-mark">*</span></span>
                    <input
                      autoComplete="name"
                      name="name"
                      onChange={updateField}
                      placeholder="Your name"
                      value={form.name}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                    />
                    {errors.name && <span className="field-error" id="name-error">{errors.name}</span>}
                  </label>

                  <label className="form-field">
                    <span>I am joining as <span className="required-mark">*</span></span>
                    <select name="role" onChange={updateField} value={form.role}>
                      {publicRoles.map(({ label, value }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {errors.role && <span className="field-error">{errors.role}</span>}
                  </label>

                  {(form.role === 'provider' || form.role === 'ngo') && (
                    <label className="form-field">
                      <span>{form.role === 'ngo' ? 'Organization name' : 'Business name'}</span>
                      <input
                        autoComplete="organization"
                        name="organizationName"
                        onChange={updateField}
                        placeholder={form.role === 'ngo' ? 'Community organization' : 'Food business'}
                        value={form.organizationName}
                      />
                    </label>
                  )}
                </>
              )}

              <label className="form-field">
                <span>Email address <span className="required-mark">*</span></span>
                <input
                  autoComplete="email"
                  name="email"
                  onChange={updateField}
                  placeholder="you@example.com"
                  type="email"
                  value={form.email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && <span className="field-error" id="email-error">{errors.email}</span>}
              </label>

              {isRegister && (
                <label className="form-field">
                  <span>Phone number <span className="optional-label">Optional</span></span>
                  <input
                    autoComplete="tel"
                    name="phone"
                    onChange={updateField}
                    placeholder="Your contact number"
                    type="tel"
                    value={form.phone}
                  />
                </label>
              )}

              <label className="form-field">
                <span>Password <span className="required-mark">*</span></span>
                <span className="password-input-wrap">
                  <input
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    name="password"
                    onChange={updateField}
                    placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'}
                    type={passwordType}
                    value={form.password}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    className="password-visibility"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
                {errors.password && <span className="field-error" id="password-error">{errors.password}</span>}
              </label>

              {isRegister && (
                <label className="form-field">
                  <span>Confirm password <span className="required-mark">*</span></span>
                  <input
                    autoComplete="new-password"
                    name="confirmPassword"
                    onChange={updateField}
                    placeholder="Enter your password again"
                    type={passwordType}
                    value={form.confirmPassword}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  />
                  {errors.confirmPassword && (
                    <span className="field-error" id="confirm-password-error">{errors.confirmPassword}</span>
                  )}
                </label>
              )}

              {isRegister && (
                <p className="auth-form-note">
                  Admin accounts are created privately and cannot be registered here.
                </p>
              )}

              <Button className="auth-submit" disabled={submitting} type="submit" size="large">
                {submitting
                  ? <Loading label={isRegister ? 'Creating account…' : 'Signing in…'} />
                  : isRegister ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <p className="auth-alternate">
              {isRegister ? 'Already have an account?' : 'New to SurplusSync?'}{' '}
              <Link to={isRegister ? '/login' : '/register'}>
                {isRegister ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AuthPage
