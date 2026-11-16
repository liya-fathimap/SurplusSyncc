import { LogOut, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import Footer from '../components/layout/Footer.jsx'
import Navbar from '../components/layout/Navbar.jsx'

const roleTitles = {
  provider: 'Provider dashboard',
  ngo: 'NGO dashboard',
  volunteer: 'Volunteer dashboard',
  admin: 'Admin dashboard',
}

function DashboardPage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="site-shell">
      <Navbar />
      <main className="dashboard-placeholder">
        <div className="container">
          <div className="dashboard-welcome">
            <span className="eyebrow"><ShieldCheck aria-hidden="true" /> Signed in securely</span>
            <h1>{roleTitles[user.role] || 'Dashboard'}</h1>
            <p>
              Welcome, {user.name}. You are signed in as {user.role}.
              Role-specific platform features will appear here as they are built.
            </p>
          </div>
          <Card className="dashboard-user-card">
            <div>
              <span className="dashboard-user-label">Signed in account</span>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <Button onClick={handleLogout} variant="secondary">
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default DashboardPage
