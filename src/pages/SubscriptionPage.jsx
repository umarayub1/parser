import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { useNavigate } from 'react-router-dom';
import lemonsqueezyService from '../services/lemonsqueezyService';
import apiClient from '../components/ApiClient.js';
import config from '../config';
import '../styles/CryptoTopUp.css';

function SubscriptionPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [credits, setCredits] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const subscriptionPlans = config.lemonSqueezy.plans;

  // Initialize auth and fetch user data on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      if (user?.id) {
        setIsLoading(true);
        try {
          // Fetch user credits from API
          const userCredits = await apiClient.getCredits(true); // Force refresh
          setCredits(userCredits);
          
          // Fetch current subscription if any
          const subscription = await lemonsqueezyService.getSubscriptionStatus(user.id);
          setCurrentSubscription(subscription);
        } catch (err) {
          console.error('Error fetching initial data:', err);
          setError('Failed to load your account information');
        } finally {
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
      // Call the service to initialize checkout
      const checkoutData = await lemonsqueezyService.initializeCheckout(
        plan.variantId,
        user.id
      );
      
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

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!currentSubscription || !currentSubscription.lemonsqueezy_id) {
      setError('No active subscription to cancel');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await lemonsqueezyService.cancelSubscription(currentSubscription.lemonsqueezy_id);
      
      // Refresh subscription status
      const updatedSubscription = await lemonsqueezyService.getSubscriptionStatus(user.id);
      setCurrentSubscription(updatedSubscription);
      
      // Show success message
      setError(''); // Clear any existing errors
    } catch (err) {
      console.error('Cancellation error:', err);
      setError(`Failed to cancel subscription: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for return from LemonSqueezy
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      const query = new URLSearchParams(window.location.search);
      const status = query.get('status');
      
      if (status) {
        // Clear the URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (status === 'success') {
          setIsLoading(true);
          try {
            // Fetch updated subscription status
            const subscription = await lemonsqueezyService.getSubscriptionStatus(user.id);
            setCurrentSubscription(subscription);
            
            // Fetch updated credits
            const userCredits = await apiClient.getCredits(true); // Force refresh
            setCredits(userCredits);
          } catch (err) {
            console.error('Error checking subscription status:', err);
          } finally {
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
    <div className="crypto-container">
      <header className="page-header">
        <h1 className="page-title">Subscription Plans</h1>
      </header>
      
      {/* Current subscription info */}
      {user && (
        <div className="subscription-status">
          <div className="credits-card">
            <p className="credits-label">Current Credits</p>
            <p className="credits-value">{credits}</p>
          </div>
          
          {currentSubscription && (
            <div className="current-subscription">
              <p className="subscription-label">{getSubscriptionStatusText()}</p>
              {currentSubscription.status === 'active' && (
                <>
                  <p className="renewal-info">
                    Next renewal: {new Date(currentSubscription.renews_at).toLocaleDateString()}
                  </p>
                  <button 
                    onClick={handleCancelSubscription}
                    className="btn btn-secondary mt-2"
                    disabled={isLoading}
                  >
                    Cancel Subscription
                  </button>
                </>
              )}
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
        <div className="subscription-plans">
          {subscriptionPlans.map((plan) => (
            <div key={plan.id} className="subscription-plan-card">
              <h2 className="plan-name">{plan.name}</h2>
              <div className="plan-price">${plan.price}<span>/month</span></div>
              <div className="plan-credits">{plan.credits} credits per month</div>
              
              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index} className="feature-item">{feature}</li>
                ))}
              </ul>
              
              <button
                onClick={() => handleSubscribe(plan)}
                className="btn btn-primary btn-full"
                disabled={isLoading || (currentSubscription?.status === 'active' && currentSubscription?.variant_id === plan.variantId)}
              >
                {currentSubscription?.status === 'active' && currentSubscription?.variant_id === plan.variantId
                  ? 'Current Plan'
                  : currentSubscription?.status === 'active'
                    ? 'Change Plan'
                    : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="alert alert-warning">
          <p>Please sign in to subscribe.</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary mt-4"
          >
            Go to Home Page
          </button>
        </div>
      )}
      
      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default SubscriptionPage; 