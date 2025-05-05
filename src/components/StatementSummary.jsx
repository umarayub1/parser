import React from 'react';
import './StatementSummary.css'; // We will create this CSS file later

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    // Assuming YYYY-MM-DD format
    const date = new Date(dateString + 'T00:00:00'); // Add time part for correct local interpretation
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return dateString; // Return original if formatting fails
  }
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

function StatementSummary({ metaData }) {
  // If no metaData, render the placeholder structure with skeleton loading
  if (!metaData) {
    return (
      <div className="summary-card">
        <div className="summary-header">
          <h3>Account Summary</h3>
          <div className="skeleton-badge"></div>
        </div>
        <div className="summary-body">
          <div className="summary-row skeleton">
            <div className="summary-label"></div>
            <div className="summary-value"></div>
          </div>
          <div className="summary-row skeleton">
            <div className="summary-label"></div>
            <div className="summary-value"></div>
          </div>
          <div className="summary-row skeleton">
            <div className="summary-label"></div>
            <div className="summary-value"></div>
          </div>
          <div className="summary-row skeleton">
            <div className="summary-label"></div>
            <div className="summary-value"></div>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row skeleton">
            <div className="summary-label"></div>
            <div className="summary-value"></div>
          </div>
          <div className="summary-row skeleton">
            <div className="summary-label"></div>
            <div className="summary-value"></div>
          </div>
        </div>
      </div>
    );
  }

  const {
    'Starting Statement Date': startDate,
    'Ending Statement Date': endDate,
    'Beginning Balance': startBalance,
    'Ending Balance': endBalance,
    'Transaction Credit Count': creditCount = 0,
    'Transaction Credits': creditAmount = 0,
    'Transaction Debit Count': debitCount = 0,
    'Transaction Debits': debitAmount = 0,
    'Bank name': bankName,
    'Account number': accountNumber,
    'Customer name': customerName,
    'Ending Balance Offset': balanceOffset,
  } = metaData;

  // Calculate statement period in days
  const daysBetween = () => {
    if (!startDate || !endDate) return 'N/A';
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} days`;
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="summary-card">
      <div className="summary-header">
        <h3>Account Summary</h3>
        <div className="bank-badge">{bankName || 'Unknown Bank'}</div>
      </div>
      
      <div className="summary-body">
        <div className="summary-columns">
          <div className="summary-column">
            <div className="summary-row">
              <div className="summary-label">Customer</div>
              <div className="summary-value">{customerName || 'N/A'}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Account Number</div>
              <div className="summary-value account-number">{accountNumber || 'N/A'}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Statement Period</div>
              <div className="summary-value">
                {formatDate(startDate)} to {formatDate(endDate)} ({daysBetween()})
              </div>
            </div>
          </div>
          
          <div className="summary-column">
            <div className="summary-row">
              <div className="summary-label">Starting Balance</div>
              <div className="summary-value">{formatCurrency(startBalance)}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Ending Balance</div>
              <div className="summary-value fw-bold">{formatCurrency(endBalance)}</div>
            </div>
            <div className="summary-row balance-offset">
              <div className="summary-label">Balance Offset</div>
              <div className="summary-value text-muted">{balanceOffset}</div>
            </div>
          </div>
        </div>
        
        <div className="summary-divider"></div>
        
        <div className="transaction-overview">
          <div className="overview-header">
            <div className="total-transactions">
              <span className="transaction-count">{creditCount + debitCount}</span>
              <span className="transaction-label">Transactions</span>
            </div>
          </div>
          
          <div className="transaction-summary">
            <div className="transaction-type credits">
              <div className="transaction-amount">
                {formatCurrency(creditAmount)}
              </div>
              <div className="transaction-details">
                <div className="transaction-label">Credits</div>
                <div className="transaction-count">{creditCount} transaction{creditCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
            
            <div className="transaction-type debits">
              <div className="transaction-amount">
                {formatCurrency(Math.abs(debitAmount))}
              </div>
              <div className="transaction-details">
                <div className="transaction-label">Debits</div>
                <div className="transaction-count">{debitCount} transaction{debitCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatementSummary; 