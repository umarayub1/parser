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
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }); // Assuming USD, adjust if needed
};

function StatementSummary({ metaData }) {
  if (!metaData) {
    return <div className="summary-container">Loading summary...</div>;
  }

  const {
    'Starting Statement Date': startDate,
    'Ending Statement Date': endDate,
    'Beginning Balance': startBalance,
    'Ending Balance': endBalance,
    'Transaction Credit Count': creditCount = 0,
    'Transaction Credits': creditAmount = 0,
    'Transaction Debit Count': debitCount = 0,
    'Transaction Debits': debitAmount = 0, // Assuming negative for debits in JSON amount field, using absolute value here
    'Bank name': bankName,
    'Account number': accountNumber,
    'Customer name': customerName,
    'Ending Balance Offset': balanceOffset,
  } = metaData;

  return (
    <div className="summary-container">
      <h3>Account Summary</h3>
      <div className="summary-grid">
        <div><strong>Bank:</strong> {bankName || 'N/A'}</div>
        <div><strong>Customer:</strong> {customerName || 'N/A'}</div>
        <div><strong>Account Number:</strong> {accountNumber || 'N/A'}</div>
        <div><strong>Ending Balalnce Offset:</strong> {balanceOffset}</div>
        <div><strong>Starting Statement Date:</strong> {formatDate(startDate)}</div>
        <div><strong>Ending Statement Date:</strong> {formatDate(endDate)}</div>
        <div><strong>Starting Balance:</strong> {formatCurrency(startBalance)}</div>
        <div><strong>Ending Balance:</strong> {formatCurrency(endBalance)}</div>
        <div><strong>Total Transactions:</strong> {creditCount + debitCount}</div>
        <div>
             <strong>Credits:</strong> <span className="credit-amount">{creditCount} credits(s) +{creditAmount.toFixed(2)}</span>
        </div>
        <div>
             <strong>Debits:</strong> <span className="debit-amount">{debitCount} debits(s) -{Math.abs(debitAmount.toFixed(2))}</span>
        </div>
      </div>
    </div>
  );
}

export default StatementSummary; 