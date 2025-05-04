import React, { useState, useMemo } from 'react';
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
  
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(Math.abs(amount));
  
  const className = isDeposit ? 'deposit-amount' : 'withdrawal-amount';
  const sign = isDeposit ? '+' : '';
  
  return <span className={className}>{sign}{formattedAmount}</span>;
};

function TransactionsTable({ transactions = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle column sort
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    // Filter by search term
    let filtered = transactions;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = transactions.filter(tx => 
        (tx.description && tx.description.toLowerCase().includes(lowerSearchTerm)) || 
        (tx.date && tx.date.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    // Sort transactions
    return [...filtered].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [transactions, searchTerm, sortConfig]);
  
  // Get sort class for column headers
  const getSortClass = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? 'sort-asc' : 'sort-desc';
  };
  
  // Calculate total deposits and withdrawals
  const totals = useMemo(() => {
    return filteredAndSortedTransactions.reduce((acc, tx) => {
      if (tx.deposit) {
        acc.deposits += Number(tx.amount || 0);
      } else {
        acc.withdrawals += Number(tx.amount || 0);
      }
      return acc;
    }, { deposits: 0, withdrawals: 0 });
  }, [filteredAndSortedTransactions]);

  return (
    <div className="transaction-section">
      <div className="transaction-header">
        <h3>Transactions</h3>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="transaction-summary">
        <div className="summary-item">
          <span className="summary-label">Transactions</span>
          <span className="summary-value">{filteredAndSortedTransactions.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Deposits</span>
          <span className="summary-value deposit-amount">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(totals.deposits)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Withdrawals</span>
          <span className="summary-value withdrawal-amount">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(totals.withdrawals)}
          </span>
        </div>
      </div>
      
    <div className="table-container">
      <table>
        <thead>
          <tr>
              <th 
                onClick={() => requestSort('date')}
                className={getSortClass('date')}
              >
                Date
              </th>
              <th 
                onClick={() => requestSort('description')}
                className={getSortClass('description')}
              >
                Description
              </th>
              <th 
                onClick={() => requestSort('amount')}
                className={`amount-column ${getSortClass('amount')}`}
              >
                Amount
              </th>
          </tr>
        </thead>
        <tbody>
            {filteredAndSortedTransactions.length > 0 ? (
              filteredAndSortedTransactions.map((tx, index) => (
                <tr key={index}>
                  <td>{formatDate(tx.date)}</td>
                  <td className="description-cell">{tx.description}</td>
                  <td className="amount-column">{formatCurrency(tx.amount, tx.deposit)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="empty-table">
                  {searchTerm ? 'No transactions match your search' : 'No transactions available'}
                </td>
              </tr>
            )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default TransactionsTable; 