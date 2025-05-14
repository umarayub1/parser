// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux'; // Import Redux hooks
import { supabase } from './supabaseClient';
import apiClient from './services/api'; // Import the API client
import { Link, useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import RequestsHistoryTable from './components/RequestsHistoryTable'; // <<< Import History Table
import UserCredits from './components/UserCredits'; // Import UserCredits component
import RequestPage from './components/RequestPage'; // Import RequestPage component
import DownloadDataButton from './components/DownloadDataButton'; // Import our new component
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
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ApiDocsPage from './pages/ApiDocsPage'; // Add import for API Docs page
import ApiExamplesPage from './pages/ApiExamplesPage'; // Add import for API Examples page
import LandingPage from './pages/LandingPage'; // Import the new LandingPage component

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
  const fetchHistory = useCallback(async () => {
    if (!user?.id) {
      setRequestsHistory([]); // Clear history if user logs out
      return;
    }

    console.log("Fetching request history for user:", user.id);
    setHistoryLoading(true);
    setHistoryError(''); // Clear previous errors
    try {
      const { success, data, error } = await apiClient.getRequests();

      if (!success || error) throw new Error(error || 'Failed to fetch requests');

      console.log("Fetched history:", data);
      setRequestsHistory(data || []);
    } catch (err) {
      console.error("Error fetching request history:", err);
      setHistoryError(`Failed to load history: ${err.message}`);
      setRequestsHistory([]); // Clear history on error
    } finally {
      setHistoryLoading(false);
    }
  }, [user]); // Re-fetch when user object changes (login/logout)

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]); // Use the callback in the dependency array

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
      };

      console.log("Inserting request data:", insertData);

      const { success, data, error } = await apiClient.createRequest(insertData);

      if (!success || error) throw new Error(error || 'Failed to create request');
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
    if (!requestId) {
        console.error("Cannot update record without a request ID.");
        console.error("Update failed: Missing request ID.");
        return;
    }
    try {
        console.log(`Updating request ${requestId} with:`, updateData);
        const { success, error } = await apiClient.updateRequest(requestId, updateData);

        if (!success || error) throw new Error(error || 'Failed to update request');
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
    if (!file || !pageCount) {
      setError("Please select a PDF file and upload it first.");
      setShowSimulateButton(false);
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Initializing payment...');
    setError('');
    setParsedData(null);
    setPaymentStatus('pending_creation');
    setParsingStatus('');
    setNowPaymentsUrl('');
    setShowSimulateButton(false);

    try {
      // 1. Create initial request record
      const newRequestId = await createInitialRequestRecord(file, pageCount);
      if (!newRequestId) {
        throw new Error("Failed to create initial request record. Database error.");
      }
      
      setCurrentRequestId(newRequestId);
      console.log(`Created request record with ID: ${newRequestId}`);

      // --- Call Edge Function to create NowPayments Invoice ---
      const { success, data, error } = await apiClient.invokeFunction(
          'create-nowpayments-invoice',
          { requestId: newRequestId }
      );

      if (!success || error) throw new Error(`Function error: ${error}`);
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
        const { success, data, error } = await apiClient.invokeFunction(
            'simulate-payment-success',
            { requestId: currentRequestId }
        );

        if (!success || error) throw new Error(`Function error: ${error}`);
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
          // 1. Upload file to storage via the backend API
          console.log(`Uploading file via API: ${file.name}`);
          
          const { success: uploadSuccess, data: uploadData, error: uploadError } = await apiClient.uploadFile(file, currentRequestId);
          
          if (!uploadSuccess || uploadError) {
            throw new Error(`File upload failed: ${uploadError}`);
          }
          
          console.log("File uploaded successfully to Storage.");
          const { storagePath } = uploadData;
          
          // 2. Invoke parse function via the backend API
          console.log("Invoking parse-bank-statement function...");
          const { success: parseSuccess, error: parseError } = await apiClient.invokeFunction(
              'parse-bank-statement',
              { requestId: currentRequestId, storagePath }
          );

          // Handle IMMEDIATE invocation errors only
          if (!parseSuccess || parseError) {
            throw new Error(`Function invocation failed: ${parseError}. Check function logs.`);
          }
          
          console.log("Parse function invoked successfully. Waiting for Realtime status update...");

          // --- Fetch created_at time for accurate timer ---
          const { success: fetchSuccess, data: requestDetails, error: fetchError } = await apiClient.getRequestById(currentRequestId);

          if (!fetchSuccess || fetchError || !requestDetails) {
              console.warn("Could not fetch created_at for timer, using fallback.", fetchError);
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
      } catch (err) {
          console.error('Parsing initiation error:', err);
          setError(`Parsing error: ${err.message}`);
          setIsLoading(false);
          setLoadingMessage('');
          setParsingStatus('error'); // Update UI state
          
          // Update the record status
          await updateRequestRecord(currentRequestId, { 
              parsing_status: 'error', 
              error_message: `Failed to start parsing: ${err.message}` 
          });
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
  // This function has been replaced by the DownloadDataButton component
  // and is maintained here only for backward compatibility or direct programmatic calls
  const handleDownloadJson = useCallback(() => {
    const dataToDownload = testJsonData || parsedData; // Prioritize test data if present
    const sourceFileName = testPdfFileName || file?.name; // Get name from test PDF or regular PDF

    if (!dataToDownload) {
        setError("No data available to download.");
        return;
    }

    try {
      // We'll use the DownloadDataButton component approach but call it programmatically
      // Transform data to match the new schema requirements
      const transformedData = {
        meta_data: dataToDownload.meta_data || {},
        balances: dataToDownload.balances || [],
        transactions_data: dataToDownload.transactions_data || []
      };
      
      const jsonString = JSON.stringify(transformedData, null, 2);
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

  // For any UI element requiring download functionality, replace with:
  // <DownloadDataButton 
  //   data={dataToShow}
  //   filename={sourceFileName ? 
  //     `parsed_${sourceFileName.replace(/\.pdf$/i, '')}` : 
  //     `parsed_data_${currentRequestId || 'test'}`}
  //   onError={setError}
  // />

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
    if (path === '/history') {
      return location.pathname === '/history';
    }
    if (path === '/top-up') {
      return location.pathname === '/top-up';
    }
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    if (path === '/contact') {
      return location.pathname === '/contact';
    }
    if (path === '/login') {
      return location.pathname === '/login';
    }
    if (path === '/signup') {
      return location.pathname === '/signup';
    }
    if (path === '/api-docs') {
      return location.pathname === '/api-docs';
    }
    return location.pathname.startsWith(path);
  };

  // Add state for mobile navigation
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Toggle mobile navigation
  const toggleMobileNav = () => {
    setMobileNavOpen(!mobileNavOpen);
    // When opening menu, also prevent body scrolling and add menu-open class
    document.body.style.overflow = !mobileNavOpen ? 'hidden' : '';
    
    if (!mobileNavOpen) {
      document.body.classList.add('menu-open');
      document.documentElement.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
      document.documentElement.classList.remove('menu-open');
    }
  };
  
  // Close mobile nav when route changes
  useEffect(() => {
    setMobileNavOpen(false);
    document.body.style.overflow = '';
    document.body.classList.remove('menu-open');
    document.documentElement.classList.remove('menu-open');
  }, [location.pathname]);

  // Create PrivateRoute component for protected routes
  const PrivateRoute = ({ children }) => {
    const session = useSelector(selectSession);
    const location = useLocation();
    
    if (!session) {
      // Redirect to login if not authenticated, saving the intended destination
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    return children;
  };

  // --- Render Logic (Dashboard View) ---
  return (
    <div className="main-layout">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <Link to="/" className="logo-link">
              <img src="/logo.png" alt="Logo" className="header-logo" />
              <h1>Bank Parser</h1>
            </Link>
          </div>
          
          <div className="header-controls">
            {user && (
              <div className="nav-links">
                <Link to="/new-request" className={`nav-link ${isActive('/new-request') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span className="nav-text">New Request</span>
                </Link>
                <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span className="nav-text">History</span>
                </Link>
                <Link to="/top-up" className={`nav-link ${isActive('/top-up') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <span className="nav-text">Top Up</span>
                </Link>
                <Link to="/api-docs" className={`nav-link ${isActive('/api-docs') || isActive('/api-examples') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span className="nav-text">API</span>
                </Link>
                <Link to="/contact" className={`nav-link ${isActive('/contact') ? 'active' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  <span className="nav-text">Contact</span>
                </Link>
              </div>
            )}
            
            {/* Add hamburger menu for mobile */}
            <div 
              className={`hamburger-menu ${mobileNavOpen ? 'active' : ''}`} 
              onClick={toggleMobileNav}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </div>

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
                  <Link to="/login" className="auth-button login">
                    Log In
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <div 
        className={`mobile-nav-overlay ${mobileNavOpen ? 'active' : ''}`} 
        onClick={toggleMobileNav}
      ></div>
      
      <div className={`mobile-nav ${mobileNavOpen ? 'active' : ''}`}>
        <div className="mobile-nav-header">
          <h3>Menu</h3>
          <button className="mobile-nav-close" onClick={toggleMobileNav}>&times;</button>
        </div>
        
        {/* Add credits display in mobile menu when user is logged in */}
        {user && (
          <div className="mobile-credits-display">
            <UserCredits />
          </div>
        )}
        
        <div className="mobile-nav-links">
          <Link to="/new-request" className={`mobile-nav-link ${isActive('/new-request') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Request
          </Link>
          
          <Link to="/history" className={`mobile-nav-link ${isActive('/history') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            History
          </Link>
          
          <Link to="/top-up" className={`mobile-nav-link ${isActive('/top-up') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Top Up
          </Link>
          
          <Link to="/api-docs" className={`mobile-nav-link ${isActive('/api-docs') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            API
          </Link>
          
          <Link to="/contact" className={`mobile-nav-link ${isActive('/contact') ? 'active' : ''}`} onClick={toggleMobileNav}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            Contact
          </Link>
        </div>
        
        {/* Mobile user info and auth */}
        {user ? (
          <div className="mobile-user-info">
            <div className="mobile-user-avatar">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="User Avatar" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
            
            <div className="mobile-user-details">
              <div>{user.email}</div>
              <button className="auth-button sign-out" onClick={handleSignOut}>Sign Out</button>
            </div>
          </div>
        ) : (
          <div className="mobile-auth-buttons">
            <Link 
              to="/login" 
              className="auth-button login" 
              onClick={toggleMobileNav}
            >
              Log In
            </Link>
          </div>
        )}
      </div>
      
      <main className="content-container">
        {!user ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        ) : (
          <Routes>
            <Route 
              path="/" 
              element={<NewRequestPage />} 
            />
            <Route 
              path="/history" 
              element={
                <div className="dashboard-container">
                  <div className="history-section">
                    {historyError && <div className="error-message">{historyError}</div>}
                    <RequestsHistoryTable 
                      requests={requestsHistory} 
                      isLoading={historyLoading} 
                      onRequestUpdate={fetchHistory}
                    />
                  </div>
                </div>
              } 
            />
            <Route path="/new-request" element={<NewRequestPage />} />
            <Route path="/top-up" element={<CryptoTopUpPage />} />
            <Route path="/requests/:id" element={<RequestPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/api-examples" element={<ApiExamplesPage />} />
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
