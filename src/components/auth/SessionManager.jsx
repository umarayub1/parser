import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getSessionThunk,
  selectUser,
  selectSession,
  selectAuthLoading,
  selectAuthError
} from '../../store/authSlice';

// This component doesn't render anything but handles session management
const SessionManager = () => {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);
  const user = useSelector(selectUser);
  const authLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  
  // State to track if initial session check has been made
  const [initialSessionAttempted, setInitialSessionAttempted] = useState(false);
  
  // --- Auth Listener -> Dispatch to Redux ---
  useEffect(() => {
    // Attempt to get session on initial load if:
    // 1. There's no session in Redux (`!session`)
    // 2. An attempt hasn't already been made (`!initialSessionAttempted`)
    // 3. No auth operation is currently pending (`authLoading !== 'pending'`)
    if (!session && !initialSessionAttempted && authLoading !== 'pending') {
      setInitialSessionAttempted(true); // Mark that we are making the attempt
      dispatch(getSessionThunk());
    }

    // Set up an interval to refresh the session periodically if a user is logged in.
    let sessionRefreshIntervalId = null;
    if (user) { // Only set up interval if there's a logged-in user
      sessionRefreshIntervalId = setInterval(() => {
        // Avoid dispatching if another getSession is already pending from the interval
        if (authLoading !== 'pending') {
          dispatch(getSessionThunk());
        }
      }, 15 * 60 * 1000); // Refresh every 15 minutes
    }

    // Cleanup function
    return () => {
      if (sessionRefreshIntervalId) {
        clearInterval(sessionRefreshIntervalId);
      }
    };
  }, [dispatch, user, session, initialSessionAttempted, authLoading]);

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