import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser } from '../store/authSlice';
import { supabase } from '../supabaseClient';
import './UserCredits.css';

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