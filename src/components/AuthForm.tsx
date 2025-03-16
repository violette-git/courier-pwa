import { useState } from 'react'
import { supabase } from '../main'

interface AuthFormProps {
  onSuccess?: () => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [userRole, setUserRole] = useState('courier')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      setMessage('Login successful!')
      if (onSuccess) onSuccess()
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            user_role: userRole,
          },
        },
      })

      if (authError) throw authError

      // If auth signup successful, insert the user profile data
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email,
              full_name: fullName,
              phone,
              user_role: userRole,
            },
          ])

        if (profileError) throw profileError

        // If user is a courier, create courier profile
        if (userRole === 'courier') {
          const { error: courierError } = await supabase
            .from('courier_profiles')
            .insert([
              {
                id: authData.user.id,
              },
            ])

          if (courierError) throw courierError
        }

        // If user is a dispatcher, create dispatcher profile
        if (userRole === 'dispatcher') {
          const { error: dispatcherError } = await supabase
            .from('dispatcher_profiles')
            .insert([
              {
                id: authData.user.id,
              },
            ])

          if (dispatcherError) throw dispatcherError
        }
      }

      setMessage('Account created successfully! Please check your email for confirmation.')
      setIsSignUp(false)
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-form">
      <h2>{isSignUp ? 'Create Account' : 'Login'}</h2>
      
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}
      
      <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        {isSignUp && (
          <>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="userRole">Role</label>
              <select
                id="userRole"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                required
              >
                <option value="courier">Courier</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </>
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      
      <div className="auth-toggle">
        <button onClick={() => setIsSignUp(!isSignUp)} className="link-button">
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </div>
  )
}
