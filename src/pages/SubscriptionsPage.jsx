import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, getSessionThunk } from '../store/authSlice';
import ApiClient from '../components/ApiClient';
import { useNavigate } from 'react-router-dom';
import lemonsqueezyService from '../services/lemonsqueezyService';
import config from '../config';
import '../styles/SubscriptionsPage.css';

function SubscriptionsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [credits, setCredits] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const subscriptionPlans = config.lemonSqueezy.plans;

  // Initialize auth and fetch user data on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      if (user?.id) {
        try {
          setIsLoading(true);
          
                  // Refresh user credits
        const credits = await ApiClient.getCredits();
          
          if (credits !== null && credits !== undefined) {
            setCredits(credits);
          }
          
          // Fetch current subscription if any
          const subscription = await lemonsqueezyService.getSubscriptionStatus(user.id);
          setCurrentSubscription(subscription);
          
          // Determine if current subscription is yearly
          if (subscription?.lemonsqueezy_data?.attributes?.variant_name) {
            const variantName = subscription.lemonsqueezy_data.attributes.variant_name;
            if (variantName.toLowerCase().includes('year') || variantName.toLowerCase().includes('annual')) {
              setBillingCycle('yearly');
            }
          } else {
            // Restore user's billing cycle preference from local storage
            const savedBillingCycle = localStorage.getItem('preferred_billing_cycle');
            if (savedBillingCycle === 'yearly' || savedBillingCycle === 'monthly') {
              setBillingCycle(savedBillingCycle);
            }
          }
          
          setIsLoading(false);
        } catch (err) {
          console.error('Error fetching initial data:', err);
          setError('Failed to load your account information');
          setIsLoading(false);
        }
      }
    };
    
    fetchInitialData();
  }, [user]);

  // Handle subscription checkout
  const handleSubscribe = async (plan) => {
    if (!user) {
      setError('Please sign in to subscribe');
      return;
    }

    setError('');
    setIsLoading(true);
    setSelectedPlan(plan);

    try {
      // Determine which variant ID to use based on billing cycle
      let variantId = plan.variantId; // Default to monthly variant
      
      // Check if yearly billing is selected and we have a yearly variant
      if (billingCycle === 'yearly' && plan.yearlyVariantId) {
        variantId = plan.yearlyVariantId;
      } else if (billingCycle === 'yearly') {
        // If yearly is selected but no yearly variant is defined, show error
        setError('Yearly billing option is not available for this plan');
        setIsLoading(false);
        return;
      }
      
      // Call the service to initialize checkout
      const planDetails = {
        name: plan.name,
        amount: billingCycle === 'yearly' ? (plan.price * 0.8 * 12).toFixed(2) : plan.price
      };
      
      const checkoutData = await lemonsqueezyService.initializeCheckout(
        variantId,
        user.id,
        planDetails
      );
      
      // Store billing cycle preference
      localStorage.setItem('preferred_billing_cycle', billingCycle);
      
      // Redirect to LemonSqueezy checkout
      if (checkoutData.checkoutUrl) {
        window.location.href = checkoutData.checkoutUrl;
      } else {
        throw new Error('Invalid checkout URL received');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setError(`Subscription error: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Check for return from LemonSqueezy
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      const query = new URLSearchParams(window.location.search);
      const status = query.get('status');
      
      if (status) {
        // Handle legacy redirects by forwarding to new payment pages
        if (status === 'success') {
          // Redirect to new success page
          window.location.replace('/payment/success');
          return;
        } else if (status === 'cancelled') {
          // Redirect to new failure page
          window.location.replace('/payment/failure');
          return;
        }
        
        // Clear the URL parameters for any other status
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (status === 'success') {
          // Fetch updated subscription status and credits
          try {
            setIsLoading(true);
            
            const subscription = await lemonsqueezyService.getSubscriptionStatus(user.id);
            setCurrentSubscription(subscription);
            
            // Fetch updated credits
            const credits = await ApiClient.getCredits();
            setCredits(credits);
            
            setIsLoading(false);
          } catch (err) {
            console.error('Error checking subscription status:', err);
            setIsLoading(false);
          }
        }
      }
    };
    
    if (user?.id) {
      checkSubscriptionStatus();
    }
  }, [user]);

  // Generate human-readable subscription status text
  const getSubscriptionStatusText = () => {
    if (!currentSubscription) return 'No active subscription';
    
    const planName = subscriptionPlans.find(p => p.variantId === currentSubscription.variant_id)?.name || 'Unknown Plan';
    
    switch (currentSubscription.status) {
      case 'active':
        return `Active subscription: ${planName}`;
      case 'past_due':
        return `Subscription payment past due: ${planName}`;
      case 'canceled':
        return `Subscription canceled (access until: ${new Date(currentSubscription.ends_at).toLocaleDateString()})`;
      default:
        return `Subscription status: ${currentSubscription.status}`;
    }
  };

  return (
    <div className="subscription-container">
      <header className="page-header">
        <h1 className="page-title">Subscription Plans</h1>
        <p className="page-subtitle">Choose the right plan to power your banking analysis</p>
      </header>
      
      {error && (
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>{error}</p>
        </div>
      )}
      
      {/* Current subscription and credits info */}
      {user && (
        <div className="user-status-container">
          <div className="credits-card">
            <div className="credits-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 12h-6.5"></path>
                <path d="M12 16V8"></path>
              </svg>
            </div>
            <div className="credits-info">
              <p className="credits-label">Available Credits</p>
              <p className="credits-value">{credits}</p>
            </div>
          </div>
          
          {currentSubscription && (
            <div className="subscription-info-card">
              <div className="subscription-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2H2v10h10V2z"></path>
                  <path d="M22 12H12v10h10V12z"></path>
                  <path d="M12 12H2v10h10V12z"></path>
                  <path d="M22 2h-5v5h5V2z"></path>
                </svg>
              </div>
              <div className="subscription-details">
                <p className="subscription-label">{getSubscriptionStatusText()}</p>
                {currentSubscription.status === 'active' && currentSubscription.renews_at && (
                  <p className="renewal-info">
                    Next renewal: {new Date(currentSubscription.renews_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {isLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Processing your request...</p>
        </div>
      ) : user ? (
        <>
          <div className="billing-toggle">
            <span className={`toggle-option ${billingCycle === 'monthly' ? 'active' : ''}`}
                  onClick={() => setBillingCycle('monthly')}>
              Monthly
            </span>
            <span className={`toggle-option ${billingCycle === 'yearly' ? 'active' : ''}`}
                  onClick={() => setBillingCycle('yearly')}>
              Yearly
              <span className="discount-badge">Save 20%</span>
            </span>
          </div>
          
          <div className="subscription-plans">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className={`subscription-plan-card ${currentSubscription?.variant_id === plan.variantId ? 'current-plan' : ''}`}>
                {currentSubscription?.variant_id === plan.variantId && 
                  <div className="current-plan-badge">Current Plan</div>
                }
                <h2 className="plan-name">{plan.name}</h2>
                <div className="plan-price">
                  ${billingCycle === 'yearly' ? (plan.price * 0.8 * 12).toFixed(2) : plan.price}
                  <span>/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
                <div className="plan-credits">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M16 12h-6.5"></path>
                    <path d="M12 16V8"></path>
                  </svg>
                  {plan.credits} credits per {billingCycle === 'yearly' ? 'month' : 'month'}
                </div>
                
                <ul className="plan-features">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="feature-item">{feature}</li>
                  ))}
                </ul>
                
                <button
                  onClick={() => handleSubscribe(plan)}
                  className={`btn ${currentSubscription?.variant_id === plan.variantId ? 'btn-secondary' : 'btn-primary'} btn-full`}
                  disabled={isLoading}
                >
                  {currentSubscription?.variant_id === plan.variantId
                    ? 'Current Plan'
                    : currentSubscription?.status === 'active'
                      ? 'Change Plan'
                      : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
          
          <div className="subscription-faq">
            <h3>Frequently Asked Questions</h3>
            <div className="faq-grid">
              <div className="faq-item">
                <h4>How are credits used?</h4>
                <p>Credits are consumed each time you process a bank statement or transaction file. The number of credits used depends on the complexity and size of the file.</p>
              </div>
              <div className="faq-item">
                <h4>Can I cancel anytime?</h4>
                <p>Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
              </div>
              <div className="faq-item">
                <h4>Do unused credits roll over?</h4>
                <p>Yes, unused credits roll over to the next month, so you never lose credits you've paid for.</p>
              </div>
              <div className="faq-item">
                <h4>How do I get more credits?</h4>
                <p>You can upgrade your plan at any time to receive more monthly credits.</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="auth-prompt">
          <div className="auth-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h2>Account Required</h2>
          <p>Please sign in or create an account to view and manage subscriptions.</p>
          <div className="auth-buttons">
            <button onClick={() => navigate('/login')} className="btn btn-primary">Sign In</button>
            <button onClick={() => navigate('/signup')} className="btn btn-outline">Create Account</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionsPage; 