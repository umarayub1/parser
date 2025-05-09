import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { login, signInWithOAuthThunk, selectSession, selectAuthLoading, selectAuthError } from '../store/authSlice';
import '../styles/auth.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const session = useSelector(selectSession);
  const authLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  
  // Check for session on initial render and when session changes
  useEffect(() => {
    if (session) {
      console.log("Session detected, will redirect to home");
      // Short delay to ensure state updates complete
      setTimeout(() => {
        setShouldRedirect(true);
      }, 100);
    }
  }, [session]);
  
  // Handle the redirect when shouldRedirect becomes true
  useEffect(() => {
    if (shouldRedirect) {
      console.log("Redirecting to home page now");
      navigate('/');
    }
  }, [shouldRedirect, navigate]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      console.log("Attempting login with email:", email);
      
      // Use Redux login thunk instead of direct Supabase call
      const resultAction = await dispatch(login({ email, password }));
      
      // Check if the login was successful
      if (login.fulfilled.match(resultAction)) {
        console.log("Login successful, session data:", resultAction.payload.session);
        
        // Navigate programmatically after successful login
        console.log("Login successful, navigating to home");
        navigate('/');
      } else if (login.rejected.match(resultAction)) {
        // Extract the error message from the rejected action
        const error = resultAction.payload || resultAction.error.message;
        throw new Error(error);
      }
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
  
  // If already logged in and redirect is ready, redirect to home
  if (shouldRedirect && session) {
    console.log("Rendering redirect to home");
    return <Navigate to="/" />;
  }
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Login</h1>
        
        {error && <div className="auth-error">{error}</div>}
        {authError && <div className="auth-error">{authError}</div>}
        
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={authLoading === 'pending'}
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
              disabled={authLoading === 'pending'}
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button primary" 
            disabled={authLoading === 'pending'}
          >
            {authLoading === 'pending' ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="auth-divider">
          <span>OR</span>
        </div>
        
        <div className="oauth-buttons">
          <button 
            onClick={() => handleOAuthSignIn('google')}
            className="auth-button google"
            disabled={authLoading === 'pending'}
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              className="google-logo" 
            />
            Continue with Google
          </button>
        </div>
        
        <p className="auth-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage; 