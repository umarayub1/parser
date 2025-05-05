import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, getSessionThunk } from '../store/authSlice';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/CryptoTopUp.css';

function CryptoTopUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [nowPaymentsUrl, setNowPaymentsUrl] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [showSimulateButton, setShowSimulateButton] = useState(false);
  const [amountUSD, setAmountUSD] = useState(10); // Default amount
  const [credits, setCredits] = useState(0);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [selectedOption, setSelectedOption] = useState(1); // Default to first option
  
  // Preset amount options (USD)
  const amountOptions = [
    { value: 10, credits: 10 },
    { value: 25, credits: 25 },
    { value: 50, credits: 50 },
    { value: 100, credits: 100 },
    { value: 250, credits: 250 },
    { value: 500, credits: 500 },
    { value: 1000, credits: 1000 },
    { value: 2500, credits: 2500 },
    { value: 5000, credits: 5000 },
  ];
  
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isDevelopment = import.meta.env.VITE_APP_MODE === 'development';

  // Initialize auth on component mount
  useEffect(() => {
    const initAuth = async () => {
      setIsAuthLoading(true);
      await dispatch(getSessionThunk());
      setIsAuthLoading(false);
    };
    
    initAuth();
  }, [dispatch]);

  // Fetch user credits on load
  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('credits_remaining')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setCredits(data.credits_remaining || 0);
        }
      } catch (err) {
        console.error('Error fetching user credits:', err);
      }
    };
    
    fetchUserCredits();
  }, [user]);

  // Handle return from payment gateway
  useEffect(() => {
    handleNowPaymentsReturn();
  }, []);

  // Handle option selection
  const handleOptionSelect = (index) => {
    setSelectedOption(index);
    setAmountUSD(amountOptions[index].value);
    setUseCustomAmount(false);
  };

  // Handle custom amount checkbox toggle
  const handleCustomAmountToggle = () => {
    setUseCustomAmount(!useCustomAmount);
    if (!useCustomAmount) {
      setSelectedOption(null);
    } else {
      // When disabling custom amount, go back to selected option or default
      setSelectedOption(selectedOption !== null ? selectedOption : 0);
      setAmountUSD(selectedOption !== null ? amountOptions[selectedOption].value : amountOptions[0].value);
    }
  };

  // Create a request record for the top-up
  const createTopUpRequest = async (amount) => {
    try {
      const insertData = {
        user_id: user?.id || null,
        amount_usd: amount,
        payment_status: 'pending',
        type: 'top_up',
      };

      const { data, error } = await supabase
        .from('credit_transactions')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      if (!data || !data.id) throw new Error("Failed to create top-up request record");

      return data.id;
    } catch (err) {
      console.error('Error creating top-up request:', err);
      throw err;
    }
  };

  // Update the request record
  const updateRequestRecord = async (requestId, updates) => {
    try {
      const { error } = await supabase
        .from('credit_transactions')
        .update(updates)
        .eq('id', requestId);

      if (error) throw error;
      console.log(`Request ${requestId} updated with:`, updates);
      return true;
    } catch (err) {
      console.error(`Failed to update request ${requestId}:`, err);
      return false;
    }
  };

  // Handle payment initiation
  const handlePayment = async () => {
    if (!user) {
      setError('Please sign in to top up credits.');
      return;
    }

    if (amountUSD < 5) {
      setError('Minimum amount is $5.');
      return;
    }

    setError('');
    setIsLoading(true);
    setLoadingMessage('Preparing payment invoice...');
    setPaymentStatus('pending_creation');
    setNowPaymentsUrl('');
    setCurrentStep(2);

    try {
      // Create initial request record
      const newRequestId = await createTopUpRequest(amountUSD);
      if (!newRequestId) {
        throw new Error("Failed to create initial database record.");
      }
      setCurrentRequestId(newRequestId);
      console.log(`Created top-up request record with ID: ${newRequestId}`);

      // Call Edge Function to create NowPayments Invoice
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-nowpayments-invoice',
        { body: { requestId: newRequestId, type: 'top_up', amount: amountUSD } }
      );

      if (functionError) throw new Error(`Function error: ${functionError.message}`);
      if (data.error) throw new Error(`Invoice creation failed: ${data.error}`);

      const { invoiceUrl } = data;
      if (!invoiceUrl) throw new Error('Could not retrieve NowPayments invoice URL.');

      console.log("Received NowPayments URL:", invoiceUrl);
      setNowPaymentsUrl(invoiceUrl);
      setCurrentStep(3);

      if (isDevelopment) {
        // In Dev: Don't redirect automatically. Show info and simulate button.
        setLoadingMessage('Invoice created (Dev Mode). Click "Simulate Success" or pay manually.');
        setIsLoading(false);
        setPaymentStatus('waiting');
        setShowSimulateButton(true);
      } else {
        // In Production: Redirect immediately
        setLoadingMessage('Redirecting to NowPayments for payment...');
        setPaymentStatus('waiting');
        window.location.href = invoiceUrl;
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      setError(`Payment error: ${err.message}`);
      setIsLoading(false);
      setPaymentStatus('failed');
      setShowSimulateButton(false);
      setCurrentStep(1);
      
      // Update request record on failure if it was created
      if (currentRequestId) {
        await updateRequestRecord(currentRequestId, { 
          payment_status: 'failed', 
          error_message: `Invoice creation failed: ${err.message}` 
        });
      }
    }
  };

  // Handle payment simulation (for development)
  const handleSimulatePayment = async () => {
    if (!currentRequestId) {
      setError("Cannot simulate: No active Request ID.");
      return;
    }
    
    console.log(`Attempting simulation for Request ID: ${currentRequestId}`);
    setIsLoading(true);
    setLoadingMessage('Simulating successful payment...');
    setError('');
    setShowSimulateButton(false);
    setCurrentStep(4);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'simulate-payment-success',
        { body: { requestId: currentRequestId, type: 'top_up' } }
      );

      if (functionError) throw new Error(`Function error: ${functionError.message}`);
      if (data.error) throw new Error(`Simulation failed: ${data.error}`);

      console.log("Simulation function executed successfully:", data.message);
      setLoadingMessage('Simulation successful. Waiting for confirmation...');
      setPaymentSuccessful(true);
      setPaymentStatus('succeeded');
      setCurrentStep(5);
      
      // Store payment success in localStorage to persist through reload
      localStorage.setItem('paymentSuccessful', 'true');
      
      // Refresh the page after a short delay to show updated credits
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error('Payment simulation error:', err);
      setError(`Simulation failed: ${err.message}`);
      setIsLoading(false);
      setLoadingMessage('');
      setCurrentStep(3);
    }
  };

  // Handle return from NowPayments
  const handleNowPaymentsReturn = useCallback(() => {
    const query = new URLSearchParams(window.location.search);
    const returnStatus = query.get('payment_return');
    const requestId = query.get('request_id');

    if (returnStatus && requestId) {
      console.log(`Returned from NowPayments with status: ${returnStatus} for request: ${requestId}`);
      window.history.replaceState({}, document.title, window.location.pathname);

      setCurrentRequestId(requestId);

      if (returnStatus === 'success') {
        // User completed something on NowPayments page - DON'T assume paid yet
        setLoadingMessage('Payment submitted. Waiting for blockchain confirmation (this may take some time)...');
        setIsLoading(true);
        setPaymentStatus('confirming');
        setError('');
        setCurrentStep(4);
        
        // Set up a realtime subscription to listen for payment updates
        const channel = supabase
          .channel(`credit_transaction:${requestId}`)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'credit_transactions', 
            filter: `id=eq.${requestId}` 
          }, (payload) => {
            console.log('Realtime payment update:', payload);
            const newStatus = payload.new.payment_status;
            
            setPaymentStatus(newStatus);
            
            if (newStatus === 'succeeded') {
              setIsLoading(false);
              setLoadingMessage('Payment successful! Your credits have been added.');
              setPaymentSuccessful(true);
              setCurrentStep(5);
              // Refresh the page after a short delay to show updated credits
              setTimeout(() => {
                window.location.reload();
              }, 3000);
            } else if (['failed', 'expired', 'canceled'].includes(newStatus)) {
              setIsLoading(false);
              setError(`Payment ${newStatus}. Please try again.`);
              setLoadingMessage('');
              setCurrentStep(1);
            }
          })
          .subscribe();
          
        // Cleanup the subscription when component unmounts
        return () => {
          supabase.removeChannel(channel);
        };
      } else if (returnStatus === 'cancel') {
        // User clicked cancel on NowPayments page
        setError('Payment was canceled on the NowPayments page.');
        setPaymentStatus('canceled');
        setIsLoading(false);
        setLoadingMessage('');
        setCurrentStep(1);
      }
    }
  }, []);

  // Check for success in URL parameters or localStorage on page load
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('payment_status') === 'success' || localStorage.getItem('paymentSuccessful') === 'true') {
      setPaymentSuccessful(true);
      setPaymentStatus('succeeded');
      setCurrentStep(5);
      
      // Clear localStorage after reading it
      if (localStorage.getItem('paymentSuccessful') === 'true') {
        console.log("Found successful payment in localStorage");
        // Don't clear immediately to prevent flickering if page reloads
        setTimeout(() => {
          localStorage.removeItem('paymentSuccessful');
        }, 5000);
      }
    }
  }, []);

  // Get step class based on current step and step number
  const getStepClass = (stepNumber) => {
    if (currentStep > stepNumber) return "step completed";
    if (currentStep === stepNumber) return "step active";
    return "step";
  };

  return (
    <div className="crypto-container">
      <header className="page-header">
        <h1 className="page-title">Top Up Credits</h1>
      </header>
      
      {/* Payment progress steps */}
      {!paymentSuccessful && (
        <div className="payment-steps">
          <div className={getStepClass(1)}>
            <div className="step-number">1</div>
            <div className="step-label">Select Amount</div>
          </div>
          <div className={getStepClass(2)}>
            <div className="step-number">2</div>
            <div className="step-label">Create Invoice</div>
          </div>
          <div className={getStepClass(3)}>
            <div className="step-number">3</div>
            <div className="step-label">Payment</div>
          </div>
          <div className={getStepClass(4)}>
            <div className="step-number">4</div>
            <div className="step-label">Processing</div>
          </div>
          <div className={getStepClass(5)}>
            <div className="step-number">5</div>
            <div className="step-label">Complete</div>
          </div>
        </div>
      )}
      
      {/* Show success message if payment was successful, regardless of user state */}
      {(paymentStatus === 'succeeded' || paymentSuccessful) ? (
        <div className="alert alert-success">
          <h2 className="card-title">Payment Successful!</h2>
          <p>Your account has been credited with the purchased amount.</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary mt-4"
          >
            Return to Home
          </button>
        </div>
      ) : isAuthLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your account...</p>
        </div>
      ) : user ? (
        <>
          <div className="credits-card">
            <p className="credits-label">Current Credits</p>
            <p className="credits-value">{credits}</p>
          </div>
          
          {!isLoading && !nowPaymentsUrl && (
            <div className="payment-card">
              <h2 className="card-title">Select Amount to Top Up</h2>
              
              {/* Preset amount options */}
              <div className="amount-options">
                {amountOptions.map((option, index) => (
                  <div
                    key={index}
                    className={`amount-option ${selectedOption === index && !useCustomAmount ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(index)}
                  >
                    <div className="amount-option-value">${option.value}</div>
                    <div className="amount-option-credits">{option.credits} credits</div>
                  </div>
                ))}
              </div>
              
              {/* Custom amount option */}
              <div className="custom-amount">
                <label className="custom-amount-label">
                  <input
                    type="checkbox"
                    className="custom-amount-checkbox"
                    checked={useCustomAmount}
                    onChange={handleCustomAmountToggle}
                  />
                  Custom Amount
                </label>
                
                {useCustomAmount && (
                  <div>
                    <input
                      type="number"
                      min="5"
                      value={amountUSD}
                      onChange={(e) => setAmountUSD(Number(e.target.value))}
                      className="amount-input"
                    />
                    <p className="amount-help">Minimum amount: $5</p>
                  </div>
                )}
              </div>
              
              <button
                onClick={handlePayment}
                className="btn btn-primary btn-full"
                style={{ marginTop: '1.5rem' }}
              >
                Pay
              </button>
            </div>
          )}
          
          {isLoading && (
            <div className="payment-card">
              <div className="loading-container">
                <div className="spinner"></div>
                <p>{loadingMessage}</p>
              </div>
            </div>
          )}
          
          {showSimulateButton && isDevelopment && (
            <div className="payment-card">
              <button
                onClick={handleSimulatePayment}
                className="btn btn-secondary btn-full mb-4"
              >
                Simulate Successful Payment
              </button>
              
              {nowPaymentsUrl && (
                <a
                  href={nowPaymentsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="payment-link"
                >
                  Open Payment Page Manually
                </a>
              )}
            </div>
          )}
          
          {error && (
            <div className="alert alert-error">
              <p>{error}</p>
            </div>
          )}
        </>
      ) : (
        <div className="alert alert-warning">
          <p>Please sign in to top up your credits.</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary mt-4"
          >
            Go to Home Page
          </button>
        </div>
      )}
    </div>
  );
}

export default CryptoTopUpPage; 