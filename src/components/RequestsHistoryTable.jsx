import React from 'react';
import { useNavigate } from 'react-router-dom';
// import './RequestsHistoryTable.css'; // Consider creating a CSS file

// Helper function to format date (optional)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return 'Invalid Date';
  }
};

// Helper function to format status (optional)
const formatStatus = (status) => {
    if (!status) return 'N/A';
    // Capitalize first letter and replace underscores with spaces
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
};

function RequestsHistoryTable({ requests, isLoading }) {
  const navigate = useNavigate();

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

  return (
    <div className="history-table-container">
      <h2>History</h2>
      {/* Add styling for the table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {/* Add styling for headers */}
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>File Name</th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Created At</th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Pages</th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Parsing Status</th>
            {/* <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Offset</th> Potentially add offset later */}
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr
              key={req.id}
              onClick={() => handleRowClick(req.id)}
              style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              {/* Add styling for cells */}
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{req.file_name || 'N/A'}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatDate(req.created_at)}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{req.page_count ?? 'N/A'}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatStatus(req.parsing_status)}</td>
              {/* <td style={{ border: '1px solid #ddd', padding: '8px' }}>{req.parsed_data?.meta_data?.['Ending Balance Offset'] ?? 'N/A'}</td> */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RequestsHistoryTable; 