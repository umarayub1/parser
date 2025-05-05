import React from 'react';
import './StatementSummary.css'; // Using the same styling

function SummaryPlaceholder() {
  return (
    <div className="summary-card">
      <div className="summary-header">
        <h3>Account Summary</h3>
        <div className="skeleton-badge"></div>
      </div>
      <div className="summary-body">
        <div className="summary-columns">
          <div className="summary-column">
            <div className="summary-row">
              <div className="summary-label">Customer</div>
              <div className="summary-value"></div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Bank</div>
              <div className="summary-value"></div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Account Number</div>
              <div className="summary-value account-number"></div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Statement Period</div>
              <div className="summary-value"></div>
            </div>
          </div>
          
          <div className="summary-column">
            <div className="summary-row">
              <div className="summary-label">Starting Balance</div>
              <div className="summary-value"></div>
            </div>
            <div className="summary-row">
              <div className="summary-label">Ending Balance</div>
              <div className="summary-value fw-bold"></div>
            </div>
            <div className="summary-row balance-offset">
              <div className="summary-label">Balance Offset</div>
              <div className="summary-value text-muted"></div>
            </div>
          </div>
        </div>
        
        <div className="summary-divider"></div>
        
        <div className="transaction-overview">
          <div className="overview-header">
            <div className="total-transactions">
              <span className="transaction-count">0</span>
              <span className="transaction-label">Transactions</span>
            </div>
          </div>
          
          <div className="transaction-summary">
            <div className="transaction-type credits">
              <div className="transaction-amount">$0.00</div>
              <div className="transaction-details">
                <div className="transaction-label">Credits</div>
                <div className="transaction-count">0 transactions</div>
              </div>
            </div>
            
            <div className="transaction-type debits">
              <div className="transaction-amount">$0.00</div>
              <div className="transaction-details">
                <div className="transaction-label">Debits</div>
                <div className="transaction-count">0 transactions</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SummaryPlaceholder; 