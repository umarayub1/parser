import React from 'react';
import './StatementSummary.css'; // We will create this CSS file later
import SummaryPlaceholder from './SummaryPlaceholder';

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

const formatCurrency = (amount, symbol) => {
  if (amount === null || amount === undefined) return 'N/A';
  
  const numberFormat = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  const formattedNumber = numberFormat.format(amount);
  return symbol ? `${symbol}${formattedNumber}` : formattedNumber;
};

function StatementSummary({ metaData }) {
  // If no metaData, render the placeholder structure with skeleton loading
  if (!metaData) {
    return <SummaryPlaceholder />;
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
    'Phone number': phoneNumber,
    'Currency': currency,
    'Symbol': symbol,
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
      </div>
      
      <div className="summary-body">
        <div className="summary-columns">
          <div className="summary-column">
            <div className="summary-row">
              <div className="summary-label">Customer</div>
              <div className="summary-value">{customerName || 'N/A'}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Phone Number</div>
              <div className="summary-value">{phoneNumber || 'N/A'}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Bank</div>
              <div className="summary-value">{bankName || 'Unknown Bank'}</div>
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
              <div className="summary-value">{formatCurrency(startBalance, symbol)}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Ending Balance</div>
              <div className="summary-value fw-bold">{formatCurrency(endBalance, symbol)}</div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Currency</div>
              <div className="summary-value">{currency || 'USD'} {symbol ? `(${symbol})` : ''}</div>
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
                {formatCurrency(creditAmount, symbol)}
              </div>
              <div className="transaction-details">
                <div className="transaction-label">Credits</div>
                <div className="transaction-count">{creditCount} transaction{creditCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
            
            <div className="transaction-type debits">
              <div className="transaction-amount">
                {formatCurrency(Math.abs(debitAmount), symbol)}
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