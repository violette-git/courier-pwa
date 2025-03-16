import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import AuthForm from './components/AuthForm'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

// Placeholder components for dashboards - these will be implemented in the frontend UI step
const CourierDashboard = () => <div>Courier Dashboard (Coming Soon)</div>
const DispatchDashboard = () => <div>Dispatch Dashboard (Coming Soon)</div>
const AdminDashboard = () => <div>Admin Dashboard (Coming Soon)</div>

function AppRoutes() {
  const { user, userRole } = useAuth()

  // Determine where to redirect authenticated users based on role
  const getHomeRoute = () => {
    if (!user) return '/login'
    
    switch (userRole) {
      case 'courier':
        return '/courier-dashboard'
      case 'dispatcher':
        return '/dispatch-dashboard'
      case 'admin':
        return '/admin-dashboard'
      default:
        return '/login'
    }
  }

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={getHomeRoute()} replace /> : <AuthForm />
      } />
      
      <Route path="/courier-dashboard" element={
        <ProtectedRoute requiredRole="courier">
          <CourierDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/dispatch-dashboard" element={
        <ProtectedRoute requiredRole="dispatcher">
          <DispatchDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/admin-dashboard" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
      
      {/* Redirect to appropriate dashboard or login page */}
      <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <header>
            <h1>Courier Service PWA</h1>
          </header>
          <main>
            <AppRoutes />
          </main>
          <footer>
            <p>© {new Date().getFullYear()} Courier Service PWA</p>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
