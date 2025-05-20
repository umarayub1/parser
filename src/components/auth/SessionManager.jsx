import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getSessionThunk,
  selectUser,
  selectSession,
  selectAuthLoading,
  selectAuthError
} from '../../store/authSlice';

// Add a timeout value to control how often we check sessions
const SESSION_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// This component doesn't render anything but handles session management
const SessionManager = () => {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);
  const user = useSelector(selectUser);
  const authLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  
  // State to track if initial session check has been made
  const [initialSessionAttempted, setInitialSessionAttempted] = useState(false);
  // Track the last session refresh timestamp
  const [lastSessionRefresh, setLastSessionRefresh] = useState(0);
  
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
    }
  }, [authError]);

  // This component doesn't render anything
  return null;
};

export default SessionManager; 