import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Import supabase client
import './RequestsHistoryTable.css'; // Import the CSS styles

// Helper function to format date (optional)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return 'Invalid Date';
  }
};

// Enhanced status formatter with icon selection
const StatusBadge = ({ status }) => {
  if (!status) return <span className="status-badge status-badge-unknown">N/A</span>;
  
  let badgeClass = '';
  let icon = null;
  
  switch(status.toLowerCase()) {
    case 'pending':
      badgeClass = 'status-badge-pending';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      );
      break;
    case 'processing':
      badgeClass = 'status-badge-processing';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
      );
      break;
    case 'success':
      badgeClass = 'status-badge-success';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      );
      break;
    case 'error':
    case 'failed':
      badgeClass = 'status-badge-error';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
      break;
    default:
      badgeClass = 'status-badge-unknown';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
  }
  
  // Format the status text
  const formattedText = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  
  return (
    <div className={`status-badge ${badgeClass}`}>
      <span className="status-icon">{icon}</span>
      <span className="status-text">{formattedText}</span>
    </div>
  );
};

function RequestsHistoryTable({ requests, isLoading, onRequestUpdate }) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  if (isLoading) {
    return <p className="history-loading">Loading history...</p>;
  }

  if (!requests || requests.length === 0) {
    return <p className="history-empty">No request history found.</p>;
  }

  const handleRowClick = (requestId, e) => {
    // If the click is on the delete button or its container, don't navigate
    if (e.target.closest('.delete-button-container')) {
      return;
    }
    console.log("Navigating to request details:", requestId);
    navigate(`/requests/${requestId}`);
  };

  // Handle soft delete
  const handleDelete = async (e, requestId) => {
    e.stopPropagation(); // Prevent row click event
    
    if (window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      try {
        setDeletingId(requestId);
        setError('');
        
        // Perform soft delete by updating is_deleted flag
        const { error: deleteError } = await supabase
          .from('requests')
          .update({ is_deleted: true })
          .eq('id', requestId);
          
        if (deleteError) throw deleteError;
        
        // If onRequestUpdate callback exists, call it to refresh the list
        if (typeof onRequestUpdate === 'function') {
          onRequestUpdate();
        } else {
          // Otherwise, filter out the deleted request locally
          const updatedRequests = requests.filter(req => req.id !== requestId);
          // The component will re-render with filtered requests
        }
        
        console.log(`Request ${requestId} soft-deleted successfully`);
      } catch (err) {
        console.error(`Error soft-deleting request ${requestId}:`, err);
        setError(`Failed to delete: ${err.message}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(requests.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, requests.length);
  const currentRequests = requests.slice(startIndex, endIndex);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Delete button with trash icon
  const DeleteButton = ({ requestId }) => (
    <button 
      className={`delete-button ${deletingId === requestId ? 'deleting' : ''}`}
      onClick={(e) => handleDelete(e, requestId)}
      disabled={deletingId === requestId}
      title="Delete request"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
      {deletingId === requestId && <span className="delete-spinner"></span>}
    </button>
  );

  return (
    <div className="history-table-container">
      <h2>History</h2>
      {error && <div className="history-error">{error}</div>}
      <div className="history-table-wrapper">
        <table className="history-table">
          <thead className="history-table-head">
            <tr>
              <th className="history-table-header">File Name</th>
              <th className="history-table-header">Created At</th>
              <th className="history-table-header pages-column">Pages</th>
              <th className="history-table-header status-column">Parsing Status</th>
              <th className="history-table-header offset-column">Balance Offset</th>
              <th className="history-table-header actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRequests.map((req) => (
              <tr
                key={req.id}
                onClick={(e) => handleRowClick(req.id, e)}
                className="history-table-row"
              >
                <td className="history-table-cell" data-label="File Name">{req.file_name || 'N/A'}</td>
                <td className="history-table-cell" data-label="Created At">{formatDate(req.created_at)}</td>
                <td className="history-table-cell pages-column" data-label="Pages">{req.page_count ?? 'N/A'}</td>
                <td className="history-table-cell status-column" data-label="Parsing Status">
                  <StatusBadge status={req.parsing_status} />
                </td>
                <td className="history-table-cell offset-column" data-label="Balance Offset">
                  {req.parsed_data?.meta_data?.["Ending Balance Offset"]}
                </td>
                <td className="history-table-cell actions-column" data-label="Actions">
                  <div className="delete-button-container">
                    <DeleteButton requestId={req.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="history-pagination">
          <div className="pagination-info">
            Showing {startIndex + 1}-{endIndex} of {requests.length} entries
          </div>
          <div className="pagination-controls">
            <button 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
              className={`pagination-button ${currentPage === 1 ? 'disabled' : ''}`}
            >
              Previous
            </button>
            <span className="pagination-pages">
              {currentPage} of {totalPages}
            </span>
            <button 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
              className={`pagination-button ${currentPage === totalPages ? 'disabled' : ''}`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequestsHistoryTable; 