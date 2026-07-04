import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface AdminNavLinkProps {
  className?: string
  children?: string
}

/** Visible only for admin users — links to /admin (model status + analyses). */
export default function AdminNavLink({
  className = 'btn-nav-pill',
  children = 'Admin',
}: AdminNavLinkProps) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return null

  return (
    <Link to="/admin" className={className}>
      {children}
    </Link>
  )
}
