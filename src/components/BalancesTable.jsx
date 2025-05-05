import React, { useState, useMemo } from 'react';
import './BalancesTable.css';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Error formatting date:", isoString, e);
    return isoString;
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

function BalancesTable({ balances = [] }) {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'original' });
  // Store original balances for reference
  const originalBalances = useMemo(() => balances, [balances]);
  
  // Handle column sort
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = 'original';
      } else {
        direction = 'asc';
      }
    }
    setSortConfig({ key, direction });
  };
  
  // Sort balances
  const sortedBalances = useMemo(() => {
    // If sort direction is 'original', return in original order
    if (sortConfig.direction === 'original') {
      return [...originalBalances];
    }
    
    // Otherwise sort balances
    return [...balances].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [balances, originalBalances, sortConfig]);
  
  // Get sort class for column headers
  const getSortClass = (key) => {
    if (sortConfig.key !== key) return '';
    if (sortConfig.direction === 'asc') return 'sort-asc';
    if (sortConfig.direction === 'desc') return 'sort-desc';
    return 'sort-original';
  };
  
  // Calculate min, max, and average balances
  const balanceStats = useMemo(() => {
    if (!balances.length) return { min: 0, max: 0, avg: 0 };
    
    const amounts = balances.map(b => Number(b.amount || 0));
    return {
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      avg: amounts.reduce((sum, val) => sum + val, 0) / amounts.length
    };
  }, [balances]);

  return (
    <div className="balances-section">
      <div className="balances-header">
        <h3>Daily Balances</h3>
        <div className="balances-count">
          <span>{balances.length} days</span>
        </div>
      </div>
      
      <div className="balances-summary">
        <div className="summary-item">
          <span className="summary-label">Lowest Balance</span>
          <span className="summary-value min-amount">
            {formatCurrency(balanceStats.min)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Highest Balance</span>
          <span className="summary-value max-amount">
            {formatCurrency(balanceStats.max)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Average Balance</span>
          <span className="summary-value avg-amount">
            {formatCurrency(balanceStats.avg)}
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
                  onClick={() => requestSort('amount')}
                  className={`amount-column ${getSortClass('amount')}`}
                >
                  Balance
                </th>
            </tr>
          </thead>
          <tbody>
              {sortedBalances.length > 0 ? (
                sortedBalances.map((balance, index) => (
              <tr key={index}>
                <td>{formatDate(balance.date)}</td>
                <td className="amount-column">{formatCurrency(balance.amount)}</td>
              </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="empty-table">
                    No balance information available
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BalancesTable; 