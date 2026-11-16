import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from '../context/authContext.js'
import ProtectedRoute from '../routes/ProtectedRoute.jsx'

afterEach(cleanup)

function renderProtectedPath(authValue) {
  return render(
    <AuthContext.Provider value={{
      getDashboardPath: (role) => `/${role}/dashboard`,
      status: 'anonymous',
      user: null,
      ...authValue,
    }}>
      <MemoryRouter initialEntries={['/provider/dashboard']}>
        <Routes>
          <Route element={<p>Login page</p>} path="/login" />
          <Route element={<ProtectedRoute allowedRoles={['provider']} />} path="/provider">
            <Route element={<p>Provider dashboard</p>} path="dashboard" />
          </Route>
          <Route element={<p>NGO dashboard</p>} path="/ngo/dashboard" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('protected dashboard routes', () => {
  it('redirects anonymous visitors to login', () => {
    renderProtectedPath()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('sends authenticated users with a different role to their own dashboard', () => {
    renderProtectedPath({
      status: 'authenticated',
      user: { role: 'ngo' },
    })
    expect(screen.getByText('NGO dashboard')).toBeInTheDocument()
  })

  it('renders the dashboard for the permitted role', () => {
    renderProtectedPath({
      status: 'authenticated',
      user: { role: 'provider' },
    })
    expect(screen.getByText('Provider dashboard')).toBeInTheDocument()
  })
})
