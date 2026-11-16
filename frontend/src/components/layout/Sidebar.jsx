import { LayoutDashboard } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Leaf } from 'lucide-react'

function Sidebar({ items = [], title = 'Workspace' }) {
  return (
    <aside className="sidebar" aria-label={`${title} navigation`}>
      <NavLink className="brand" to="/" aria-label="SurplusSync home">
        <span className="brand-mark">
          <Leaf aria-hidden="true" />
        </span>
        <span className="brand-name">
          Surplus<span>Sync</span>
        </span>
      </NavLink>

      <p className="sidebar-heading">{title}</p>
      <nav className="sidebar-nav">
        {items.map(({ icon: Icon = LayoutDashboard, label, to }) => (
          <NavLink
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            key={to}
            to={to}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
