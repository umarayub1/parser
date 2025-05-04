import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, getSessionThunk } from '../store/authSlice';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import UserCredits from '../components/UserCredits';

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
              // Refresh the page after a short delay to show updated credits
              setTimeout(() => {
                window.location.reload();
              }, 3000);
            } else if (['failed', 'expired', 'canceled'].includes(newStatus)) {
              setIsLoading(false);
              setError(`Payment ${newStatus}. Please try again.`);
              setLoadingMessage('');
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
      }
    }
  }, []);

  // Check for success in URL parameters or localStorage on page load
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('payment_status') === 'success' || localStorage.getItem('paymentSuccessful') === 'true') {
      setPaymentSuccessful(true);
      setPaymentStatus('succeeded');
      
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

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <h1 className="text-2xl font-bold">Top Up Credits with Cryptocurrency</h1>
      </header>
      
      {/* Show success message if payment was successful, regardless of user state */}
      {(paymentStatus === 'succeeded' || paymentSuccessful) ? (
        <div className="bg-green-100 p-4 rounded-lg mb-6">
          <p className="text-green-700">
            Payment successful! Your account has been credited.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Return to Home
          </button>
        </div>
      ) : isAuthLoading ? (
        <div className="flex items-center justify-center p-6">
          <div className="spinner mr-3"></div>
          <p>Loading your account...</p>
        </div>
      ) : user ? (
        <>
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <p className="text-lg">Current Credits: <span className="font-bold">{credits}</span></p>
          </div>
          
          {!isLoading && !nowPaymentsUrl && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-semibold mb-4">Select Amount to Top Up</h2>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Amount (USD)</label>
                <input
                  type="number"
                  min="5"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                />
                <p className="text-sm text-gray-500 mt-1">Minimum amount: $5</p>
              </div>
              
              <button
                onClick={handlePayment}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                Pay with Cryptocurrency
              </button>
            </div>
          )}
          
          {isLoading && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <div className="flex items-center justify-center">
                <div className="spinner mr-3"></div>
                <p>{loadingMessage}</p>
              </div>
            </div>
          )}
          
          {showSimulateButton && isDevelopment && (
            <div className="mt-4">
              <button
                onClick={handleSimulatePayment}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
              >
                Simulate Successful Payment
              </button>
              
              {nowPaymentsUrl && (
                <a
                  href={nowPaymentsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-blue-500 hover:underline"
                >
                  Open Payment Page Manually
                </a>
              )}
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 p-4 rounded-lg mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-yellow-100 p-6 rounded-lg">
          <p className="text-yellow-700 mb-4">Please sign in to top up your credits.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Go to Home Page
          </button>
        </div>
      )}
    </div>
  );
}

export default CryptoTopUpPage; 