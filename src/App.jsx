// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import './App.css';
import StatementSummary from './components/StatementSummary';
import TransactionsTable from './components/TransactionsTable';
import BalancesTable from './components/BalancesTable';
import { PDFDocument } from 'pdf-lib'; // Import pdf-lib

const isDevelopment = import.meta.env.VITE_APP_MODE === 'development';

// Helper function to format time
function formatTime(ms) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function App() {
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  // More detailed payment status: pending_creation, waiting, confirming, succeeded, failed, expired, canceled
  const [paymentStatus, setPaymentStatus] = useState('');
  const [parsingStatus, setParsingStatus] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [needsParsingTrigger, setNeedsParsingTrigger] = useState(false);
  const [nowPaymentsUrl, setNowPaymentsUrl] = useState(''); // To display link/QR potentially
  const [showSimulateButton, setShowSimulateButton] = useState(false); // New state
  
  // Added for parsing time estimation
  const [pageCount, setPageCount] = useState(0);
  const [timerId, setTimerId] = useState(null); // Interval ID for countdown
  const [remainingTime, setRemainingTime] = useState(0); // Remaining time in ms
  const [totalDuration, setTotalDuration] = useState(0); // Total duration in ms

  // --- State for Test Upload ---
  const [testFilePreviewUrl, setTestFilePreviewUrl] = useState(null);
  const [testJsonData, setTestJsonData] = useState(null);
  const [testPdfFileName, setTestPdfFileName] = useState(''); // To show selected filename
  const [testJsonFileName, setTestJsonFileName] = useState(''); // To show selected filename

  // Ref to store the realtime channel
  const channelRef = useRef(null);

  // --- Configuration Check & Unmount Cleanup ---
  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL ||
        !import.meta.env.VITE_SUPABASE_ANON_KEY ||
        !import.meta.env.VITE_APP_BASE_URL) {
       setError("Critical configuration missing in .env file.");
       console.error("ERROR: Missing environment variables!");
    }
    // Handle return from NowPayments (doesn't confirm payment, just user action)
    handleNowPaymentsReturn();

    // Cleanup function to revoke URLs when component unmounts
    return () => {
      if (filePreviewUrl) {
        console.log("Revoking object URL on unmount:", filePreviewUrl);
        URL.revokeObjectURL(filePreviewUrl);
      }
      if (testFilePreviewUrl) { // Add cleanup for test URL
        console.log("Revoking TEST object URL on unmount:", testFilePreviewUrl);
        URL.revokeObjectURL(testFilePreviewUrl);
      }
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Effect runs only on mount/unmount

  // --- Cleanup Timer on Unmount ---
  useEffect(() => {
    // Cleanup function to clear interval when component unmounts
    return () => {
      if (timerId) {
        console.log("Clearing timer interval on unmount:", timerId);
        clearInterval(timerId);
      }
    };
  }, [timerId]); // Dependency ensures cleanup runs if timerId changes

  // --- Database Interaction (createInitialRequestRecord, updateRequestRecord) ---
  // Keep these functions exactly as they were in the secure Stripe version.
  const createInitialRequestRecord = useCallback(async (uploadedFile, pageCount) => {
     // ... (same as before)
     try {
      const { data, error: dbError } = await supabase
        .from('requests')
        .insert({
          file_name: uploadedFile.name,
          file_size: uploadedFile.size,
          page_count: pageCount, // Add page_count here
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
    // Only subscribe if we have a request ID 
    // AND the payment process hasn't definitively failed or ended negatively.
    // This allows listening for payment status AND subsequent parsing status after payment succeeds.
    if (currentRequestId && !['failed', 'expired', 'canceled', 'refunded'].includes(paymentStatus)) {
      console.log(`Subscribing to Realtime updates for request ID: ${currentRequestId}`);

      // Ensure cleanup of previous channel if requestId changes or dependencies change
      if (channelRef.current) {
          console.log("Removing previous Realtime channel before creating new one.");
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      }

      console.log(`Creating new Realtime channel for request: ${currentRequestId}`);
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
                console.log(`Realtime: Payment Status: ${updatedRequest.payment_status}, Parsing Status: ${updatedRequest.parsing_status}`);

                 // --- Handle Payment Status Updates --- 
                 const currentPaymentStatus = updatedRequest.payment_status || '';
                 setPaymentStatus(currentPaymentStatus);

                 if (currentPaymentStatus === 'succeeded' && updatedRequest.parsing_status === 'pending') {
                    console.log("Payment SUCCEEDED via Realtime update!");
                    setError(''); // Clear errors like 'waiting'
                    // Don't set isLoading false here if parsing might start
                    if (!needsParsingTrigger) { // Only trigger if parsing hasn't started
                        setNeedsParsingTrigger(true);
                    }
                    // If parsing is already in progress, don't mess with loading state
                    // Reset loading state *after* payment success is confirmed,
                    // allowing the user to click the 'Start Parsing' button.
                    setIsLoading(false); 
                    setLoadingMessage(''); // Clear any 'confirming' message
                    setNowPaymentsUrl(''); // Clear payment URL
                 } else if (['failed', 'expired', 'canceled', 'refunded', 'partially_paid'].includes(currentPaymentStatus)) {
                     console.log(`Payment ended with status: ${currentPaymentStatus}`);
                     setError(`Payment status: ${currentPaymentStatus}. ${updatedRequest.error_message || ''}`);
                     setNeedsParsingTrigger(false);
                     setIsLoading(false); // Payment failed, stop loading
                     setLoadingMessage('');
                     // Stop parsing timer if payment fails mid-parse (unlikely but possible)
                     // REMOVED Timer logic
                     // REMOVED setParsingProgress(0);
                 } else if (['waiting', 'confirming', 'confirmed', 'sending'].includes(currentPaymentStatus)) {
                     // Show progress, keep loading indicator active
                     setIsLoading(true);
                     setLoadingMessage(`Payment status: ${currentPaymentStatus}...`);
                     setNeedsParsingTrigger(false); // Not ready to parse yet
                 }
                 
                 // --- Handle Parsing Status Updates --- 
                 const currentParsingStatus = updatedRequest.parsing_status;
                 setParsingStatus(currentParsingStatus);
                 // Clear timer and reset related state when parsing finishes or errors
                 const clearTimer = () => {
                    if (timerId) {
                        console.log("Clearing timer interval due to parsing status:", timerId);
                        clearInterval(timerId);
                        setTimerId(null);
                    }
                    setRemainingTime(0);
                    setTotalDuration(0);
                 }

                 if (currentParsingStatus === 'success') {
                     console.log("Realtime: Parsing completed, received data from DB");
                     clearTimer(); // Clear timer on success
                     
                     // Removed progress update
                     
                     try {
                       // Ensure data exists and is valid JSON (either string or object)
                       if (!updatedRequest.parsed_data) {
                         throw new Error("Parsing completed but no data received from server.");
                       }
                       const receivedData = typeof updatedRequest.parsed_data === 'string' 
                         ? JSON.parse(updatedRequest.parsed_data) 
                         : updatedRequest.parsed_data;
                       
                       // Basic validation of received data structure
                       if (!receivedData || !receivedData.meta_data || !receivedData.transactions_data) {
                         throw new Error("Received data is missing expected structure (meta_data or transactions_data).");
                       }

                       setParsedData(receivedData);
                       setIsLoading(false); // Parsing done, stop loading
                       setLoadingMessage('Parsing Complete!'); // Confirmation message
                       setError(''); // Clear any previous errors
                       console.log("Successfully updated parsed data from DB");

                     } catch (err) {
                       console.error("Error processing parsed data from DB:", err);
                       setError(`Error displaying results: ${err.message}`);
                       setIsLoading(false); // Stop loading even if data processing fails
                       setLoadingMessage('');
                     }
                     // Unsubscribe after completion? Maybe not if other updates are possible.
                     // supabase.removeChannel(channel);
                     // channelRef.current = null;
                 } else if (currentParsingStatus === 'error') {
                     console.log("Realtime: Parsing error reported from server");
                     setError(`Parsing error: ${updatedRequest.error_message || 'Unknown processing error'}`);
                     clearTimer(); // Clear timer on error
                     
                     // Removed progress reset
                     setIsLoading(false); // Stop loading on parsing error
                     setLoadingMessage('');
                     // REMOVED setParsingProgress(0); // Reset progress
                     setNeedsParsingTrigger(true); // Allow user to retry parsing if possible (e.g., re-select file)
                     // Unsubscribe after error? 
                     // supabase.removeChannel(channel);
                     // channelRef.current = null;
                 }
            }
          }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Realtime channel subscribed successfully for ${currentRequestId}`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                console.error('Realtime subscription error:', status, err);
                setError("Realtime connection issue. Status updates might be delayed. Please refresh if needed.");
                // Potentially stop loading/timer if connection fails critically?
                // setIsLoading(false); 
                // if (parsingTimerRef.current) clearInterval(parsingTimerRef.current);
            } else { 
                console.log(`Realtime channel status: ${status}`);
            }
        });

        channelRef.current = channel; // Store the channel

    } else {
         // If no request ID or process already completed/failed, remove listener
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
  // Dependencies: Resubscribe if request ID changes, or if payment status allows subscription again.
  }, [currentRequestId, paymentStatus]);


  // --- File Handling ---
  const handleFileChange = async (event) => {
     const selectedFile = event.target.files?.[0];
     if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        setFile(null);
        setFilePreviewUrl(null);
        setPageCount(0); // Reset page count
        return;
      }
      setFile(selectedFile);
      setError('');
      setParsedData(null);
      setNeedsParsingTrigger(false);
      setNowPaymentsUrl(''); // Reset payment URL if file changes
      setShowSimulateButton(false);
      setPageCount(0); // Reset page count initially

      // Don't reset paymentStatus automatically, user might have paid and wants to parse now
      if (paymentStatus !== '' && paymentStatus !== 'succeeded') { // Allow re-parse if already succeeded
         setPaymentStatus('');
         setCurrentRequestId(null); // Reset request ID for new file flow
      }

      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(previewUrl);

      // Get accurate page count using pdf-lib
      setIsLoading(true); // Show loading indicator while reading PDF
      setLoadingMessage('Reading PDF info...');
      let pages = 0; // Initialize pages
      try {
        const fileBuffer = await selectedFile.arrayBuffer();
        
        // First attempt: Try with standard options
        try {
          const pdfDoc = await PDFDocument.load(fileBuffer);
          pages = pdfDoc.getPageCount();
        } catch (pdfError) {
          console.log("First PDF reading attempt failed, trying with ignoreEncryption...");
          // Second attempt: Try with ignoreEncryption
          try {
            const pdfDoc = await PDFDocument.load(fileBuffer, {
              ignoreEncryption: true,
            });
            pages = pdfDoc.getPageCount();
          } catch (secondError) {
            console.log("Second PDF reading attempt failed, using fallback method...");
            // Fallback: Use a rough estimate based on file size
            // Average PDF page is about 50KB, but this is just a rough estimate
            const fileSizeInKB = selectedFile.size / 1024;
            pages = Math.max(1, Math.ceil(fileSizeInKB / 50));
            console.log(`Using fallback page count estimate: ${pages} pages`);
          }
        }

        setPageCount(pages);
        console.log(`PDF pages: ${pages}`);
        setError(''); // Clear any previous file errors

      } catch (error) {
        console.error("Error processing PDF:", error);
        setError(`Could not process PDF: ${error.message}. Please ensure it's a valid PDF file.`);
        // Reset file state if PDF is invalid
        setFile(null);
        setFilePreviewUrl(null);
        setPageCount(0);
        URL.revokeObjectURL(previewUrl); // Clean up preview URL
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    } else {
      // If user cancels file selection
      setFile(null);
      setFilePreviewUrl(null);
      setPageCount(0);
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl); // Clean up old preview if any
      }
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
    setLoadingMessage('Preparing payment invoice...'); // Updated message
    setPaymentStatus('pending_creation'); // New status
    setParsedData(null); // Clear any previous results before payment
    setShowSimulateButton(false);
    setNeedsParsingTrigger(false);
    setNowPaymentsUrl('');

    try {
      // Create initial request record with page count
      console.log(`Creating initial request record for file ${file.name} with ${pageCount} pages.`);
      const newRequestId = await createInitialRequestRecord(file, pageCount);
      if (!newRequestId) {
        throw new Error("Failed to create initial database record.");
      }
      setCurrentRequestId(newRequestId);
      console.log(`Created request record with ID: ${newRequestId}`);

      // --- Call Edge Function to create NowPayments Invoice ---
      const { data, error: functionError } = await supabase.functions.invoke(
          'create-nowpayments-invoice',
          { body: { requestId: newRequestId } } 
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
      if (!file || !currentRequestId || paymentStatus !== 'succeeded') {
          setError("Cannot start parsing. Ensure payment was successful and a file is selected.");
          return;
      }

      setIsLoading(true); // Start loading
      setLoadingMessage('Uploading file and preparing analysis...'); // Initial message
      setError('');
      setParsedData(null); // Clear previous results
      setNeedsParsingTrigger(false); // Parsing is being attempted

      // Clear previous timer if any
      if (timerId) {
          clearInterval(timerId);
          setTimerId(null);
      }
      setRemainingTime(0);
      setTotalDuration(0);

      try {
          // 1. Upload file to Supabase Storage
          const timestamp = Date.now();
          const filePath = `user_statements/${currentRequestId}_${timestamp}_${file.name}`;
          console.log(`Uploading to Supabase Storage: ${filePath}`);

          // store the path in the request record
          await updateRequestRecord(currentRequestId, {
            storage_path: filePath
          });

          const { error: uploadError } = await supabase
              .storage
              .from('statement-uploads') // *** YOUR BUCKET NAME ***
              .upload(filePath, file);

          if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
          console.log("File uploaded successfully to Storage.");

          console.log("Invoking parse-bank-statement function...");
          const { error: functionError } = await supabase.functions.invoke(
              'parse-bank-statement',
              { body: { requestId: currentRequestId, storagePath: filePath } }
          );

          // Handle IMMEDIATE invocation errors only
          if (functionError) {
            throw new Error(`Function invocation failed: ${functionError.message}. Check function logs.`);
          }
          
          console.log("Parse function invoked successfully. Waiting for Realtime status update...");

          // --- Start Countdown Timer ---
          const estimatedDurationMs = pageCount > 0 ? pageCount * 20 * 1000 : 3 * 60 * 1000; // Estimate 20 s/page, fallback 3 min
          setTotalDuration(estimatedDurationMs);
          setRemainingTime(estimatedDurationMs);

          const newTimerId = setInterval(() => {
              setRemainingTime(prevTime => {
                  const nextTime = prevTime - 1000;
                  if (nextTime <= 0) {
                      clearInterval(newTimerId); // Stop timer when it reaches zero
                      setTimerId(null); // Clear the timerId state
                      // Optionally update message: setLoadingMessage("Parsing taking longer than expected...");
                      return 0;
                  }
                  return nextTime;
              });
          }, 1000);
          setTimerId(newTimerId); // Store the new interval ID
          console.log(`Started parsing timer ${newTimerId} for ${estimatedDurationMs}ms`);
          // --- Timer End ---

          // Do NOT stop loading here. The Realtime listener will handle it.
          setIsLoading(true);
          // Update loading message - timer will be displayed separately
          setLoadingMessage(`Parsing in progress...`);

      } catch (err) {
          console.error('Error during parsing initiation:', err);
          setError(`Parsing failed: ${err.message}`);
          setIsLoading(false); // Stop loading on initiation error
          setLoadingMessage('');
          // Clear timer if initiation fails
          if (timerId) clearInterval(timerId);
          setTimerId(null);
          setRemainingTime(0);
          setTotalDuration(0);
          // Optionally update DB status to error here if initiation failed badly
          if (currentRequestId) {
              await updateRequestRecord(currentRequestId, {
                  parsing_status: 'error',
                  error_message: `Client-side parsing initiation failed: ${err.message}`
              });
          }
      } 
  };

  // --- Test File Handling ---
  const handleTestFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    // Revoke previous TEST URL if it exists FIRST
    if (testFilePreviewUrl) {
      console.log("Revoking previous TEST object URL:", testFilePreviewUrl);
      URL.revokeObjectURL(testFilePreviewUrl);
      setTestFilePreviewUrl(null); // Reset state immediately
      setTestPdfFileName(''); // Reset filename too
    }

    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Test file must be a PDF.');
        // testFilePreviewUrl and testPdfFileName already cleared above
        return;
      }
      // Clear normal flow data if switching to test mode
      setFile(null);
      // Revoke normal preview URL if it exists
      if (filePreviewUrl) {
          URL.revokeObjectURL(filePreviewUrl);
          setFilePreviewUrl(null);
      }
      setParsedData(null);
      setPaymentStatus('');
      setError('');

      const newPreviewUrl = URL.createObjectURL(selectedFile);
      console.log("Creating new TEST object URL:", newPreviewUrl);
      setTestFilePreviewUrl(newPreviewUrl);
      setTestPdfFileName(selectedFile.name);
      // !!! REMOVED the return cleanup function !!!
    } else {
        // Handle case where user cancels file selection
        // Previous URL already revoked at the start of the function
         setTestPdfFileName(''); // Ensure filename is cleared
    }
  };

  const handleTestJsonChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') {
        setError('Test data file must be a JSON file.');
        setTestJsonData(null);
        setTestJsonFileName('');
        return;
      }
       // Clear normal flow data if switching to test mode
      setFile(null);
      if (filePreviewUrl) {
          URL.revokeObjectURL(filePreviewUrl);
          setFilePreviewUrl(null);
      }
      setParsedData(null);
      setPaymentStatus('');
      setError('');

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          // Basic validation (check for expected top-level keys)
          if (json && json.meta_data && json.transactions_data) {
            setTestJsonData(json);
            setTestJsonFileName(selectedFile.name);
            setError(''); // Clear previous errors
          } else {
            throw new Error('Invalid JSON structure. Missing meta_data or transactions_data.');
          }
        } catch (parseError) {
          console.error("Error parsing test JSON:", parseError);
          setError(`Failed to parse test JSON: ${parseError.message}`);
          setTestJsonData(null);
          setTestJsonFileName('');
        }
      };
      reader.onerror = () => {
         console.error("Error reading test JSON file");
         setError("Error reading the selected JSON file.");
         setTestJsonData(null);
         setTestJsonFileName('');
      }
      reader.readAsText(selectedFile);
    }
  };

   // --- Reset Function ---
   const resetState = () => {
     // ... other resets ...
     setPaymentStatus('');
     setCurrentRequestId(null);
     setNeedsParsingTrigger(false);
     setNowPaymentsUrl('');
     setShowSimulateButton(false);

     // Clear timer if running during reset
     if (timerId) {
         console.log("Resetting: Clearing timer interval", timerId);
         clearInterval(timerId);
         setTimerId(null);
     }
     setRemainingTime(0); // Reset timer display state
     setTotalDuration(0);

     // Revoke previous object URLs if they exist
     if (filePreviewUrl) {
         console.log("Resetting: Revoking object URL", filePreviewUrl);
         URL.revokeObjectURL(filePreviewUrl);
     }
     if (testFilePreviewUrl) {
         console.log("Resetting: Revoking TEST object URL", testFilePreviewUrl);
         URL.revokeObjectURL(testFilePreviewUrl);
     }

     // Reset state AFTER revoking
     setFile(null);
     setFilePreviewUrl(null);
     setParsedData(null);
     setTestFilePreviewUrl(null);
     setTestJsonData(null);
     setTestPdfFileName('');
     setTestJsonFileName('');
     setIsLoading(false);
     setLoadingMessage('');
     setError('');
   };

  // Function to handle JSON download (Updated to handle test data)
  const handleDownloadJson = useCallback(() => {
    const dataToDownload = testJsonData || parsedData; // Prioritize test data if present
    const sourceFileName = testPdfFileName || file?.name; // Get name from test PDF or regular PDF

    if (!dataToDownload) {
        setError("No data available to download.");
        return;
    }

    try {
      const jsonString = JSON.stringify(dataToDownload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = sourceFileName
        ? `parsed_${sourceFileName.replace(/\.pdf$/i, '')}.json`
        : `parsed_data_${currentRequestId || 'test'}.json`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError(''); // Clear error on success
    } catch (error) {
      console.error("Error creating download link:", error);
      setError("Could not generate download link.");
    }
  }, [parsedData, testJsonData, file, testPdfFileName, currentRequestId]); // Added test data dependencies

  // Determine if we are showing results from test data or normal flow
  const showTestDataResults = !!(testFilePreviewUrl && testJsonData);
  const showNormalResults = !!(filePreviewUrl && parsedData);
  const previewUrlToShow = showTestDataResults ? testFilePreviewUrl : filePreviewUrl;
  const dataToShow = showTestDataResults ? testJsonData : parsedData;

  // Determine if we should show the placeholder preview
  const showPlaceholderPreview = !showNormalResults && filePreviewUrl && !showTestDataResults;
  const showTestPlaceholderPreview = !showTestDataResults && testFilePreviewUrl;

  // --- Render Logic ---
  return (
    <div className="container">
      <h1>Bank Statement Parser MVP</h1>
      <p>Upload PDF, pay securely with Crypto via NowPayments, get results.</p>
      {isDevelopment && <p className="warning-message"><strong>Development Mode Active:</strong> Payment simulation enabled.</p>}
      <p className="info-message">Note: Crypto payments require network confirmations and may take some time after you send funds.</p>

      {/* File Upload - Removed isLoading class */}
      <div className="upload-section">
         {paymentStatus !== 'succeeded' ? (
           <>
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
           </>
         ) : (
           <div className="locked-file">
             <p>✅ {file.name}</p>
           </div>
         )}
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
      {/* Add new success message for completed parsing */}
      {parsedData && !isLoading && !error && (
          <div className="success-message-container">
              <p className="success-message">✅ Parsing completed successfully!</p>
          </div>
      )}
      
      {/* Add loading message that includes the permanent link */}
      {isLoading && (parsingStatus === 'processing' || parsingStatus === 'success') && currentRequestId && (
        <div className="parsing-link-info">
          <p>While parsing continues, you can also <Link to={`/requests/${currentRequestId}`} target="_blank" rel="noopener noreferrer">view your request page</Link> to check the status.</p>
        </div>
      )}

      {/* Inline Loading Indicator Area */}
      {isLoading && (
          <div className="loading-message-container"> {/* New container class */}
              {/* Removed Progress Circle Logic */}
                <div className="spinner"></div>
              <p>{loadingMessage || 'Processing...'}</p>

              {/* Show progress bar and timer only during active parsing */}
              {loadingMessage.startsWith('Parsing in progress') && totalDuration > 0 && (
                <div className="progress-timer">
                  <progress max={totalDuration} value={totalDuration - remainingTime}></progress>
                  <p className="completion-time">
                      Estimated time remaining: {formatTime(remainingTime)}
                  </p>
                </div>
              )}

               {/* Simpler message for payment waiting */}
               {['waiting', 'confirming', 'confirmed', 'sending'].includes(paymentStatus) && !loadingMessage.startsWith('Parsing in progress') && (
                  <p className="completion-time">Waiting for payment confirmation...</p>
              )}
          </div>
      )}

      {/* ---- Test Upload Section ---- */}
      {isDevelopment && (
        <div className="test-upload-section">
          <h4>Quick Test Preview</h4>
          <p>Upload a PDF and its corresponding parsed JSON to preview the layout.</p>
          <div className="test-inputs">
            <label htmlFor="test-pdf-upload" className={`custom-file-upload ${isLoading ? 'disabled' : ''}`}>
              {testPdfFileName ? `Test PDF: ${testPdfFileName}` : 'Choose Test PDF'}
            </label>
            <input
              id="test-pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleTestFileChange}
              disabled={isLoading}
            />
            <label htmlFor="test-json-upload" className={`custom-file-upload ${isLoading ? 'disabled' : ''}`}>
              {testJsonFileName ? `Test JSON: ${testJsonFileName}` : 'Choose Test JSON'}
            </label>
            <input
              id="test-json-upload"
              type="file"
              accept="application/json,.json"
              onChange={handleTestJsonChange}
              disabled={isLoading}
            />
             {(testFilePreviewUrl || testJsonData) && (
                   <button onClick={resetState} className="cta-button reset-button" disabled={isLoading}>
                      Reset Test
                   </button>
              )}
          </div>
        </div>
      )}

      {/* Always render the results sections, regardless of data status. Use empty data when none exists. - Removed isLoading class */}
      <div className="results-section">
        <div className="results-header">
          <h2>Results {showTestDataResults ? '(Test Preview)' : ''}</h2>
          <div className="results-actions">
            {(showNormalResults || showTestDataResults) && (
              <button onClick={handleDownloadJson} className="cta-button download-button">
                Download JSON
              </button>
            )}
            {currentRequestId && showNormalResults && (
              <Link to={`/requests/${currentRequestId}`} className="cta-button view-button" target="_blank" rel="noopener noreferrer">
                View Page
              </Link>
            )}
          </div>
        </div>
        
        <div className="summary-section">
          {(showNormalResults || showTestDataResults) ? (
            <StatementSummary metaData={dataToShow.meta_data} />
          ) : (
            <div className="summary-container">
              <h3>Account Summary</h3>
              <div className="summary-grid">
                <div><strong>Bank:</strong></div>
                <div><strong>Customer:</strong></div>
                <div><strong>Account Number:</strong></div>
                <div><strong>Offset:</strong></div>
                <div><strong>Starting Statement Date:</strong></div>
                <div><strong>Ending Statement Date:</strong></div>
                <div><strong>Starting Balance:</strong></div>
                <div><strong>Ending Balance:</strong></div>
                <div><strong>Total Transactions:</strong></div>
                <div><strong>Credits:</strong></div>
                <div><strong>Debits:</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="results-content">
          <div className="pdf-column">
            {previewUrlToShow ? (
              <iframe
                src={previewUrlToShow}
                width="100%"
                height="800px"
                title="PDF Preview"
              />
            ) : (
              <div className="empty-preview">
                <p>PDF preview will appear here after uploading</p>
              </div>
            )}
          </div>
          <div className="right-column">
            <div className="transactions-column">
              <TransactionsTable 
                transactions={(showNormalResults || showTestDataResults) ? dataToShow.transactions_data : []} 
              />
            </div>
            <div className="balances-section">
              <BalancesTable 
                balances={(showNormalResults || showTestDataResults) ? dataToShow.balances : []} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
