import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Import supabase client
import ApiClient from './ApiClient';
import * as XLSX from 'xlsx';
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
  const rowsPerPage = 100;

  const [error, setError] = useState('');
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);

  if (isLoading) {
    return (
      <div className="history-loading-container">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-text">Loading your request history...</p>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="history-empty-container">
        <div className="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <h3>No requests yet</h3>
        <p>You haven't submitted any bank statement parsing requests yet. Click the "New Request" button above to upload your first PDF statement and get started.</p>
      </div>
    );
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
  // Handle checkbox selection
  const handleSelectRequest = (requestId, isChecked) => {
    const newSelected = new Set(selectedRequests);
    if (isChecked) {
      newSelected.add(requestId);
    } else {
      newSelected.delete(requestId);
    }
    setSelectedRequests(newSelected);
  };

  // Handle select all checkbox
  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      // Select all requests (not just successful ones for deletion)
      setSelectedRequests(new Set(requests.map(req => req.id)));
    } else {
      setSelectedRequests(new Set());
    }
  };

  // Export selected requests to Excel files
  const handleBulkExport = async () => {
    const selectedRequestsArray = Array.from(selectedRequests);
    
    // Filter only successful requests for export
    const successfulSelectedRequests = selectedRequestsArray.filter(requestId => {
      const request = requests.find(req => req.id === requestId);
      return request && request.parsing_status?.toLowerCase() === 'success';
    });

    if (successfulSelectedRequests.length === 0) {
      setError('Please select at least one successfully parsed request to export.');
      return;
    }

    setIsExporting(true);
    setError('');

    try {
      const exportPromises = successfulSelectedRequests.map(async (requestId) => {
        try {
          const response = await ApiClient.getRequestById(requestId);
          if (response.success && response.data) {
            const request = response.data;
            const parsedData = request.parsed_data;
            
            if (!parsedData) {
              console.warn(`No parsed data found for request ${requestId}`);
              return null;
            }

            // Create Excel workbook for this request
            const wb = XLSX.utils.book_new();
            
            // Extract data
            const metaData = parsedData.meta_data || {};
            const transactions = parsedData.transactions_data || [];
            const balances = parsedData.balances || [];
            
            // Create metadata sheet
            const metaDataArray = [['Key', 'Value']];
            Object.entries(metaData).forEach(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                Object.entries(value).forEach(([subKey, subValue]) => {
                  metaDataArray.push([`${key} - ${subKey}`, subValue]);
                });
              } else {
                metaDataArray.push([key, value]);
              }
            });
            const metaDataSheet = XLSX.utils.aoa_to_sheet(metaDataArray);
            XLSX.utils.book_append_sheet(wb, metaDataSheet, 'Meta Data');
            
            // Create balances sheet
            const balancesArray = [['Date', 'Amount']];
            balances.forEach(balance => {
              const date = balance.date ? new Date(balance.date) : "";
              balancesArray.push([date, balance.amount]);
            });
            const balancesSheet = XLSX.utils.aoa_to_sheet(balancesArray);
            XLSX.utils.book_append_sheet(wb, balancesSheet, 'Balances');
            
            // Create transactions sheet
            const transactionsArray = [['Date', 'Amount', 'Deposit', 'Description']];
            transactions.forEach(transaction => {
              const date = transaction.date ? new Date(transaction.date) : "";
              const deposit = transaction.deposit ? "Yes" : "No";
              transactionsArray.push([date, transaction.amount, deposit, transaction.description]);
            });
            const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionsArray);
            XLSX.utils.book_append_sheet(wb, transactionsSheet, 'Transactions');
            
            // Generate filename from request file name
            const baseFilename = request.file_name ? 
              request.file_name.replace(/\.pdf$/i, '') : 
              `request_${requestId}`;
            
            // Generate Excel file and trigger download
            XLSX.writeFile(wb, `${baseFilename}_parsed_data.xlsx`);
            
            return { success: true, filename: baseFilename };
          } else {
            console.warn(`Failed to fetch data for request ${requestId}`);
            return { success: false, requestId, error: 'Failed to fetch data' };
          }
        } catch (error) {
          console.error(`Error exporting request ${requestId}:`, error);
          return { success: false, requestId, error: error.message };
        }
      });

      // Execute all exports with a small delay between each to prevent browser blocking
      const results = [];
      for (let i = 0; i < exportPromises.length; i++) {
        const result = await exportPromises[i];
        results.push(result);
        
        // Add a small delay between downloads to prevent browser blocking
        if (i < exportPromises.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Check results and show summary
      const successful = results.filter(r => r && r.success).length;
      const failed = results.filter(r => r && !r.success).length;
      
      if (successful > 0) {
        console.log(`Successfully exported ${successful} files`);
      }
      
      if (failed > 0) {
        setError(`${failed} exports failed. Check console for details.`);
      }

      // Clear selection after export
      setSelectedRequests(new Set());

    } catch (error) {
      console.error('Bulk export error:', error);
      setError(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Bulk delete selected requests
  const handleBulkDelete = async () => {
    if (selectedRequests.size === 0) {
      setError('Please select at least one request to delete.');
      return;
    }

    const selectedCount = selectedRequests.size;
    const confirmMessage = `Are you sure you want to delete ${selectedCount} request${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsExporting(true); // Reuse the same loading state
    setError('');

    try {
      const selectedRequestsArray = Array.from(selectedRequests);
      const deletePromises = selectedRequestsArray.map(async (requestId) => {
        try {
          const { error: deleteError } = await supabase
            .from('requests')
            .update({ is_deleted: true })
            .eq('id', requestId);
            
          if (deleteError) throw deleteError;
          
          return { success: true, requestId };
        } catch (error) {
          console.error(`Error deleting request ${requestId}:`, error);
          return { success: false, requestId, error: error.message };
        }
      });

      // Execute all deletions
      const results = await Promise.all(deletePromises);

      // Check results and show summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (successful > 0) {
        console.log(`Successfully deleted ${successful} requests`);
        
        // Refresh the list to show updated data
        if (typeof onRequestUpdate === 'function') {
          onRequestUpdate();
        }
      }
      
      if (failed > 0) {
        setError(`${failed} deletions failed. Check console for details.`);
      }

      // Clear selection after deletion
      setSelectedRequests(new Set());

    } catch (error) {
      console.error('Bulk delete error:', error);
      setError(`Delete failed: ${error.message}`);
    } finally {
      setIsExporting(false);
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



  // Get all requests for selection (both successful and others)
  const allSelected = requests.length > 0 && 
    requests.every(req => selectedRequests.has(req.id));

  // Count successful requests in selection for export
  const selectedSuccessfulCount = Array.from(selectedRequests).filter(requestId => {
    const request = requests.find(req => req.id === requestId);
    return request && request.parsing_status?.toLowerCase() === 'success';
  }).length;

  return (
    <div className="history-table-container">
      {error && <div className="history-error">{error}</div>}
      
      {/* Bulk Action Controls */}
      {requests.length > 0 && (
        <div className="bulk-action-controls">
          <div className="bulk-select-info">
            {selectedRequests.size > 0 && (
              <span className="selected-count">
                {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''} selected
                {selectedSuccessfulCount > 0 && selectedSuccessfulCount !== selectedRequests.size && (
                  <span className="successful-count"> ({selectedSuccessfulCount} exportable)</span>
                )}
              </span>
            )}
          </div>
          <div className="bulk-action-buttons">
            <button
              className={`bulk-export-button ${selectedSuccessfulCount === 0 ? 'disabled' : ''}`}
              onClick={handleBulkExport}
              disabled={selectedSuccessfulCount === 0 || isExporting}
              title={selectedSuccessfulCount === 0 ? 'Select successfully parsed requests to export' : `Export ${selectedSuccessfulCount} request${selectedSuccessfulCount !== 1 ? 's' : ''} to Excel`}
            >
              {isExporting ? (
                <>
                  <div className="action-spinner"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export to Excel
                </>
              )}
            </button>
            <button
              className={`bulk-delete-button ${selectedRequests.size === 0 ? 'disabled' : ''}`}
              onClick={handleBulkDelete}
              disabled={selectedRequests.size === 0 || isExporting}
              title={selectedRequests.size === 0 ? 'Select requests to delete' : `Delete ${selectedRequests.size} request${selectedRequests.size !== 1 ? 's' : ''}`}
            >
              {isExporting ? (
                <>
                  <div className="action-spinner"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Delete Selected
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="history-table-wrapper">
        <table className="history-table">
          <thead className="history-table-head">
            <tr>
              {requests.length > 0 && (
                <th className="history-table-header select-column">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    title="Select all requests"
                  />
                </th>
              )}
              <th className="history-table-header">File Name</th>
              <th className="history-table-header">Created At</th>
              <th className="history-table-header pages-column">Pages</th>
              <th className="history-table-header status-column">Parsing Status</th>
              <th className="history-table-header offset-column">Balance Offset</th>
            </tr>
          </thead>
          <tbody>
            {currentRequests.map((req) => {
              const isSelected = selectedRequests.has(req.id);
              
              return (
                <tr
                  key={req.id}
                  onClick={(e) => handleRowClick(req.id, e)}
                  className="history-table-row"
                >
                  {requests.length > 0 && (
                    <td className="history-table-cell select-column" data-label="Select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRequest(req.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  <td className="history-table-cell" data-label="File Name">{req.file_name || 'N/A'}</td>
                  <td className="history-table-cell" data-label="Created At">{formatDate(req.created_at)}</td>
                  <td className="history-table-cell pages-column" data-label="Pages">{req.page_count ?? 'N/A'}</td>
                  <td className="history-table-cell status-column" data-label="Parsing Status">
                    <StatusBadge status={req.parsing_status} />
                  </td>
                  <td className="history-table-cell offset-column" data-label="Balance Offset">
                    {req.parsed_data?.meta_data?.["Ending Balance Offset"]}
                  </td>
                </tr>
              );
            })}
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