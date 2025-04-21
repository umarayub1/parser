// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

const isDevelopment = import.meta.env.VITE_APP_MODE === 'development';

function App() {
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  // More detailed payment status: pending_creation, waiting, confirming, succeeded, failed, expired, canceled
  const [paymentStatus, setPaymentStatus] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [needsParsingTrigger, setNeedsParsingTrigger] = useState(false);
  const [nowPaymentsUrl, setNowPaymentsUrl] = useState(''); // To display link/QR potentially
  const [showSimulateButton, setShowSimulateButton] = useState(false); // New state

  // Ref to store the realtime channel
  const channelRef = useRef(null);

  // --- Configuration Check ---
  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL ||
        !import.meta.env.VITE_SUPABASE_ANON_KEY ||
        !import.meta.env.VITE_APP_BASE_URL) {
       setError("Critical configuration missing in .env file.");
       console.error("ERROR: Missing environment variables!");
    }
    // Handle return from NowPayments (doesn't confirm payment, just user action)
    handleNowPaymentsReturn();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Database Interaction (createInitialRequestRecord, updateRequestRecord) ---
  // Keep these functions exactly as they were in the secure Stripe version.
  const createInitialRequestRecord = useCallback(async (uploadedFile) => {
     // ... (same as before)
     try {
      const { data, error: dbError } = await supabase
        .from('requests')
        .insert({
          file_name: uploadedFile.name,
          file_size: uploadedFile.size,
          payment_status: 'pending', // Initial status before payment process starts
          parsing_status: 'pending',
        })
        .select('id')
        .single();

      if (dbError) throw dbError;
      if (!data || !data.id) throw new Error("Failed to create request record or retrieve its ID.");
      console.log('Initial request record created with ID:', data.id);
      return data.id;
    } catch (err) {
      console.error('Error creating initial request record:', err);
      setError(`Database error: ${err.message}. Could not initiate request.`);
      return null;
    }
  }, []);

  const updateRequestRecord = useCallback(async (requestId, updateData) => {
    // ... (same as before)
     if (!requestId) {
        console.error("Cannot update record without a request ID.");
        console.error("Update failed: Missing request ID.");
        return;
    }
    try {
        console.log(`Updating request ${requestId} with:`, updateData);
        const { error: dbError } = await supabase
            .from('requests')
            .update(updateData)
            .eq('id', requestId);

        if (dbError) throw dbError;
        console.log(`Request ${requestId} updated successfully.`);
    } catch (err) {
        console.error(`Error updating request record ${requestId}:`, err);
        console.error(`Database update error: ${err.message}`);
    }
  }, []);

  // --- Supabase Realtime Subscription ---
  useEffect(() => {
    // Only subscribe if we have a request ID and payment isn't already succeeded/failed/canceled
    if (currentRequestId && !['succeeded', 'failed', 'expired', 'canceled', 'refunded'].includes(paymentStatus)) {
      console.log(`Subscribing to Realtime updates for request ID: ${currentRequestId}`);

      // Ensure cleanup of previous channel if requestId changes
      if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
          console.log("Removed previous Realtime channel.");
      }


      const channel = supabase
        .channel(`request-status:${currentRequestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'requests',
            filter: `id=eq.${currentRequestId}`, // Only listen for changes to *this* request
          },
          (payload) => {
            console.log('Realtime UPDATE received:', payload);
            const updatedRequest = payload.new;
            if (updatedRequest) {
                 console.log(`Request ${currentRequestId} status updated via Realtime to: ${updatedRequest.payment_status}`);
                 // Update local state based on DB change
                 setPaymentStatus(updatedRequest.payment_status || ''); // Use DB status

                 if (updatedRequest.payment_status === 'succeeded') {
                    console.log("Payment SUCCEEDED via Realtime update!");
                    setError(''); // Clear errors like 'waiting'
                    setNeedsParsingTrigger(true);
                    setIsLoading(false); // Stop waiting indicator
                    setLoadingMessage('');
                    setNowPaymentsUrl(''); // Clear payment URL

                    // Unsubscribe after success? Or keep listening for other changes?
                    // supabase.removeChannel(channel);
                    // channelRef.current = null;
                 } else if (['failed', 'expired', 'canceled', 'refunded', 'partially_paid'].includes(updatedRequest.payment_status)) {
                     console.log(`Payment ended with status: ${updatedRequest.payment_status}`);
                     setError(`Payment status: ${updatedRequest.payment_status}. ${updatedRequest.error_message || ''}`);
                     setNeedsParsingTrigger(false);
                     setIsLoading(false);
                     setLoadingMessage('');
                     setNowPaymentsUrl('');
                     // Unsubscribe on final failure/cancel states
                     supabase.removeChannel(channel);
                     channelRef.current = null;
                 } else if (['waiting', 'confirming', 'confirmed', 'sending'].includes(updatedRequest.payment_status)) {
                     // Show progress, keep loading indicator active
                     setIsLoading(true);
                     setLoadingMessage(`Payment status: ${updatedRequest.payment_status}...`);
                     setNeedsParsingTrigger(false); // Not ready to parse yet
                 }
            }
          }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Realtime channel subscribed for ${currentRequestId}`);
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                console.error('Realtime subscription error:', status, err);
                setError("Realtime connection issue. Payment status updates might be delayed. Please refresh if needed.");
                // Maybe implement fallback polling here if critical
            }
        });

        channelRef.current = channel; // Store the channel

    } else {
         // If no request ID or payment already completed, remove listener
          if (channelRef.current) {
            console.log("Removing Realtime channel (no active request or final state).");
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
         }
    }

    // Cleanup function for when component unmounts or dependencies change
    return () => {
      if (channelRef.current) {
        console.log("Cleaning up Realtime channel on effect cleanup.");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Dependencies: only run when currentRequestId changes, or initial paymentStatus allows subscription
  }, [currentRequestId, paymentStatus]);


  // --- File Handling (same as before) ---
  const handleFileChange = (event) => {
    // ... (same as before) ...
     const selectedFile = event.target.files?.[0];
     if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        setFile(null);
        setFilePreviewUrl(null);
        return;
      }
      setFile(selectedFile);
      setError('');
      setParsedData(null);
      setNeedsParsingTrigger(false);
      setNowPaymentsUrl(''); // Reset payment URL if file changes
      setShowSimulateButton(false);

      // Don't reset paymentStatus automatically, user might have paid and wants to parse now
      // Check if current request ID is still valid / related to this file? Maybe reset request ID too?
      // For simplicity, let's assume a new file means a new payment process
       if (paymentStatus !== '' && paymentStatus !== 'succeeded') { // Allow re-parse if already succeeded
          setPaymentStatus('');
          setCurrentRequestId(null); // Reset request ID for new file flow
       }


      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(previewUrl);
      return () => URL.revokeObjectURL(previewUrl);
    }
  };

  // --- NowPayments Payment Initiation ---
  const handlePayment = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }
    setError('');
    setIsLoading(true);
    setLoadingMessage('Creating payment invoice...');
    setPaymentStatus('pending_creation'); // New status
    setParsedData(null);
    setShowSimulateButton(false);
    setNeedsParsingTrigger(false);
    setNowPaymentsUrl('');

    let localRequestId = currentRequestId;

    // 1. Create initial record if none exists for this flow
    if (!localRequestId) {
        localRequestId = await createInitialRequestRecord(file);
        if (!localRequestId) {
            setIsLoading(false);
            setPaymentStatus('');
            return; // Error set by createInitialRequestRecord
        }
        setCurrentRequestId(localRequestId); // Set the ID for this session/attempt
    } else {
        // If retrying payment for the same file/request ID, maybe clear old invoice data?
        await updateRequestRecord(localRequestId, {
            nowpayments_invoice_id: null,
            nowpayments_invoice_url: null,
            nowpayments_payment_status: null,
            payment_status: 'pending', // Reset status before creating new invoice
            error_message: null
         });
    }


    // 2. Call Edge Function to create NowPayments Invoice
    try {
        const { data, error: functionError } = await supabase.functions.invoke(
            'create-nowpayments-invoice',
            { body: { requestId: localRequestId } }
        );

        if (functionError) throw new Error(`Function error: ${functionError.message}`);
        if (data.error) throw new Error(`Invoice creation failed: ${data.error}`);

        const { invoiceUrl } = data;
        if (!invoiceUrl) throw new Error('Could not retrieve NowPayments invoice URL.');

        console.log("Received NowPayments URL:", invoiceUrl);
        setNowPaymentsUrl(invoiceUrl); // Store for potential display

        if (isDevelopment) {
          // In Dev: Don't redirect automatically. Show info and simulate button.
          setLoadingMessage('Invoice created (Dev Mode). Click "Simulate Success" or pay manually.');
          setIsLoading(false); // Stop loading indicator
          setPaymentStatus('waiting'); // Update status
          setShowSimulateButton(true); // Show the simulate button
          // Optionally display the invoiceUrl link for manual testing
      } else {
          // In Production: Redirect immediately
          setLoadingMessage('Redirecting to NowPayments for payment...');
          setPaymentStatus('waiting'); // Update status
          window.location.href = invoiceUrl; // Redirect
      }

        // Option B: Display Link/QR (More complex - requires QR generation)
        // setLoadingMessage('Please follow the link below to pay:');
        // setIsLoading(false); // Stop loading if showing link

    } catch (err) {
        console.error('NowPayments initiation error:', err);
        setError(`Payment error: ${err.message}`);
        setIsLoading(false);
        setPaymentStatus('failed');
        setShowSimulateButton(false);
        if (localRequestId) {
             await updateRequestRecord(localRequestId, { payment_status: 'failed', error_message: `Invoice creation failed: ${err.message}` });
        }
    }
  };

  const handleSimulatePayment = async () => {
    if (!currentRequestId) {
        setError("Cannot simulate: No active Request ID.");
        return;
    }
    console.log(`Attempting simulation for Request ID: ${currentRequestId}`);
    setIsLoading(true);
    setLoadingMessage('Simulating successful payment...');
    setError('');
    setShowSimulateButton(false); // Hide button after clicking

    try {
        const { data, error: functionError } = await supabase.functions.invoke(
            'simulate-payment-success',
            { body: { requestId: currentRequestId } }
        );

        if (functionError) throw new Error(`Function error: ${functionError.message}`);
        if (data.error) throw new Error(`Simulation failed: ${data.error}`);

        console.log("Simulation function executed successfully:", data.message);
        // No need to set state here directly. The Realtime listener
        // should detect the DB change triggered by the function and update the state.
        setLoadingMessage('Simulation successful. Waiting for confirmation...'); // Message until Realtime updates state

    } catch (err) {
        console.error('Payment simulation error:', err);
        setError(`Simulation failed: ${err.message}`);
        setIsLoading(false); // Stop loading on error
        setLoadingMessage('');
         // Optionally re-show button on failure? Or require starting over?
         // setShowSimulateButton(true);
    }
    // Note: setIsLoading(false) will happen naturally when the Realtime listener
    // receives the 'succeeded' status and updates the paymentStatus state.
  };

  // --- Handle Return from NowPayments (User action, not payment confirmation) ---
   const handleNowPaymentsReturn = useCallback(() => {
      const query = new URLSearchParams(window.location.search);
      const returnStatus = query.get('payment_return'); // 'success' or 'cancel'
      const requestId = query.get('request_id');

      if (returnStatus && requestId) {
          console.log(`Returned from NowPayments with status: ${returnStatus} for request: ${requestId}`);
          window.history.replaceState({}, document.title, window.location.pathname); // Clean URL

          setCurrentRequestId(requestId); // Ensure we have the request ID

          if (returnStatus === 'success') {
              // User completed *something* on NowPayments page - DON'T assume paid yet
              // Set state to indicate we are waiting for IPN confirmation
              setLoadingMessage('Payment submitted. Waiting for blockchain confirmation (this may take some time)...');
              setIsLoading(true); // Show loading indicator while waiting for IPN->Realtime
              setPaymentStatus('confirming'); // Tentative status, Realtime will update
              setError('');
          } else if (returnStatus === 'cancel') {
              // User clicked cancel on NowPayments page
              setError('Payment was canceled on the NowPayments page.');
              setPaymentStatus('canceled'); // Set final canceled status
              setIsLoading(false);
              setLoadingMessage('');
              // Update DB (optional, IPN might send 'expired' later anyway)
              // updateRequestRecord(requestId, { payment_status: 'canceled' });
          }
      }
      // No return params? Do nothing.
  }, [/* no direct dependencies needed here, operates on URL */]);


  // --- Trigger Parsing (Secure Version - Upload to Storage, then call function) ---
  const triggerParsing = async () => {
      // Keep this function exactly as it was in the secure Stripe version
      // It should only be callable when paymentStatus === 'succeeded'
       if (!file || !currentRequestId || paymentStatus !== 'succeeded') {
          setError("Cannot start parsing. Ensure payment was successful and a file is selected.");
          return;
      }

      setIsLoading(true);
      setLoadingMessage('Uploading file and starting analysis...');
      setError('');
      setParsedData(null);
      setNeedsParsingTrigger(false); // Parsing is being attempted

      try {
          // 1. Upload file to Supabase Storage
          const timestamp = Date.now();
          const filePath = `user_statements/${currentRequestId}_${timestamp}_${file.name}`;
          console.log(`Uploading to Supabase Storage: ${filePath}`);

          const { error: uploadError } = await supabase
              .storage
              .from('statement-uploads') // *** YOUR BUCKET NAME ***
              .upload(filePath, file);

          if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
          console.log("File uploaded successfully to Storage.");

          // 2. Update DB record
          await updateRequestRecord(currentRequestId, { parsing_status: 'processing' });

          // 3. Call the parsing Edge Function
          setLoadingMessage('Parsing statement via secure function...');
          const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
              'parse-bank-statement',
              { body: { requestId: currentRequestId, storagePath: filePath } }
          );

          if (functionError) throw new Error(`Function invocation error: ${functionError.message}`);
          if (functionResponse.error) throw new Error(`Parsing function failed: ${functionResponse.error}`);

          console.log('Parsing function successful:', functionResponse);

          // 4. Update state with results (DB record updated by function)
          setParsedData(functionResponse.data);
          setError('');

      } catch (err) {
          console.error('Parsing trigger error:', err);
          setError(`Parsing failed: ${err.message}`);
          setParsedData(null);
          if (currentRequestId) {
              await updateRequestRecord(currentRequestId, {
                  parsing_status: 'error',
                  error_message: `Client-side parsing trigger failed: ${err.message}`
              });
          }
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
  };

  // --- Render Logic ---
  return (
    <div className="container">
      <h1>Bank Statement Parser MVP</h1>
      <p>Upload PDF, pay securely with Crypto via NowPayments, get results.</p>
      {isDevelopment && <p className="warning-message"><strong>Development Mode Active:</strong> Payment simulation enabled.</p>}
      <p className="info-message">Note: Crypto payments require network confirmations and may take some time after you send funds.</p>

      {/* File Upload */}
      <div className="upload-section">
         <label htmlFor="file-upload" className={`custom-file-upload ${isLoading ? 'disabled' : ''}`}>
          {file ? `Selected: ${file.name}` : '1. Choose PDF File'}
        </label>
        <input
          id="file-upload"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        {/* Pay or Parse Button */}
        {!needsParsingTrigger && paymentStatus !== 'succeeded' && (
            <button
              onClick={handlePayment}
              disabled={!file || isLoading || ['pending_creation', 'waiting', 'confirming', 'confirmed', 'sending'].includes(paymentStatus)}
              className="cta-button"
            >
              {isLoading && paymentStatus === 'pending_creation' ? 'Creating Invoice...' : '2. Pay with Crypto'}
            </button>
        )}
        {/* Simulate Button (Dev Only) */}
        {isDevelopment && showSimulateButton && !isLoading && (
                     <button onClick={handleSimulatePayment} className="cta-button simulate-button">
                        ⚡ Simulate Payment Success (Dev)
                    </button>
        )}
        {needsParsingTrigger && file && paymentStatus === 'succeeded' && (
             <button
              onClick={triggerParsing}
              disabled={isLoading || !file}
              className="cta-button parse-button"
            >
              {isLoading ? 'Parsing...' : '3. Start Parsing'}
            </button>
        )}
      </div>

      {/* Dev Mode: Display Invoice URL if available */}
      {isDevelopment && nowPaymentsUrl && showSimulateButton && (
        <div className='dev-info'>
            <p>Dev: Invoice created. You can simulate success above, or pay manually:</p>
            <a href={nowPaymentsUrl} target="_blank" rel="noopener noreferrer" style={{wordBreak: 'break-all'}}>{nowPaymentsUrl}</a>
        </div>
      )}

      {/* User Messages */}
      {error && <p className="error-message">Error: {error}</p>}
      {paymentStatus === 'canceled' && <p className="info-message">Payment was canceled. Select a file and try again.</p>}
      {paymentStatus === 'expired' && <p className="warning-message">The payment invoice expired. Please try again.</p>}
      {paymentStatus === 'failed' && <p className="error-message">Payment failed. Please check NowPayments or try again.</p>}
      {paymentStatus === 'waiting' && !isLoading && ( // Show only if not loading (e.g., in dev mode waiting for simulation click)
                 <p className="info-message">Invoice created. Please proceed with payment {isDevelopment ? 'or simulation' : ''}.</p>
      )}
      {paymentStatus === 'succeeded' && !parsedData && !isLoading && !error && needsParsingTrigger && file && (
          <p className="success-message">Payment confirmed! Click "Start Parsing".</p>
      )}
      {paymentStatus === 'succeeded' && !parsedData && !isLoading && !error && needsParsingTrigger && !file && (
          <p className="warning-message">Payment confirmed! Please re-select the PDF file, then click "Start Parsing".</p>
      )}
      {/* Display NowPayments Link (Optional - if not redirecting immediately) */}
      {/* {nowPaymentsUrl && !isLoading && (
          <div className="payment-link-section">
              <p>Click the link to pay:</p>
              <a href={nowPaymentsUrl} target="_blank" rel="noopener noreferrer">{nowPaymentsUrl}</a>
              <p>(Waiting for payment confirmation after you send funds...)</p>
          </div>
      )} */}


      {/* Loading Indicator */}
      {isLoading && (
          <div className="loading-indicator">
              <div className="spinner"></div>
              <p>{loadingMessage || 'Processing...'}</p>
              {['waiting', 'confirming', 'confirmed', 'sending'].includes(paymentStatus) && (
                  <p>You may be redirected to NowPayments. After paying, please wait for confirmation here.</p>
              )}
          </div>
      )}

      {/* Results Section (same as before) */}
      {filePreviewUrl && parsedData && !isLoading && (
        <div className="results-section">
           {/* ... PDF and JSON viewers ... */}
           <h2>Results</h2>
          <div className="results-grid">
            <div className="pdf-viewer">
              <h3>Original PDF</h3>
              <iframe
                src={filePreviewUrl}
                width="100%"
                height="500px"
                title="PDF Preview"
              />
            </div>
            <div className="json-viewer">
              <h3>Parsed JSON Data</h3>
              <pre><code>{JSON.stringify(parsedData, null, 2)}</code></pre>
            </div>
          </div>
        </div>
      )}
       {/* PDF Preview before results (same as before) */}
       {!parsedData && filePreviewUrl && !isLoading && (
           <div className="preview-section">
              {/* ... iframe preview ... */}
               <h3>PDF Preview</h3>
               <iframe
                src={filePreviewUrl}
                width="100%"
                height="500px"
                title="PDF Preview (Before Parsing)"
              />
           </div>
       )}
    </div>
  );
}

export default App;