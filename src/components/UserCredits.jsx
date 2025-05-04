import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser } from '../store/authSlice';
import { supabase } from '../supabaseClient';

function UserCredits() {
  const [credits, setCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const user = useSelector(selectUser);

  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('credits_remaining')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        setCredits(data?.credits_remaining || 0);
      } catch (err) {
        console.error('Error fetching user credits:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserCredits();
  }, [user]);

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
          <div className="credits-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="credits-content">
            <span className="credits-label">Credits</span>
            <span className="credits-value">{credits}</span>
          </div>
          {credits < 5 && (
            <Link to="/crypto-top-up" className="credits-action">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default UserCredits; 