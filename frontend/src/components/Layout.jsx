import { Link } from 'react-router-dom'
import './Layout.css'

function Layout({ children }) {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1>Ritmo</h1>
          </Link>
          <nav className="nav">
            <Link to="/" className="nav-link">Biblioteca</Link>
          </nav>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
      <footer className="footer">
        <p>&copy; 2025 Ritmo. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}

export default Layout
