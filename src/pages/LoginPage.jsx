import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { login, signInWithOAuthThunk, selectSession, selectAuthLoading, selectAuthError } from '../store/authSlice';
import '../styles/auth.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const session = useSelector(selectSession);
  const authLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  
  // Single redirection effect based on session state
  useEffect(() => {
    if (session) {
      console.log("Session detected, redirecting to requests");
      navigate('/requests');
    }
  }, [session, navigate]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      console.log("Attempting login with email:", email);
      
      // Use Redux login thunk
      const resultAction = await dispatch(login({ email, password }));
      
      // Check if the login was successful
      if (login.rejected.match(resultAction)) {
        // Extract the error message from the rejected action
        const error = resultAction.payload || resultAction.error.message;
        throw new Error(error);
      }
      
      // The session change will trigger the useEffect for navigation
    } catch (err) {
      setError(err.message);
      console.error('Error logging in:', err);
    }
  };
  
  const handleOAuthSignIn = async (provider) => {
    try {
      setError(null);
      
      // Use Redux OAuth thunk instead of direct Supabase call
      console.log(`OAuth signin with ${provider}`);
      await dispatch(signInWithOAuthThunk({ provider }));
      
      // OAuth flow will redirect the user, so no need for navigation here
    } catch (err) {
      setError(err.message);
      console.error(`OAuth sign-in error (${provider}):`, err);
    }
  };
  
  // If already logged in, show loading or redirect immediately
  if (session) {
    return <Navigate to="/requests" />;
  }
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to your account</p>
        </div>
        
        {(error || authError) && (
          <div className="auth-error">
            <svg className="error-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error || authError}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <div className={`input-wrapper ${isEmailFocused || email ? 'focused' : ''}`}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
                required
                disabled={authLoading === 'pending'}
                className="modern-input"
              />
              <label htmlFor="email" className="floating-label">Email address</label>
            </div>
          </div>
          
          <div className="form-group">
            <div className={`input-wrapper ${isPasswordFocused || password ? 'focused' : ''}`}>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                required
                disabled={authLoading === 'pending'}
                className="modern-input"
              />
              <label htmlFor="password" className="floating-label">Password</label>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="auth-button primary" 
            disabled={authLoading === 'pending'}
          >
            {authLoading === 'pending' ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
        
        <div className="auth-divider">
          <span>or continue with</span>
        </div>
        
        <div className="oauth-buttons">
          <button 
            onClick={() => handleOAuthSignIn('google')}
            className="auth-button google"
            disabled={authLoading === 'pending'}
          >
            <svg className="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>
        
        <p className="auth-link">
          Don't have an account? <Link to="/signup">Create account</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage; 