import { useState } from 'react'
import { Leaf, LogOut, Menu, X } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

function WorkspaceShell({ items, roleLabel, workspaceTitle }) {
  const { logout, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={`workspace-shell workspace-${user.role}`}>
      <header className="workspace-header">
        <div className="workspace-topline">
          <Link className="brand workspace-brand" to="/" aria-label="SurplusSync home">
            <span className="brand-mark"><Leaf aria-hidden="true" /></span>
            <span className="brand-name">Surplus<span>Sync</span></span>
          </Link>
          <span className="workspace-motto">Good food deserves another destination.</span>
          <div className="workspace-user">
            <span className="workspace-user-avatar" aria-hidden="true">
              {(user.organizationName || user.name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="workspace-user-copy">
              <strong>{user.organizationName || user.name}</strong>
              <small>{roleLabel}</small>
            </span>
            <button className="workspace-signout" onClick={logout} type="button" aria-label="Sign out">
              <LogOut aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
            className="workspace-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <div className={`workspace-nav-row${menuOpen ? ' is-open' : ''}`}>
          <div className="workspace-nav-heading">
            <span className="workspace-nav-kicker">{workspaceTitle}</span>
            <span className="workspace-live"><i aria-hidden="true" /> Live workspace</span>
          </div>
          <nav aria-label={`${workspaceTitle} navigation`} className="workspace-nav">
            {items.map(({ icon: Icon, label, to }) => (
              <NavLink
                className={({ isActive }) => `workspace-nav-link${isActive ? ' active' : ''}`}
                key={to}
                onClick={() => setMenuOpen(false)}
                to={to}
              >
                {Icon && <Icon aria-hidden="true" />}
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="workspace-main">
        <Outlet />
      </main>
      <footer className="workspace-footer">
        <span>SurplusSync</span>
        <span>Better food journeys, built together.</span>
      </footer>
    </div>
  )
}

export default WorkspaceShell
