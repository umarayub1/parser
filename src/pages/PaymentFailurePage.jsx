import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';

const PaymentFailurePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(null);

  // Get URL parameters
  const checkoutId = searchParams.get('checkout_id');
  const errorCode = searchParams.get('error_code');
  const errorMessage = searchParams.get('error_message');
  const planName = searchParams.get('plan');
  const amount = searchParams.get('amount');

  useEffect(() => {
    // Set payment data from URL params
    setPaymentData({
      checkoutId,
      errorCode,
      errorMessage,
      planName,
      amount: amount ? parseFloat(amount) : null
    });

    // Set error message based on error code or use provided message
    if (errorCode) {
      setError(getErrorMessageFromCode(errorCode));
    } else if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
    } else {
      setError('Your payment could not be processed. Please try again.');
    }
  }, [checkoutId, errorCode, errorMessage, planName, amount]);

  const getErrorMessageFromCode = (code) => {
    const errorMessages = {
      'card_declined': 'Your card was declined. Please check your card details or try a different payment method.',
      'insufficient_funds': 'Your card has insufficient funds. Please try a different payment method.',
      'expired_card': 'Your card has expired. Please update your card details.',
      'incorrect_cvc': 'The security code (CVC) is incorrect. Please check and try again.',
      'processing_error': 'There was an error processing your payment. Please try again.',
      'authentication_required': 'Additional authentication is required. Please try again.',
      'currency_not_supported': 'The currency is not supported. Please contact support.',
      'payment_method_not_available': 'This payment method is not available. Please try a different method.',
      'generic_decline': 'Your payment was declined. Please contact your bank or try a different payment method.',
      'do_not_honor': 'Your payment was declined by your bank. Please contact your bank.',
      'invalid_request': 'There was an error with your payment request. Please try again.',
      'rate_limit': 'Too many payment attempts. Please wait a moment and try again.'
    };

    return errorMessages[code] || 'An unexpected error occurred. Please try again or contact support.';
  };

  const handleRetryPayment = () => {
    // Navigate back to pricing page to retry payment
    navigate('/pricing');
  };

  const handleContactSupport = () => {
    // Navigate to support page or open email client
    navigate('/support');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoToRequests = () => {
    navigate('/requests');
  };

  const commonIssues = [
    {
      icon: '💳',
      title: 'Card Declined',
      description: 'Check that your card details are correct and you have sufficient funds.',
      action: 'Try a different card or contact your bank'
    },
    {
      icon: '🔒',
      title: 'Security Check',
      description: 'Your bank may require additional verification for online purchases.',
      action: 'Complete verification with your bank'
    },
    {
      icon: '🌐',
      title: 'Network Issues',
      description: 'Connection problems can cause payment failures.',
      action: 'Check your internet connection and try again'
    },
    {
      icon: '📞',
      title: 'Need Help?',
      description: 'Our support team is here to help you complete your purchase.',
      action: 'Contact support for assistance'
    }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.failureContainer}>
        {/* Failure Icon */}
        <div style={styles.failureIcon}>
          <div style={styles.xMark}>
            <div style={styles.xMarkLine1}></div>
            <div style={styles.xMarkLine2}></div>
          </div>
        </div>

        {/* Failure Message */}
        <h1 style={styles.title}>Payment Failed</h1>
        <p style={styles.subtitle}>
          We couldn't process your payment. Don't worry, you haven't been charged.
        </p>

        {/* Error Details */}
        {error && (
          <div style={styles.errorDetails}>
            <h3 style={styles.errorTitle}>What happened?</h3>
            <p style={styles.errorMessage}>{error}</p>
          </div>
        )}

        {/* Payment Details */}
        {paymentData && (
          <div style={styles.paymentDetails}>
            <h3 style={styles.detailsTitle}>Payment Details</h3>
            <div style={styles.detailsGrid}>
              {paymentData.planName && (
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Plan:</span>
                  <span style={styles.detailValue}>{paymentData.planName}</span>
                </div>
              )}
              {paymentData.amount && (
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Amount:</span>
                  <span style={styles.detailValue}>${paymentData.amount.toFixed(2)}</span>
                </div>
              )}
              {paymentData.checkoutId && (
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Reference:</span>
                  <span style={styles.detailValue}>{paymentData.checkoutId}</span>
                </div>
              )}
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Status:</span>
                <span style={styles.failureStatus}>Failed</span>
              </div>
            </div>
          </div>
        )}

        {/* Common Issues */}
        <div style={styles.commonIssues}>
          <h3 style={styles.issuesTitle}>Common Issues & Solutions</h3>
          <div style={styles.issuesGrid}>
            {commonIssues.map((issue, index) => (
              <div key={index} style={styles.issueCard}>
                <div style={styles.issueIcon}>{issue.icon}</div>
                <div style={styles.issueContent}>
                  <h4 style={styles.issueTitle}>{issue.title}</h4>
                  <p style={styles.issueDescription}>{issue.description}</p>
                  <p style={styles.issueAction}>{issue.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionButtons}>
          <button onClick={handleRetryPayment} style={styles.primaryButton}>
            Try Again
          </button>
          <button onClick={handleContactSupport} style={styles.secondaryButton}>
            Contact Support
          </button>
          {user ? (
                      <button onClick={handleGoToRequests} style={styles.tertiaryButton}>
            Go to Requests
          </button>
          ) : (
            <button onClick={handleGoHome} style={styles.tertiaryButton}>
              Go Home
            </button>
          )}
        </div>

        {/* Alternative Payment Methods */}
        <div style={styles.alternativeMethods}>
          <h3 style={styles.alternativeTitle}>Alternative Payment Options</h3>
          <div style={styles.methodsList}>
            <div style={styles.method}>
              <span style={styles.methodIcon}>💳</span>
              <span style={styles.methodText}>Try a different credit/debit card</span>
            </div>
            <div style={styles.method}>
              <span style={styles.methodIcon}>🏦</span>
              <span style={styles.methodText}>Use a different bank account</span>
            </div>
            <div style={styles.method}>
              <span style={styles.methodIcon}>📱</span>
              <span style={styles.methodText}>Contact support for payment assistance</span>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div style={styles.supportSection}>
          <div style={styles.supportCard}>
            <h4 style={styles.supportTitle}>Need Immediate Help?</h4>
            <p style={styles.supportDescription}>
              Our support team is available to help you complete your purchase.
            </p>
            <div style={styles.supportMethods}>
              <Link to="/support" style={styles.supportLink}>
                📧 Email Support
              </Link>
              <a href="mailto:support@yourcompany.com" style={styles.supportLink}>
                💬 Live Chat
              </a>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div style={styles.footerNote}>
          <p style={styles.noteText}>
            Your card was not charged. You can safely try again or contact your bank if the issue persists.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  failureContainer: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    maxWidth: '700px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
    position: 'relative'
  },
  failureIcon: {
    width: '80px',
    height: '80px',
    background: '#e74c3c',
    borderRadius: '50%',
    margin: '0 auto 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  xMark: {
    width: '40px',
    height: '40px',
    position: 'relative'
  },
  xMarkLine1: {
    position: 'absolute',
    width: '30px',
    height: '3px',
    background: 'white',
    left: '5px',
    top: '18px',
    transform: 'rotate(45deg)',
    borderRadius: '2px'
  },
  xMarkLine2: {
    position: 'absolute',
    width: '30px',
    height: '3px',
    background: 'white',
    left: '5px',
    top: '18px',
    transform: 'rotate(-45deg)',
    borderRadius: '2px'
  },
  title: {
    color: '#2c3e50',
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '10px',
    margin: '0 0 10px 0'
  },
  subtitle: {
    color: '#7f8c8d',
    fontSize: '18px',
    marginBottom: '30px',
    lineHeight: 1.6
  },
  errorDetails: {
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '30px',
    textAlign: 'left'
  },
  errorTitle: {
    color: '#e53e3e',
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '10px',
    margin: '0 0 10px 0'
  },
  errorMessage: {
    color: '#742a2a',
    fontSize: '14px',
    lineHeight: 1.5,
    margin: 0
  },
  paymentDetails: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '30px',
    textAlign: 'left'
  },
  detailsTitle: {
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  detailsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailLabel: {
    color: '#7f8c8d',
    fontSize: '14px',
    fontWeight: '500'
  },
  detailValue: {
    color: '#2c3e50',
    fontSize: '14px',
    fontWeight: '600'
  },
  failureStatus: {
    color: '#e74c3c',
    fontSize: '14px',
    fontWeight: '600'
  },
  commonIssues: {
    marginBottom: '30px'
  },
  issuesTitle: {
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
    margin: '0 0 20px 0'
  },
  issuesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '15px',
    textAlign: 'left'
  },
  issueCard: {
    display: 'flex',
    gap: '15px',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef'
  },
  issueIcon: {
    fontSize: '24px',
    flexShrink: 0
  },
  issueContent: {
    flex: 1
  },
  issueTitle: {
    color: '#2c3e50',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '5px',
    margin: '0 0 5px 0'
  },
  issueDescription: {
    color: '#6c757d',
    fontSize: '13px',
    lineHeight: 1.4,
    marginBottom: '5px',
    margin: '0 0 5px 0'
  },
  issueAction: {
    color: '#3498db',
    fontSize: '13px',
    fontWeight: '500',
    margin: 0
  },
  actionButtons: {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #3498db, #2980b9)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minWidth: '140px'
  },
  secondaryButton: {
    background: 'transparent',
    color: '#e74c3c',
    border: '2px solid #e74c3c',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minWidth: '140px'
  },
  tertiaryButton: {
    background: 'transparent',
    color: '#7f8c8d',
    border: '2px solid #bdc3c7',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minWidth: '140px'
  },
  alternativeMethods: {
    marginBottom: '30px'
  },
  alternativeTitle: {
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  methodsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    textAlign: 'left'
  },
  method: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#f8f9fa',
    borderRadius: '6px'
  },
  methodIcon: {
    fontSize: '20px'
  },
  methodText: {
    color: '#2c3e50',
    fontSize: '14px'
  },
  supportSection: {
    marginBottom: '20px'
  },
  supportCard: {
    background: '#f1f3f4',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e1e5e9'
  },
  supportTitle: {
    color: '#2c3e50',
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '10px',
    margin: '0 0 10px 0'
  },
  supportDescription: {
    color: '#6c757d',
    fontSize: '14px',
    lineHeight: 1.5,
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  supportMethods: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  supportLink: {
    color: '#3498db',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
    padding: '8px 16px',
    background: 'white',
    borderRadius: '6px',
    border: '1px solid #ddd',
    transition: 'all 0.3s ease'
  },
  footerNote: {
    borderTop: '1px solid #ecf0f1',
    paddingTop: '20px'
  },
  noteText: {
    color: '#7f8c8d',
    fontSize: '13px',
    margin: 0,
    fontStyle: 'italic'
  }
};

// Add hover effects
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  a:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;
document.head.appendChild(styleSheet);

export default PaymentFailurePage; 