import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import RequestsHistoryTable from '../components/RequestsHistoryTable';
import NewRequestModal from '../components/NewRequestModal';
import ApiClient from '../components/ApiClient';
import { selectUser } from '../store/authSlice';

const HistoryPage = () => {
  const user = useSelector(selectUser);
  const [requestsHistory, setRequestsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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

  const handleNewRequestsCreated = (createdRequestIds) => {
    console.log('New requests created:', createdRequestIds);
    // Refresh the history to show the new requests
    fetchHistory();
  };

  const getStatusSummary = () => {
    if (!requestsHistory.length) return null;
    
    const summary = requestsHistory.reduce((acc, req) => {
      const status = req.parsing_status?.toLowerCase() || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    return summary;
  };

  const statusSummary = getStatusSummary();

  return (
    <div className="history-page">
      <div className="history-container">
        <div className="history-header">
          <div className="header-content">
            <div className="header-text">
              <h1>Request History</h1>
              <p>View and manage your bank statement parsing requests</p>
            </div>
            {user && (
              <button 
                className="new-request-button"
                onClick={() => setIsModalOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                New Request
              </button>
            )}
          </div>
          
          {statusSummary && requestsHistory.length > 0 && (
            <div className="status-summary">
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-number">{requestsHistory.length}</div>
                  <div className="summary-label">Total Requests</div>
                </div>
                {statusSummary.success && (
                  <div className="summary-card success">
                    <div className="summary-number">{statusSummary.success}</div>
                    <div className="summary-label">Completed</div>
                  </div>
                )}
                {statusSummary.processing && (
                  <div className="summary-card processing">
                    <div className="summary-number">{statusSummary.processing}</div>
                    <div className="summary-label">Processing</div>
                  </div>
                )}
                {statusSummary.pending && (
                  <div className="summary-card pending">
                    <div className="summary-number">{statusSummary.pending}</div>
                    <div className="summary-label">Pending</div>
                  </div>
                )}
                {(statusSummary.error || statusSummary.failed) && (
                  <div className="summary-card error">
                    <div className="summary-number">{(statusSummary.error || 0) + (statusSummary.failed || 0)}</div>
                    <div className="summary-label">Failed</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="history-content">
          {historyError && (
            <div className="error-banner">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              {historyError}
            </div>
          )}
          
          <RequestsHistoryTable 
            requests={requestsHistory} 
            isLoading={historyLoading} 
            onRequestUpdate={fetchHistory}
          />
        </div>
      </div>
      
      <NewRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRequestsCreated={handleNewRequestsCreated}
      />
    </div>
  );
};

export default HistoryPage; 