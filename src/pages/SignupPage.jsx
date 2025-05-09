import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { signup, signInWithOAuthThunk, selectSession, selectAuthLoading, selectAuthError } from '../store/authSlice';
import '../styles/auth.css';

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
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
  
  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    
    // Password validation
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    try {
      console.log("Attempting signup with email:", email);
      
      // Use Redux signup thunk instead of direct Supabase call
      const resultAction = await dispatch(signup({ 
        email, 
        password,
        fullName // Include full name if provided
      }));
      
      // Check if the signup was successful
      if (signup.fulfilled.match(resultAction)) {
        setMessage("Registration successful! Please check your email (and spam folder) to confirm your account.");
        
        // In some Supabase configurations, signup might automatically log in the user
        if (resultAction.payload.session) {
          console.log("Signup created session, logging in user:", resultAction.payload.session);
          // Navigate programmatically after successful signup with auto-login
          navigate('/');
        }
      } else if (signup.rejected.match(resultAction)) {
        // Check if email already exists
        if (resultAction.payload && resultAction.payload.includes("already exists")) {
          setError("Email already exists. Please log in instead.");
        } else {
          // Extract the error message from the rejected action
          const error = resultAction.payload || resultAction.error.message;
          throw new Error(error);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Error signing up:', err);
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
        <h1>Sign Up</h1>
        
        {error && <div className="auth-error">{error}</div>}
        {authError && <div className="auth-error">{authError}</div>}
        {message && <div className="auth-message">{message}</div>}
        
        <form onSubmit={handleSignup} className="auth-form">
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
            <label htmlFor="fullName">Full Name (optional)</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={authLoading === 'pending'}
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button primary" 
            disabled={authLoading === 'pending'}
          >
            {authLoading === 'pending' ? 'Signing up...' : 'Sign Up'}
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
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage; 