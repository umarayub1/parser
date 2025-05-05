import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function RequestsHistoryTable({ requests, isLoading }) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  if (isLoading) {
    return <p>Loading history...</p>;
  }

  if (!requests || requests.length === 0) {
    return <p>No request history found.</p>;
  }

  const handleRowClick = (requestId) => {
    console.log("Navigating to request details:", requestId);
    navigate(`/requests/${requestId}`);
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

  // Table styles
  const tableStyles = {
    container: {
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: '20px',
      marginBottom: '20px'
    },
    tableWrapper: {
      height: `${rowsPerPage * 53}px`, // Fixed height container
      overflowY: 'hidden',
      marginBottom: '16px'
    },
    tableHeader: {
      fontWeight: '600',
      background: '#f5f7fa',
      color: '#4a5568',
      textAlign: 'left',
      padding: '12px 16px',
      borderBottom: '2px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 10
    },
    table: { 
      width: '100%', 
      borderCollapse: 'collapse',
      marginTop: '12px',
      tableLayout: 'fixed' // Ensure columns maintain equal width
    },
    row: {
      cursor: 'pointer',
      borderBottom: '1px solid #edf2f7',
      transition: 'background-color 0.2s',
      height: '53px' // Explicit row height
    },
    cell: {
      padding: '12px 16px',
      fontSize: '0.95rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    col1: { width: '30%' }, // File name column
    col2: { width: '20%' }, // Created At column
    col3: { width: '10%' }, // Pages column
    col4: { width: '20%' }, // Parsing Status column
    col5: { width: '20%' }, // Balance Offset column
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0'
    },
    pageInfo: {
      fontSize: '0.9rem',
      color: '#4a5568'
    },
    pageButton: {
      background: '#edf2f7',
      border: 'none',
      borderRadius: '4px',
      padding: '8px 16px',
      cursor: 'pointer',
      color: '#4a5568',
      fontWeight: '500',
      margin: '0 4px',
      transition: 'background-color 0.2s'
    },
    disabledButton: {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  };

  return (
    <div style={tableStyles.container} className="history-table-container">
      <h2>History</h2>
      <div style={tableStyles.tableWrapper}>
        <table style={tableStyles.table}>
          <colgroup>
            <col style={tableStyles.col1} />
            <col style={tableStyles.col2} />
            <col style={tableStyles.col3} />
            <col style={tableStyles.col4} />
            <col style={tableStyles.col5} />
          </colgroup>
          <thead>
            <tr>
              <th style={tableStyles.tableHeader}>File Name</th>
              <th style={tableStyles.tableHeader}>Created At</th>
              <th style={tableStyles.tableHeader}>Pages</th>
              <th style={tableStyles.tableHeader}>Parsing Status</th>
              <th style={tableStyles.tableHeader}>Balance Offset</th>
            </tr>
          </thead>
          <tbody>
            {currentRequests.map((req) => (
              <tr
                key={req.id}
                onClick={() => handleRowClick(req.id)}
                style={tableStyles.row}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
              >
                <td style={tableStyles.cell}>{req.file_name || 'N/A'}</td>
                <td style={tableStyles.cell}>{formatDate(req.created_at)}</td>
                <td style={tableStyles.cell}>{req.page_count ?? 'N/A'}</td>
                <td style={tableStyles.cell}>
                  <StatusBadge status={req.parsing_status} />
                </td>
                <td style={tableStyles.cell}>
                  {req.parsed_data?.meta_data?.["Ending Balance Offset"]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div style={tableStyles.pagination}>
          <div style={tableStyles.pageInfo}>
            Showing {startIndex + 1}-{endIndex} of {requests.length} entries
          </div>
          <div>
            <button 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
              style={{
                ...tableStyles.pageButton,
                ...(currentPage === 1 ? tableStyles.disabledButton : {})
              }}
            >
              Previous
            </button>
            <button 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
              style={{
                ...tableStyles.pageButton,
                ...(currentPage === totalPages ? tableStyles.disabledButton : {})
              }}
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