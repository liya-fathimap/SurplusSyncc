import { useState } from 'react'
import { Leaf, Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../common/Button.jsx'
import { useAuth } from '../../hooks/useAuth.js'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { getDashboardPath, isAuthenticated, logout, user } = useAuth()

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="container navbar">
        <Link className="brand" to="/" aria-label="SurplusSync home" onClick={closeMenu}>
          <span className="brand-mark">
            <Leaf aria-hidden="true" />
          </span>
          <span className="brand-name">
            Surplus<span>Sync</span>
          </span>
        </Link>

        <nav className={`nav-links${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <Link to="/#how-it-works" onClick={closeMenu}>How it works</Link>
          <Link to="/#benefits" onClick={closeMenu}>Why SurplusSync</Link>
          <Link to="/#impact" onClick={closeMenu}>Our impact</Link>
        </nav>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <span className="nav-user-name">{user.name}</span>
              <Button to={getDashboardPath(user.role)} size="small" variant="secondary">
                Dashboard
              </Button>
              <Button
                onClick={() => {
                  logout()
                  closeMenu()
                }}
                size="small"
                variant="quiet"
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button className="nav-signin" to="/login" variant="quiet" size="small">
                Sign in
              </Button>
              <Button to="/register" size="small">
                Get started
              </Button>
            </>
          )}
          <button
            className="nav-menu-button"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
