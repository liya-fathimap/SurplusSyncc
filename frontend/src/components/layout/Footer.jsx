import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <p>© {new Date().getFullYear()} SurplusSync. Less waste, more good.</p>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Get started</Link>
        </nav>
      </div>
    </footer>
  )
}

export default Footer
