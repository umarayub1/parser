import React, { useState, useRef, useEffect } from 'react';

/**
 * Dropdown button component for downloading data in JSON or CSV format
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - The data to be downloaded
 * @param {string} props.filename - Base filename without extension
 * @param {string} props.buttonStyle - Optional custom styling for the button
 * @param {Function} props.onError - Optional callback for error handling
 */
const DownloadDataButton = ({ data, filename, buttonStyle, onError }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleError = (errorMessage) => {
    if (onError && typeof onError === 'function') {
      onError(errorMessage);
    } else {
      console.error(errorMessage);
    }
  };

  const downloadJson = () => {
    if (!data) {
      handleError("No data available to download.");
      return;
    }

    try {
      // Transform data to match the schema requirements
      const metaData = data.meta_data || {};
      
      // Ensure Currency and Symbol are explicitly included in meta_data
      const transformedMetaData = {
        ...metaData,
        Currency: metaData.Currency || "",
        Symbol: metaData.Symbol || ""
      };
      
      const transformedData = {
        meta_data: transformedMetaData,
        balances: data.balances || [],
        transactions_data: data.transactions_data || []
      };
      
      const jsonString = JSON.stringify(transformedData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename || 'parsed_data'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating JSON download:", error);
      handleError("Could not generate JSON download.");
    }
  };

  const downloadCsv = () => {
    if (!data) {
      handleError("No data available to download.");
      return;
    }

    try {
      // Extract data from JSON
      const metaData = data.meta_data || {};
      const transactions = data.transactions_data || [];
      const balances = data.balances || [];
      
      // Start building CSV content
      let csvContent = "";
      
      // 1. META DATA SECTION
      csvContent += "META DATA\n";
      csvContent += "Key,Value\n";
      
      // Add meta data entries
      Object.entries(metaData).forEach(([key, value]) => {
        // Handle nested objects like Account Summary
        if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            const formattedKey = `${key} - ${subKey}`;
            const formattedValue = typeof subValue === 'string' ? 
              `"${subValue.replace(/"/g, '""')}"` : subValue;
            csvContent += `${formattedKey},${formattedValue}\n`;
          });
        } else {
          // Regular key-value pairs
          const formattedValue = typeof value === 'string' ? 
            `"${value.replace(/"/g, '""')}"` : value;
          csvContent += `${key},${formattedValue}\n`;
        }
      });
      
      // 2. BALANCES SECTION
      csvContent += "\nBALANCES\n";
      csvContent += "Date,Amount\n";
      
      // Add balances
      balances.forEach(balance => {
        const date = balance.date ? new Date(balance.date).toISOString().split('T')[0] : "";
        const amount = balance.amount !== null ? balance.amount : "";
        csvContent += `${date},${amount}\n`;
      });
      
      // 3. TRANSACTIONS SECTION
      csvContent += "\nTRANSACTIONS\n";
      csvContent += "Date,Amount,Deposit,Description\n";
      
      // Add transactions
      transactions.forEach(transaction => {
        const date = transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : "";
        const amount = transaction.amount || 0;
        const deposit = transaction.deposit ? "Yes" : "No";
        // Escape quotes in description and wrap in quotes to handle commas
        const description = transaction.description ? 
          `"${transaction.description.replace(/"/g, '""')}"` : "";
        
        csvContent += `${date},${amount},${deposit},${description}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename || 'parsed_data'}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating CSV download:", error);
      handleError("Could not generate CSV download.");
    }
  };

  const downloadMultipleCsvs = () => {
    if (!data) {
      handleError("No data available to download.");
      return;
    }

    try {
      // Extract data from JSON
      const metaData = data.meta_data || {};
      const transactions = data.transactions_data || [];
      const balances = data.balances || [];
      
      // Create metadata CSV
      let metaDataCsv = "Key,Value\n";
      Object.entries(metaData).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            const formattedKey = `${key} - ${subKey}`;
            const formattedValue = typeof subValue === 'string' ? 
              `"${subValue.replace(/"/g, '""')}"` : subValue;
            metaDataCsv += `${formattedKey},${formattedValue}\n`;
          });
        } else {
          const formattedValue = typeof value === 'string' ? 
            `"${value.replace(/"/g, '""')}"` : value;
          metaDataCsv += `${key},${formattedValue}\n`;
        }
      });
      
      // Create balances CSV
      let balancesCsv = "Date,Amount\n";
      balances.forEach(balance => {
        const date = balance.date ? new Date(balance.date).toISOString().split('T')[0] : "";
        const amount = balance.amount !== null ? balance.amount : "";
        balancesCsv += `${date},${amount}\n`;
      });
      
      // Create transactions CSV
      let transactionsCsv = "Date,Amount,Deposit,Description\n";
      transactions.forEach(transaction => {
        const date = transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : "";
        const amount = transaction.amount || 0;
        const deposit = transaction.deposit ? "Yes" : "No";
        const description = transaction.description ? 
          `"${transaction.description.replace(/"/g, '""')}"` : "";
        transactionsCsv += `${date},${amount},${deposit},${description}\n`;
      });
      
      // Function to trigger a download
      const downloadCsvFile = (content, name) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };
      
      // Trigger downloads with a slight delay between them to prevent browser blocking
      downloadCsvFile(metaDataCsv, `${filename || 'parsed_data'}_metadata.csv`);
      
      // Add slight delays between downloads to prevent browser blocking
      setTimeout(() => {
        downloadCsvFile(balancesCsv, `${filename || 'parsed_data'}_balances.csv`);
        
        setTimeout(() => {
          downloadCsvFile(transactionsCsv, `${filename || 'parsed_data'}_transactions.csv`);
        }, 300);
      }, 300);
      
    } catch (error) {
      console.error("Error creating CSV downloads:", error);
      handleError("Could not generate CSV downloads.");
    }
  };

  return (
    <div className="dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        className="cta-button download-button" 
        onClick={() => setShowDropdown(!showDropdown)}
        style={buttonStyle}
      > 
        Download ▼
      </button>
      {showDropdown && (
        <div className="dropdown-menu" style={{
          position: 'absolute', 
          top: '100%', 
          right: 0, 
          background: '#fff', 
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)', 
          borderRadius: '4px', 
          zIndex: 100,
          minWidth: '150px'
        }}>
          <button 
            onClick={() => {
              downloadJson();
              setShowDropdown(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              background: 'none',
              cursor: 'pointer'
            }}
          >
            JSON
          </button>
          <button 
            onClick={() => {
              downloadCsv();
              setShowDropdown(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              background: 'none',
              cursor: 'pointer'
            }}
          >
            CSV (Combined)
          </button>
          <button 
            onClick={() => {
              downloadMultipleCsvs();
              setShowDropdown(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              background: 'none',
              cursor: 'pointer'
            }}
          >
            CSV (Separate Files)
          </button>
        </div>
      )}
    </div>
  );
};

export default DownloadDataButton; 