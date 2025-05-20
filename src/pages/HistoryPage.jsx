import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import RequestsHistoryTable from '../components/RequestsHistoryTable';
import ApiClient from '../components/ApiClient';
import { selectUser } from '../store/authSlice';

const HistoryPage = () => {
  const user = useSelector(selectUser);
  const [requestsHistory, setRequestsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  
  // Use a ref to track if we've already fetched data
  const initialFetchDone = useRef(false);
  
  // Move fetchHistory outside of useCallback for the onRequestUpdate handler
  const fetchHistory = async () => {
    if (!user?.id) {
      setRequestsHistory([]); // Clear history if user logs out
      return;
    }
    
    setHistoryLoading(true);
    setHistoryError(''); // Clear previous errors
    
    try {
      const { success, data, error } = await ApiClient.getRequests();

      if (!success || error) throw new Error(error || 'Failed to fetch requests');

      setRequestsHistory(data || []);
    } catch (err) {
      console.error("Error fetching request history:", err);
      setHistoryError(`Failed to load history: ${err.message}`);
      setRequestsHistory([]); // Clear history on error
    } finally {
      setHistoryLoading(false);
    }
  };

  // Only run on initial render and when userId changes
  useEffect(() => {
    // Skip if we don't have a user yet
    if (!user?.id) return;
    
    // Only fetch data if we haven't already or if userId changed
    if (!initialFetchDone.current) {
      fetchHistory();
      initialFetchDone.current = true;
    }
    
  }, [user?.id]); // Only depend directly on user ID

  return (
    <div className="dashboard-container">
      <div className="history-section">
        {historyError && <div className="error-message">{historyError}</div>}
        <RequestsHistoryTable 
          requests={requestsHistory} 
          isLoading={historyLoading} 
          onRequestUpdate={fetchHistory}
        />
      </div>
    </div>
  );
};

export default HistoryPage; 