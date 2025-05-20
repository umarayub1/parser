import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import RequestsHistoryTable from '../components/RequestsHistoryTable';
import ApiClient from '../components/ApiClient';
import { selectUser } from '../store/authSlice';

const HistoryPage = () => {
  const user = useSelector(selectUser);
  const [requestsHistory, setRequestsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // --- Fetch Request History when user logs in ---
  const fetchHistory = useCallback(async () => {
    if (!user?.id) {
      setRequestsHistory([]); // Clear history if user logs out
      return;
    }

    console.log("Fetching request history for user:", user.id);
    setHistoryLoading(true);
    setHistoryError(''); // Clear previous errors
    try {
      const { success, data, error } = await ApiClient.getRequests();

      if (!success || error) throw new Error(error || 'Failed to fetch requests');

      console.log("Fetched history:", data);
      setRequestsHistory(data || []);
    } catch (err) {
      console.error("Error fetching request history:", err);
      setHistoryError(`Failed to load history: ${err.message}`);
      setRequestsHistory([]); // Clear history on error
    } finally {
      setHistoryLoading(false);
    }
  }, [user]); // Re-fetch when user object changes (login/logout)

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]); // Use the callback in the dependency array

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