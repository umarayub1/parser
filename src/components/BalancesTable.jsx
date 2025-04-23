import React from 'react';
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
  return amount;
};

function BalancesTable({ balances = [] }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th colSpan="2" className="table-header">Daily Balances</th>
          </tr>
          <tr>
            <th>Date</th>
            <th className="amount-column">Balance</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((balance, index) => (
            <tr key={index}>
              <td>{formatDate(balance.date)}</td>
              <td className="amount-column">{formatCurrency(balance.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BalancesTable; 