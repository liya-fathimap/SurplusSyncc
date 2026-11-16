import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Loading from '../components/common/Loading.jsx'
import { useAuth } from '../hooks/useAuth.js'

function ProtectedRoute({ allowedRoles }) {
  const { getDashboardPath, status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="route-loading">
        <Loading label="Checking your session…" />
      </main>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate replace to="/login" state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate replace to={getDashboardPath(user.role)} />
  }

  return <Outlet />
}

export default ProtectedRoute
