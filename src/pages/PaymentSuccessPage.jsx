import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { fetchCredits } from '../store/authSlice';
import ApiClient from '../components/ApiClient';

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [error, setError] = useState(null);

  // Get URL parameters
  const sessionId = searchParams.get('session_id');
  const checkoutId = searchParams.get('checkout_id');
  const planName = searchParams.get('plan');
  const amount = searchParams.get('amount');

  useEffect(() => {
    const loadPaymentData = async () => {
      try {
        setLoading(true);
        
        // Set payment data from URL params first
        setPaymentData({
          sessionId,
          checkoutId,
          planName,
          amount: amount ? parseFloat(amount) : null
        });

        // Refresh user session and credits if user is available
        if (user) {
          // Add a small delay to allow webhooks to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Refresh user session to get updated plan info
          const sessionData = await ApiClient.getSession();
          if (sessionData.success) {
            setUserPlan(sessionData.user_plan);
          }
          
          // Force refresh credits with retry logic for post-subscription scenarios
          let creditsAttempts = 0;
          let credits = 0;
          
          while (creditsAttempts < 3) {
            try {
              // Force refresh credits from API (bypass cache)
              credits = await ApiClient.getCredits(true);
              
              // Also update Redux store
              dispatch(fetchCredits());
              
              setUserCredits(credits);
              
              // If we got a reasonable credit amount, break out of retry loop
              if (credits > 0) {
                break;
              }
              
              creditsAttempts++;
              
              // Wait a bit before retrying if credits are still 0
              if (creditsAttempts < 3) {
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
            } catch (err) {
              console.error(`Credits fetch attempt ${creditsAttempts + 1} failed:`, err);
              creditsAttempts++;
              
              if (creditsAttempts < 3) {
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
            }
          }
        }

      } catch (err) {
        console.error('Error loading payment success data:', err);
        setError('Failed to load payment information');
      } finally {
        setLoading(false);
      }
    };

    loadPaymentData();
  }, [user, dispatch, sessionId, checkoutId, planName, amount]);

  const handleContinue = async () => {
    // Force refresh credits one more time before navigating
    try {
      const credits = await ApiClient.getCredits(true);
      dispatch(fetchCredits());
      setUserCredits(credits);
    } catch (err) {
      console.error('Error refreshing credits before navigation:', err);
    }
    navigate('/subscriptions');
  };

  const handleStartParsing = async () => {
    // Force refresh credits one more time before navigating
    try {
      const credits = await ApiClient.getCredits(true);
      dispatch(fetchCredits());
      setUserCredits(credits);
    } catch (err) {
      console.error('Error refreshing credits before navigation:', err);
    }
    navigate('/requests');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Processing your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <h2 style={styles.errorTitle}>Payment Verification Error</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button onClick={() => navigate('/requests')} style={styles.button}>
            Go to Requests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.successContainer}>
        {/* Success Icon */}
        <div style={styles.successIcon}>
          <div style={styles.checkmark}>
            <div style={styles.checkmarkStem}></div>
            <div style={styles.checkmarkKick}></div>
          </div>
        </div>

        {/* Success Message */}
        <h1 style={styles.title}>Payment Successful!</h1>
        <p style={styles.subtitle}>
          Thank you for your subscription. Your payment has been processed successfully.
        </p>

        {/* Payment Details */}
        <div style={styles.paymentDetails}>
          <h3 style={styles.detailsTitle}>Payment Details</h3>
          <div style={styles.detailsGrid}>
            {paymentData?.planName && (
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Plan:</span>
                <span style={styles.detailValue}>{paymentData.planName}</span>
              </div>
            )}
            {paymentData?.amount && (
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Amount:</span>
                <span style={styles.detailValue}>${paymentData.amount.toFixed(2)}</span>
              </div>
            )}
            {paymentData?.sessionId && (
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Transaction ID:</span>
                <span style={styles.detailValue}>{paymentData.sessionId}</span>
              </div>
            )}
            {userCredits > 0 && (
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Credits Available:</span>
                <span style={styles.detailValue}>{userCredits.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Plan Information */}
        {userPlan && (
          <div style={styles.planInfo}>
            <h3 style={styles.planTitle}>Your Active Plan</h3>
            <div style={styles.planCard}>
              <div style={styles.planHeader}>
                <h4 style={styles.planName}>{userPlan.name}</h4>
                <span style={styles.planStatus}>{userPlan.status}</span>
              </div>
              <div style={styles.planFeatures}>
                <div style={styles.feature}>
                  <span style={styles.featureIcon}>📄</span>
                  <span style={styles.featureText}>
                    Parse unlimited bank statements
                  </span>
                </div>
                <div style={styles.feature}>
                  <span style={styles.featureIcon}>⚡</span>
                  <span style={styles.featureText}>
                    Fast processing & accurate results
                  </span>
                </div>
                <div style={styles.feature}>
                  <span style={styles.featureIcon}>📊</span>
                  <span style={styles.featureText}>
                    Detailed transaction analysis
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div style={styles.nextSteps}>
          <h3 style={styles.nextStepsTitle}>What's Next?</h3>
          <div style={styles.stepsList}>
            <div style={styles.step}>
              <span style={styles.stepNumber}>1</span>
              <span style={styles.stepText}>Upload your bank statements</span>
            </div>
            <div style={styles.step}>
              <span style={styles.stepNumber}>2</span>
              <span style={styles.stepText}>AI processes and analyzes your data</span>
            </div>
            <div style={styles.step}>
              <span style={styles.stepNumber}>3</span>
              <span style={styles.stepText}>Download structured results</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionButtons}>
          <button onClick={handleStartParsing} style={styles.primaryButton}>
            Start Parsing Documents
          </button>
          <button onClick={handleContinue} style={styles.secondaryButton}>
            Go to Requests
          </button>
        </div>

        {/* Support Link */}
        <div style={styles.supportSection}>
          <p style={styles.supportText}>
            Need help? <Link to="/support" style={styles.supportLink}>Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loadingContainer: {
    textAlign: 'center',
    color: 'white'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255, 255, 255, 0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  loadingText: {
    fontSize: '18px',
    margin: 0
  },
  errorContainer: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    maxWidth: '500px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
  },
  errorIcon: {
    fontSize: '60px',
    marginBottom: '20px'
  },
  errorTitle: {
    color: '#e74c3c',
    marginBottom: '10px',
    fontSize: '24px'
  },
  errorMessage: {
    color: '#666',
    marginBottom: '30px',
    lineHeight: 1.6
  },
  successContainer: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
    position: 'relative'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    background: '#2ecc71',
    borderRadius: '50%',
    margin: '0 auto 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  checkmark: {
    width: '40px',
    height: '40px',
    position: 'relative'
  },
  checkmarkStem: {
    position: 'absolute',
    width: '3px',
    height: '20px',
    background: 'white',
    left: '18px',
    top: '10px',
    transform: 'rotate(45deg)',
    transformOrigin: 'left bottom'
  },
  checkmarkKick: {
    position: 'absolute',
    width: '3px',
    height: '10px',
    background: 'white',
    left: '13px',
    top: '20px',
    transform: 'rotate(-45deg)',
    transformOrigin: 'left bottom'
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
  planInfo: {
    marginBottom: '30px'
  },
  planTitle: {
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  planCard: {
    border: '2px solid #3498db',
    borderRadius: '8px',
    padding: '20px',
    background: '#f8f9fa'
  },
  planHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  planName: {
    color: '#2c3e50',
    fontSize: '20px',
    fontWeight: '700',
    margin: 0
  },
  planStatus: {
    background: '#2ecc71',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  planFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  featureIcon: {
    fontSize: '18px'
  },
  featureText: {
    color: '#2c3e50',
    fontSize: '14px'
  },
  nextSteps: {
    marginBottom: '30px'
  },
  nextStepsTitle: {
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: 'left'
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  stepNumber: {
    background: '#3498db',
    color: 'white',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  stepText: {
    color: '#2c3e50',
    fontSize: '14px',
    lineHeight: 1.4
  },
  actionButtons: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
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
    minWidth: '200px'
  },
  secondaryButton: {
    background: 'transparent',
    color: '#3498db',
    border: '2px solid #3498db',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minWidth: '150px'
  },
  button: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  supportSection: {
    borderTop: '1px solid #ecf0f1',
    paddingTop: '20px'
  },
  supportText: {
    color: '#7f8c8d',
    fontSize: '14px',
    margin: 0
  },
  supportLink: {
    color: '#3498db',
    textDecoration: 'none',
    fontWeight: '600'
  }
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
`;
document.head.appendChild(styleSheet);

export default PaymentSuccessPage; 