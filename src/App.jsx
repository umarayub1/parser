// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux'; // Import Redux hooks
import { supabase } from './supabaseClient';
import { Link, useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import './App.css';
import RequestsHistoryTable from './components/RequestsHistoryTable'; // <<< Import History Table
import UserCredits from './components/UserCredits'; // Import UserCredits component
import RequestPage from './components/RequestPage'; // Import RequestPage component
// Import Redux actions and selectors
import {
  setSession,
  // clearSession, // We might let the listener handle clearing via setSession(null)
  getSessionThunk,
  signInWithOAuthThunk,
  signOutThunk,
  selectSession, // Import selector
  selectUser, // <<< Add selectUser import
  selectAuthLoading,
  selectAuthError
} from './store/authSlice'; // Adjust path as necessary

// Import pages
import NewRequestPage from './pages/NewRequestPage';
import CryptoTopUpPage from './pages/CryptoTopUpPage';
import ProfilePage from './pages/ProfilePage';

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
  const [createdAtTime, setCreatedAtTime] = useState(null); // <<< Add state for creation time
  const [now, setNow] = useState(() => Date.now()); // <<< Add state for current time, init once
  const [totalDuration, setTotalDuration] = useState(0); // Total duration in ms

  // --- State for Test Upload ---
  const [testFilePreviewUrl, setTestFilePreviewUrl] = useState(null);
  const [testJsonData, setTestJsonData] = useState(null);
  const [testPdfFileName, setTestPdfFileName] = useState(''); // To show selected filename
  const [testJsonFileName, setTestJsonFileName] = useState(''); // To show selected filename

  // Ref to store the realtime channel
  const channelRef = useRef(null);

  // --- Redux State ---
  const dispatch = useDispatch();
  const session = useSelector(selectSession); // Get session from Redux store
  const user = useSelector(selectUser); // <<< Get user object from Redux store
  const authLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError); // Get auth-specific error

  // --- State for Request History ---
  const [requestsHistory, setRequestsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(''); // Separate error for history fetching

  const navigate = useNavigate(); // <<< Initialize navigate
  const location = useLocation();

  // --- Auth State (from Redux) ---
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  
  // Add click outside listener to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownOpen && !event.target.closest('.profile-dropdown-container')) {
        setProfileDropdownOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // --- Auth Listener -> Dispatch to Redux ---
  useEffect(() => {
    dispatch(getSessionThunk());
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Supabase auth event -> dispatching setSession:", _event, session);
        dispatch(setSession(session));
      }
    );
    return () => {
      if (authListener?.subscription) {
        console.log("Unsubscribing from auth listener");
        authListener.subscription.unsubscribe();
      }
    };
  }, [dispatch]);

  // --- Display Auth Error (from Redux) ---
  useEffect(() => {
    if (authError) {
      // Use the historyError state or display directly
      console.error(`Authentication Error: ${authError}`);
      // You might want a dedicated UI element for auth errors vs history errors
    }
  }, [authError]);

  // --- Fetch Request History when user logs in ---
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) {
        setRequestsHistory([]); // Clear history if user logs out
        return;
      }

      console.log("Fetching request history for user:", user.id);
      setHistoryLoading(true);
      setHistoryError(''); // Clear previous errors
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, created_at, file_name, page_count, parsing_status') // Select necessary columns
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }); // Show newest first

        if (error) throw error;

        console.log("Fetched history:", data);
        setRequestsHistory(data || []);
      } catch (err) {
        console.error("Error fetching request history:", err);
        setHistoryError(`Failed to load history: ${err.message}`);
        setRequestsHistory([]); // Clear history on error
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();

    // Optional: Set up a realtime subscription to the requests table for the user?
    // This could update the table automatically when a request's status changes.
    // Consider performance implications if the user has many requests.

  }, [user]); // Re-fetch when user object changes (login/logout)

  // --- Configuration Check & Unmount Cleanup ---
  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL ||
        !import.meta.env.VITE_SUPABASE_ANON_KEY ||
        !import.meta.env.VITE_APP_BASE_URL) {
       setError("Critical configuration missing in .env file.");
       console.error("ERROR: Missing environment variables!");
    }
    
    // Set up a global click listener to verify click events are working
    const handleDocumentClick = (e) => {
      console.log('Document click event registered at:', e.target);
    };
    
    document.addEventListener('click', handleDocumentClick);
    
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
      
      // Remove click listener
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

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
  const createInitialRequestRecord = useCallback(async (uploadedFile, pageCount) => {
    try {
      // Prepare data, including user_id if available
      const insertData = {
        file_name: uploadedFile.name,
        file_size: uploadedFile.size,
        page_count: pageCount,
        payment_status: 'pending',
        parsing_status: 'pending',
        user_id: user?.id || null, // <<< Add user ID here if user exists
      };

      console.log("Inserting request data:", insertData);

      const { data, error: dbError } = await supabase
        .from('requests')
        .insert(insertData)
        .select('id')
        .single();

      if (dbError) throw dbError;
      if (!data || !data.id) throw new Error("Failed to create request record or retrieve its ID.");

      console.log('Initial request record created with ID:', data.id, 'for user:', user?.id);
      return data.id;
    } catch (err) {
      console.error('Error creating initial request record:', err);
      // Use local setError for UI feedback
      setError(`Database error: ${err.message}. Could not initiate request.`);
      return null;
    }
  }, [user]); // <<< Added user dependency

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
                 // Only update parsingStatus if it's not empty (prevents resetting our local state)
                 if (currentParsingStatus && currentParsingStatus !== '') {
                     setParsingStatus(currentParsingStatus);
                 }
                 // Clear timer and reset related state when parsing finishes or errors
                 const clearTimer = () => {
                    if (timerId) {
                        console.log("Clearing timer interval due to parsing status:", timerId);
                        clearInterval(timerId);
                        setTimerId(null);
                    }
                    setCreatedAtTime(null);
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
      setCreatedAtTime(null);
      setTotalDuration(0);

      try {
          // 1. Upload file to Supabase Storage
          const timestamp = Date.now();
          const filePath = `user_statements/${currentRequestId}_${timestamp}_${file.name}`;
          console.log(`Uploading to Supabase Storage: ${filePath}`);

          // store the path in the request record
          await updateRequestRecord(currentRequestId, {
            storage_path: filePath,
            parsing_status: 'initiated' // Add this to indicate parsing has started
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

          // --- Fetch created_at time for accurate timer ---
          const { data: requestDetails, error: fetchError } = await supabase
            .from('requests')
            .select('created_at')
            .eq('id', currentRequestId)
            .single();

          if (fetchError || !requestDetails) {
              console.warn("Could not fetch created_at for timer, using fallback.", fetchError?.message);
              setCreatedAtTime(Date.now()); // Fallback to current time if fetch fails
          } else {
              setCreatedAtTime(new Date(requestDetails.created_at).getTime());
          }
          // --- End Fetch created_at ---


          // --- Start Countdown Timer (using 'now' state) ---
          const estimatedDurationMs = pageCount > 0 ? pageCount * 20 * 1000 : 3 * 60 * 1000; // Estimate 20 s/page, fallback 3 min
          setTotalDuration(estimatedDurationMs);

          // Start interval to update 'now' state every second
          const newTimerId = setInterval(() => {
              setNow(Date.now());
          }, 1000);
          setTimerId(newTimerId); // Store the new interval ID
          console.log(`Started 'now' update timer ${newTimerId} for request ${currentRequestId}`);

          // CRITICAL: Ensure loading state stays active during the entire parsing process
          setIsLoading(true);
          // Update loading message - timer will be displayed separately
          setLoadingMessage(`Parsing in progress...`);
          // Update parsingStatus to ensure UI reflects active parsing
          setParsingStatus('processing');

      } catch (err) {
          console.error('Error during parsing initiation:', err);
          setError(`Parsing failed: ${err.message}`);
          setIsLoading(false); // Stop loading on initiation error
          setLoadingMessage('');
          // Clear timer if initiation fails
          if (timerId) clearInterval(timerId);
          setTimerId(null);
          setCreatedAtTime(null);
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
     setCreatedAtTime(null);
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

  // --- OAuth Sign In Handler -> Dispatch Thunk ---
  const handleOAuthSignIn = async (provider) => {
    console.log(`Sign in button clicked for ${provider}...`);
    setError(''); // Clear local error UI
    try {
      console.log(`Dispatching signInWithOAuthThunk for ${provider}...`);
      // Dispatch the async thunk - error/loading handled by slice/selectors
      await dispatch(signInWithOAuthThunk({ provider }));
      console.log(`OAuth sign-in thunk dispatched successfully for ${provider}`);
    } catch (err) {
      console.error(`Error during OAuth sign-in dispatch: ${err.message}`);
      setError(`Authentication error: ${err.message}`);
    }
  };

  // --- Sign Out Handler -> Dispatch Thunk ---
  const handleSignOut = async () => {
    console.log("Sign out button clicked...");
    setError(''); // Clear local error UI
    try {
      console.log("Dispatching signOutThunk...");
      // Dispatch the async thunk
      await dispatch(signOutThunk());
      console.log("Sign out thunk dispatched successfully");
      // Reset local app state if needed AFTER sign out is confirmed (listener will update session)
      resetState(); // Keep resetting local state
    } catch (err) {
      console.error(`Error during sign-out dispatch: ${err.message}`);
      setError(`Sign out error: ${err.message}`);
    }
  };

  // --- New Request Navigation ---
  const handleCreateNewRequest = () => {
    navigate('/new-request'); // Navigate to the new route
  };

  // Determine active link
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/new-request') {
      return location.pathname === '/new-request';
    }
    if (path === '/top-up') {
      return location.pathname === '/top-up';
    }
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    return location.pathname.startsWith(path);
  };

  // --- Render Logic (Dashboard View) ---
  return (
    <div className="main-layout">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <Link to="/" className="logo-link">
              <h1>Bank Parser</h1>
            </Link>
          </div>
          
          <div className="header-controls">
            {user && (
              <div className="nav-links">
                <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span className="nav-text">Dashboard</span>
                </Link>
                <Link to="/new-request" className={`nav-link ${isActive('/new-request') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span className="nav-text">New Request</span>
                </Link>
                <Link to="/top-up" className={`nav-link ${isActive('/top-up') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <span className="nav-text">Top Up</span>
                </Link>
              </div>
            )}
            
            <div className="auth-section">
              {user ? (
                <div className="user-info">
                  <UserCredits />
                  <div className="profile-dropdown-container">
                    <div 
                      className="profile-dropdown-trigger"
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    >
                      {user.user_metadata?.avatar_url ? (
                        <img 
                          src={user.user_metadata.avatar_url} 
                          alt="Profile" 
                          className="user-avatar" 
                        />
                      ) : (
                        <div className="user-avatar-placeholder">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    {profileDropdownOpen && (
                      <div className="profile-dropdown-menu">
                        <div className="dropdown-user-info">
                          {user.user_metadata?.avatar_url && (
                            <img 
                              src={user.user_metadata.avatar_url} 
                              alt="Profile" 
                              className="dropdown-user-avatar" 
                            />
                          )}
                          <div className="dropdown-user-details">
                            <span className="dropdown-user-name">
                              {user.user_metadata?.full_name || user.email?.split('@')[0]}
                            </span>
                            <span className="dropdown-user-email">{user.email}</span>
                          </div>
                        </div>
                        <div className="dropdown-divider"></div>
                        <Link 
                          to="/profile"
                          className="dropdown-item profile-item"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          My Profile
                        </Link>
                        <div className="dropdown-divider"></div>
                        <button 
                          className="dropdown-item sign-out-item" 
                          onClick={(e) => {
                            e.preventDefault();
                            handleSignOut();
                            setProfileDropdownOpen(false);
                          }} 
                          disabled={authLoading === 'pending'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="auth-buttons">
                  <button 
                    className="auth-button google" 
                    onClick={(e) => {
                      e.preventDefault();
                      console.log("Welcome page Google sign-in button clicked directly");
                      handleOAuthSignIn('google');
                    }}
                    disabled={authLoading === 'pending'}
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-logo" />
                    Sign in with Google
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="content-container">
        {!user ? (
          <div className="welcome-section">
            <div className="welcome-content">
              <h2>Welcome to Bank Statement Parser</h2>
              <p>Sign in to process your bank statements and extract valuable data.</p>
            </div>
            <div className="welcome-features">
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3>Transaction Analysis</h3>
                <p>Extract and categorize all transactions from your bank statements automatically.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Secure Processing</h3>
                <p>Your data is processed securely and not stored longer than necessary.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>Easy Access</h3>
                <p>Access your parsed statements from any device with an internet connection.</p>
              </div>
            </div>
          </div>
        ) : (
          <Routes>
            <Route 
              path="/" 
              element={
                <div className="dashboard-container">
                  
                  <div className="history-section">
                    {historyError && <div className="error-message">{historyError}</div>}
                    <RequestsHistoryTable 
                      requests={requestsHistory} 
                      isLoading={historyLoading} 
                    />
                  </div>
                </div>
              } 
            />
            <Route path="/new-request" element={<NewRequestPage />} />
            <Route path="/top-up" element={<CryptoTopUpPage />} />
            <Route path="/requests/:id" element={<RequestPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        )}
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} Bank Statement Parser</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
