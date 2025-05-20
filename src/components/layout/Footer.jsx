import React from 'react';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>&copy; {new Date().getFullYear()} Bank Statement Parser</p>
      </div>
    </footer>
  );
};

export default Footer; 