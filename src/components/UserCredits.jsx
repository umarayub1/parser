import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser } from '../store/authSlice';
import ApiClient from './ApiClient';
import './UserCredits.css';

// Create a debounce helper function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

function UserCredits() {
  const [credits, setCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const user = useSelector(selectUser);
  
  // Create a memoized refresh function
  const refreshCredits = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const credits = await ApiClient.getCredits(forceRefresh);
      setCredits(credits || 0);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error('Error fetching user credits:', err);
      setCredits(0);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Debounced version of refresh
  const debouncedRefresh = useCallback(
    debounce(() => refreshCredits(false), 300),
    [refreshCredits]
  );

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    
    const fetchInitialCredits = async () => {
      if (!user || !isMounted) {
        setIsLoading(false);
        return;
      }
      
      await refreshCredits(false);
    };
    
    fetchInitialCredits();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id, refreshCredits]);

  // Listen for page visibility changes to refresh credits when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        const timeSinceLastRefresh = Date.now() - lastRefresh;
        // Only refresh if it's been more than 30 seconds since last refresh
        if (timeSinceLastRefresh > 30000) {
          debouncedRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, lastRefresh, debouncedRefresh]);

  // Listen for storage events to refresh credits when another tab updates them
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'credits_updated' && user) {
        debouncedRefresh();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, debouncedRefresh]);

  if (!user) {
    return null;
  }

  return (
    <div className="credits-wrapper">
      {isLoading ? (
        <div className="user-credits skeleton-credits">
          <div className="credit-pulse"></div>
        </div>
      ) : (
        <div className={`user-credits ${credits < 5 ? 'low-credits' : ''}`}>
          <div className="credits-content">
            <span className="credits-value">{credits.toFixed(1)}</span>
          </div>
          {credits < 5 && (
            <Link to="/top-up" className="credits-action" title="Add Credits">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default UserCredits; 