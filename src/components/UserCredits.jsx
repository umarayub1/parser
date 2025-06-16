import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser } from '../store/authSlice';
import ApiClient from './ApiClient';
import './UserCredits.css';

function UserCredits() {
  const [credits, setCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const user = useSelector(selectUser);
  
  // Create a memoized refresh function
  const refreshCredits = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const credits = await ApiClient.getCredits();
      setCredits(credits || 0);
    } catch (err) {
      console.error('Error fetching user credits:', err);
      setCredits(0);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    
    const fetchInitialCredits = async () => {
      if (!user || !isMounted) {
        setIsLoading(false);
        return;
      }
      
      await refreshCredits();
    };
    
    fetchInitialCredits();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id, refreshCredits]);

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