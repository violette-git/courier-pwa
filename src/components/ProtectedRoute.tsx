import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string | string[]
}

export default function ProtectedRoute({ 
  children, 
  requiredRole 
}: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Role check if requiredRole is specified
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    
    if (!userRole || !roles.includes(userRole)) {
      // Redirect to appropriate dashboard based on actual role
      if (userRole === 'courier') {
        return <Navigate to="/courier-dashboard" replace />
      } else if (userRole === 'dispatcher') {
        return <Navigate to="/dispatch-dashboard" replace />
      } else if (userRole === 'admin') {
        return <Navigate to="/admin-dashboard" replace />
      } else {
        // Fallback to login if role is unknown
        return <Navigate to="/login" replace />
      }
    }
  }

  // User is authenticated and has required role (if specified)
  return <>{children}</>
}
