import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from '../context/authContext.js'
import AuthPage from '../pages/auth/AuthPage.jsx'

afterEach(cleanup)

function renderAuthPage(mode, authValue) {
  return render(
    <AuthContext.Provider value={{
      getDashboardPath: (role) => `/${role}/dashboard`,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      status: 'anonymous',
      user: null,
      ...authValue,
    }}>
      <MemoryRouter initialEntries={[`/${mode}`]}>
        <Routes>
          <Route element={<AuthPage mode={mode} />} path={`/${mode}`} />
          <Route element={<p>Volunteer dashboard</p>} path="/volunteer/dashboard" />
          <Route element={<p>Provider dashboard</p>} path="/provider/dashboard" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('authentication form', () => {
  it('validates required fields before making a login request', async () => {
    const user = userEvent.setup()
    const login = vi.fn()
    renderAuthPage('login', { login })

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Please enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Please enter your password.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('submits registration using a public role and routes to the new account dashboard', async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockResolvedValue({ role: 'volunteer' })
    renderAuthPage('register', { register })

    const roleSelect = screen.getByLabelText(/I am joining as/)
    expect([...roleSelect.options].map((option) => option.value)).toEqual([
      'provider',
      'ngo',
      'volunteer',
    ])

    await user.type(screen.getByLabelText(/Full name/), 'Taylor Volunteer')
    await user.selectOptions(roleSelect, 'volunteer')
    await user.type(screen.getByLabelText(/Email address/), 'taylor@example.test')
    await user.type(screen.getByLabelText(/^Password/), 'Test-password-123!')
    await user.type(screen.getByLabelText(/Confirm password/), 'Test-password-123!')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Volunteer dashboard')).toBeInTheDocument()
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      email: 'taylor@example.test',
      role: 'volunteer',
      name: 'Taylor Volunteer',
    }))
  })

  it('shows backend errors without losing the form values', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue({
      response: { data: { message: 'Invalid email or password.' } },
    })
    renderAuthPage('login', { login })

    await user.type(screen.getByLabelText(/Email address/), 'missing@example.test')
    await user.type(screen.getByLabelText(/^Password/), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByLabelText(/Email address/)).toHaveValue('missing@example.test')
  })
})
