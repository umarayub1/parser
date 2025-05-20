import React, { useState, useEffect } from 'react';
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
  const user = useSelector(selectUser);
  
  // Use the useEffect hook with better dependency tracking
  useEffect(() => {
    let isMounted = true;
    const fetchCreditsOnce = debounce(async () => {
      if (!user || !isMounted) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        // ApiClient now handles caching internally
        const credits = await ApiClient.getCredits();
        if (isMounted) {
          setCredits(credits || 0);
        }
      } catch (err) {
        console.error('Error fetching user credits:', err);
        if (isMounted) {
          setCredits(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 300); // 300ms debounce
    
    fetchCreditsOnce();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [user?.id]); // Only re-run if user ID changes, not the entire user object

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
            <span className="credits-value">${credits}</span>
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