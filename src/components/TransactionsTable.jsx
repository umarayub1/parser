import React from 'react';
import './TransactionsTable.css'; // We will create this CSS file later

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    // Assuming ISO 8601 format
    const date = new Date(isoString);
    // Use a consistent format like YYYY-MM-DD for clarity
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
    // Or use locale format: return date.toLocaleDateString();
  } catch (e) {
    console.error("Error formatting date:", isoString, e);
    return isoString; // Return original if formatting fails
  }
};

const formatCurrency = (amount, isDeposit) => {
  if (amount === null || amount === undefined) return 'N/A';
  
  const className = isDeposit ? 'deposit-amount' : 'withdrawal-amount';
  const sign = isDeposit ? '+' : '-';
  
  return <span className={className}>{sign}{Math.abs(amount)}</span>;
};

function TransactionsTable({ transactions = [] }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th colSpan="3" className="table-header">Transactions</th>
          </tr>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th className="amount-column">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, index) => (
            <tr key={index}><td>{formatDate(tx.date)}</td><td>{tx.description}</td><td className="amount-column">{formatCurrency(tx.amount, tx.deposit)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionsTable; 