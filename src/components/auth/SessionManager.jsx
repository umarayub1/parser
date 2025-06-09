import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
  getSessionThunk,
  selectUser,
  selectSession,
  selectAuthLoading,
  selectAuthError,
  setSession,
  setUser
} from '../../store/authSlice';

// Add a timeout value to control how often we check sessions
const SESSION_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// This component doesn't render anything but handles session management
const SessionManager = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSelector(selectSession);
  const user = useSelector(selectUser);
  const authLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  
  // State to track if initial session check has been made
  const [initialSessionAttempted, setInitialSessionAttempted] = useState(false);
  // Track the last session refresh timestamp
  const [lastSessionRefresh, setLastSessionRefresh] = useState(0);
  
  // Set up Supabase auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Supabase auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
          // User signed in (including OAuth)
          dispatch(setSession(session));
          dispatch(setUser(session.user));
          
          // Clear URL hash if present (from OAuth callback)
          if (window.location.hash) {
            window.history.replaceState(null, null, window.location.pathname);
          }
          
          // Navigate to main app if not already there
          if (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/') {
            navigate('/requests');
          }
        } else if (event === 'SIGNED_OUT') {
          // User signed out
          dispatch(setSession(null));
          dispatch(setUser(null));
          
          // Navigate to login if not on public pages
          if (!['/login', '/signup', '/contact', '/'].includes(location.pathname)) {
            navigate('/login');
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token was refreshed
          dispatch(setSession(session));
          dispatch(setUser(session.user));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch, navigate, location.pathname]);
  
  // Handle OAuth callback on component mount
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check if we're returning from OAuth (hash contains auth tokens)
      if (window.location.hash && window.location.hash.includes('access_token')) {
        try {
          console.log('OAuth callback detected, processing tokens...');
          
          // Get session from Supabase (this will process the tokens from the URL hash)
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error processing OAuth callback:', error);
            return;
          }
          
          if (session) {
            console.log('OAuth session established:', session.user?.email);
            
            // Update Redux state
            dispatch(setSession(session));
            dispatch(setUser(session.user));
            
            // Clear the hash from URL
            window.history.replaceState(null, null, window.location.pathname);
            
            // Navigate to the main app
            navigate('/requests');
          }
        } catch (error) {
          console.error('OAuth callback processing error:', error);
        }
      }
    };
    
    // Only run on initial mount
    handleAuthCallback();
  }, []); // Empty dependency array - only run once on mount
  
  // --- Auth Listener -> Dispatch to Redux ---
  useEffect(() => {
    // Don't run another call if one is in progress
    if (authLoading === 'pending') {
      return;
    }
    
    // Get current time
    const now = Date.now();
    
    // Determine if we should refresh based on:
    // 1. No session in Redux (`!session`) AND not attempted yet
    // 2. OR enough time has passed since last refresh for a logged-in user
    const shouldRefreshSession = 
      (!session && !initialSessionAttempted) || 
      (user && (now - lastSessionRefresh) > SESSION_REFRESH_INTERVAL);
    
    if (shouldRefreshSession) {
      if (!initialSessionAttempted) {
        setInitialSessionAttempted(true);
      }
      
      // Update last refresh timestamp
      setLastSessionRefresh(now);
      
      // Dispatch session check
      dispatch(getSessionThunk());
    }
    
    // No interval needed - we'll use the timestamp tracking approach
    
    // No cleanup function required since we're not using intervals
  }, [dispatch, user, session, initialSessionAttempted, authLoading, lastSessionRefresh]);

  // --- Display Auth Error (from Redux) ---
  useEffect(() => {
    if (authError) {
      console.error(`Authentication Error: ${authError}`);
      
      // If the error indicates token expiration or invalid session, clear the Redux state
      if (authError.includes('expired') || authError.includes('Invalid or expired session')) {
        dispatch(setSession(null));
        dispatch(setUser(null));
      }
    }
  }, [authError, dispatch]);

  // This component doesn't render anything
  return null;
};

export default SessionManager; 