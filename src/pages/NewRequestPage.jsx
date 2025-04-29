import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PDFDocument } from 'pdf-lib'; // Import pdf-lib

// Import necessary components
import StatementSummary from '../components/StatementSummary';
import TransactionsTable from '../components/TransactionsTable';
import BalancesTable from '../components/BalancesTable';
// import PdfPreview from '../components/PdfPreview'; // Using iframe directly for now

// Import Redux selectors/actions if needed (currently only uses user)
import { selectUser } from '../store/authSlice';

// Import styles (using App.css for now, consider dedicated CSS)
import '../App.css';

const isDevelopment = import.meta.env.VITE_APP_MODE === 'development';

// Helper function to format time
function formatTime(ms) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}


function NewRequestPage() {
  const navigate = useNavigate();
  // const dispatch = useDispatch(); // Not currently used directly for request logic
  const user = useSelector(selectUser); // Get user from Redux

  // --- State from original App.jsx ---
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(''); // pending_creation, waiting, confirming, succeeded, failed, expired, canceled
  const [parsingStatus, setParsingStatus] = useState(''); // pending, initiated, processing, success, error
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [needsParsingTrigger, setNeedsParsingTrigger] = useState(false);
  const [nowPaymentsUrl, setNowPaymentsUrl] = useState('');
  const [showSimulateButton, setShowSimulateButton] = useState(false);

  const [pageCount, setPageCount] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [createdAtTime, setCreatedAtTime] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [totalDuration, setTotalDuration] = useState(0);

  // --- Test State (kept from original for consistency) ---
  const [testFilePreviewUrl, setTestFilePreviewUrl] = useState(null);
  const [testJsonData, setTestJsonData] = useState(null);
  const [testPdfFileName, setTestPdfFileName] = useState('');
  const [testJsonFileName, setTestJsonFileName] = useState('');

  // Ref to store the realtime channel
  const channelRef = useRef(null);


  // --- Functions moved from App.jsx ---

  const calculateRemainingTime = useCallback(() => {
      if (!createdAtTime || !pageCount || pageCount <= 0) return null;
      const estimatedDurationMs = pageCount * 20 * 1000; // 20s/page
      const elapsedTime = now - createdAtTime;
      const remainingMs = Math.max(0, estimatedDurationMs - elapsedTime);
      const completionTime = new Date(createdAtTime + estimatedDurationMs);
      return {
          remainingFormatted: formatTime(remainingMs),
          completionTimeFormatted: completionTime.toLocaleTimeString(),
          estimatedDurationMinutes: Math.ceil(estimatedDurationMs / 60000)
      };
  }, [createdAtTime, pageCount, now]);


  // --- Database Interaction ---
  const createInitialRequestRecord = useCallback(async (uploadedFile, pageCount) => {
    // If user is not logged in, prevent creation (UI should ideally prevent this call)
    if (!user?.id) {
        setError("You must be signed in to create a request.");
        return null;
    }
    try {
      const insertData = {
        file_name: uploadedFile.name,
        file_size: uploadedFile.size,
        page_count: pageCount,
        payment_status: 'pending',
        parsing_status: 'pending',
        user_id: user.id, // Use user ID from Redux
      };
      console.log("Inserting request data:", insertData);
      const { data, error: dbError } = await supabase
        .from('requests')
        .insert(insertData)
        .select('id')
        .single();
      if (dbError) throw dbError;
      if (!data || !data.id) throw new Error("Failed to create request record or retrieve its ID.");
      console.log('Initial request record created with ID:', data.id, 'for user:', user.id);
      return data.id;
    } catch (err) {
      console.error('Error creating initial request record:', err);
      setError(`Database error: ${err.message}. Could not initiate request.`);
      return null;
    }
  }, [user]); // Dependency on user

  const updateRequestRecord = useCallback(async (requestId, updateData) => {
     if (!requestId) {
        console.error("Cannot update record without a request ID.");
        setError("Update failed: Missing request ID."); // Show error in UI
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
        setError(`Database update error: ${err.message}`); // Show error in UI
    }
  }, []);


  // --- Supabase Realtime Subscription ---
  useEffect(() => {
    if (currentRequestId && !['failed', 'expired', 'canceled', 'refunded'].includes(paymentStatus)) {
      console.log(`Subscribing to Realtime updates for request ID: ${currentRequestId}`);
      if (channelRef.current) {
          console.log("Removing previous Realtime channel before creating new one.");
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      }
      const channel = supabase
        .channel(`request-status:${currentRequestId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${currentRequestId}` },
          (payload) => {
            console.log('Realtime UPDATE received:', payload);
            const updatedRequest = payload.new;
            if (updatedRequest) {
                 const currentPaymentStatus = updatedRequest.payment_status || '';
                 setPaymentStatus(currentPaymentStatus);

                 if (currentPaymentStatus === 'succeeded' && updatedRequest.parsing_status === 'pending') {
                    console.log("Payment SUCCEEDED via Realtime update!");
                    setError('');
                    // Trigger parsing automatically or show button? Let's show button for now.
                    if (!needsParsingTrigger) {
                        setNeedsParsingTrigger(true);
                    }
                    setIsLoading(false);
                    setLoadingMessage('');
                    setNowPaymentsUrl('');
                 } else if (['failed', 'expired', 'canceled', 'refunded', 'partially_paid'].includes(currentPaymentStatus)) {
                     console.log(`Payment ended with status: ${currentPaymentStatus}`);
                     setError(`Payment status: ${currentPaymentStatus}. ${updatedRequest.error_message || ''}`);
                     setNeedsParsingTrigger(false);
                     setIsLoading(false);
                     setLoadingMessage('');
                     // Stop timer if running
                     if (timerId) clearInterval(timerId); setTimerId(null); setCreatedAtTime(null); setTotalDuration(0);
                 } else if (['waiting', 'confirming', 'confirmed', 'sending'].includes(currentPaymentStatus)) {
                     setIsLoading(true);
                     setLoadingMessage(`Payment status: ${currentPaymentStatus}...`);
                     setNeedsParsingTrigger(false);
                 }

                 const currentParsingStatus = updatedRequest.parsing_status;
                 if (currentParsingStatus && currentParsingStatus !== '') {
                     setParsingStatus(currentParsingStatus);
                 }

                 const clearTimer = () => {
                    if (timerId) { clearInterval(timerId); setTimerId(null); }
                    setCreatedAtTime(null); setTotalDuration(0);
                 }

                 if (currentParsingStatus === 'success') {
                     console.log("Realtime: Parsing completed, received data from DB");
                     clearTimer();
                     try {
                       if (!updatedRequest.parsed_data) throw new Error("Parsing completed but no data received.");
                       const receivedData = typeof updatedRequest.parsed_data === 'string'
                         ? JSON.parse(updatedRequest.parsed_data)
                         : updatedRequest.parsed_data;
                       if (!receivedData?.meta_data || !receivedData?.transactions_data) throw new Error("Received data is missing expected structure.");
                       setParsedData(receivedData);
                       setIsLoading(false);
                       setLoadingMessage('Parsing Complete!');
                       setError('');
                       console.log("Successfully updated parsed data from DB");
                     } catch (err) {
                       console.error("Error processing parsed data from DB:", err);
                       setError(`Error displaying results: ${err.message}`);
                       setIsLoading(false);
                       setLoadingMessage('');
                     }
                 } else if (currentParsingStatus === 'error') {
                     console.log("Realtime: Parsing error reported from server");
                     setError(`Parsing error: ${updatedRequest.error_message || 'Unknown processing error'}`);
                     clearTimer();
                     setIsLoading(false);
                     setLoadingMessage('');
                     setNeedsParsingTrigger(true); // Allow retry? Or reset?
                 } else if (currentParsingStatus === 'processing' || currentParsingStatus === 'initiated') {
                     // Keep loading state while processing
                     setIsLoading(true);
                     setLoadingMessage('Parsing in progress...');
                     // Timer logic should be handled by triggerParsing initiation
                 }
            }
          }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') console.log(`Realtime channel subscribed successfully for ${currentRequestId}`);
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) console.error('Realtime subscription error:', status, err);
            else console.log(`Realtime channel status: ${status}`);
        });
        channelRef.current = channel;
    } else {
         if (channelRef.current) {
            console.log("Removing Realtime channel (no active request or final state).");
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
         }
    }
    return () => { // Cleanup on unmount or dependency change
      if (channelRef.current) {
        console.log("Cleaning up Realtime channel on effect cleanup.");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentRequestId, paymentStatus]); // Dependencies


  // --- File Handling ---
  const handleFileChange = async (event) => {
     const selectedFile = event.target.files?.[0];

     // Revoke previous URL FIRST
     if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
        setFilePreviewUrl(null);
     }
     // Reset test data if a normal file is selected
     if (testFilePreviewUrl) {
         URL.revokeObjectURL(testFilePreviewUrl);
         setTestFilePreviewUrl(null);
         setTestJsonData(null);
         setTestPdfFileName('');
         setTestJsonFileName('');
     }

     if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        setFile(null); setPageCount(0); return;
      }
      setFile(selectedFile);
      setError(''); setParsedData(null); setNeedsParsingTrigger(false); setNowPaymentsUrl(''); setShowSimulateButton(false);
      setPageCount(0);

      // Reset request/payment if not already succeeded
      if (paymentStatus !== '' && paymentStatus !== 'succeeded') {
         setPaymentStatus(''); setCurrentRequestId(null);
      }

      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(previewUrl);

      setIsLoading(true); setLoadingMessage('Reading PDF info...');
      let pages = 0;
      try {
        const fileBuffer = await selectedFile.arrayBuffer();
        try { // Try standard load
          const pdfDoc = await PDFDocument.load(fileBuffer); pages = pdfDoc.getPageCount();
        } catch (pdfError) {
          console.log("PDF load failed, trying ignoreEncryption...");
          try { // Try with ignoreEncryption
            const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true }); pages = pdfDoc.getPageCount();
          } catch (secondError) {
            console.log("Second PDF load failed, using fallback...");
            const fileSizeInKB = selectedFile.size / 1024; pages = Math.max(1, Math.ceil(fileSizeInKB / 50));
            console.log(`Using fallback page count estimate: ${pages} pages`);
          }
        }
        setPageCount(pages); console.log(`PDF pages: ${pages}`); setError('');
      } catch (error) {
        console.error("Error processing PDF:", error);
        setError(`Could not process PDF: ${error.message}. Ensure it's valid.`);
        setFile(null); setFilePreviewUrl(null); setPageCount(0);
        URL.revokeObjectURL(previewUrl); // Clean up failed preview
      } finally {
        setIsLoading(false); setLoadingMessage('');
      }
    } else { // No file selected
      setFile(null); setPageCount(0); // Already revoked URL above
    }
  };

  // --- NowPayments Payment Initiation ---
  const handlePayment = async () => {
    if (!file) { setError('Please select a PDF file first.'); return; }
    if (!user?.id) { setError('Please sign in to start a payment.'); return; } // Check user logged in

    setError(''); setIsLoading(true); setLoadingMessage('Preparing payment invoice...');
    setPaymentStatus('pending_creation'); setParsedData(null); setShowSimulateButton(false);
    setNeedsParsingTrigger(false); setNowPaymentsUrl('');

    let newRequestId = null; // Keep track locally
    try {
      console.log(`Creating initial request record for file ${file.name} with ${pageCount} pages.`);
      newRequestId = await createInitialRequestRecord(file, pageCount); // Uses user.id via useCallback dependency
      if (!newRequestId) throw new Error("Failed to create initial database record.");
      setCurrentRequestId(newRequestId); // Set state *after* successful creation
      console.log(`Created request record with ID: ${newRequestId}`);

      const { data, error: functionError } = await supabase.functions.invoke(
          'create-nowpayments-invoice', { body: { requestId: newRequestId } }
      );
      if (functionError) throw new Error(`Function error: ${functionError.message}`);
      if (data.error) throw new Error(`Invoice creation failed: ${data.error}`);
      const { invoiceUrl } = data;
      if (!invoiceUrl) throw new Error('Could not retrieve NowPayments invoice URL.');

      console.log("Received NowPayments URL:", invoiceUrl);
      setNowPaymentsUrl(invoiceUrl);

      if (isDevelopment) {
        setLoadingMessage('Invoice created (Dev Mode). Click "Simulate Success" or pay manually.');
        setIsLoading(false); setPaymentStatus('waiting'); setShowSimulateButton(true);
      } else {
        setLoadingMessage('Redirecting to NowPayments for payment...');
        setPaymentStatus('waiting'); window.location.href = invoiceUrl;
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      setError(`Payment error: ${err.message}`); setIsLoading(false); setPaymentStatus('failed');
      setShowSimulateButton(false);
      if (newRequestId) { // Use local ID if creation succeeded but invoice failed
        await updateRequestRecord(newRequestId, { payment_status: 'failed', error_message: `Invoice creation failed: ${err.message}` });
      }
    }
  };

  // --- Simulate Payment (Dev Only) ---
  const handleSimulatePayment = async () => {
    if (!currentRequestId) { setError("Cannot simulate: No active Request ID."); return; }
    console.log(`Attempting simulation for Request ID: ${currentRequestId}`);
    setIsLoading(true); setLoadingMessage('Simulating successful payment...'); setError(''); setShowSimulateButton(false);
    try {
        const { data, error: functionError } = await supabase.functions.invoke(
            'simulate-payment-success', { body: { requestId: currentRequestId } }
        );
        if (functionError) throw new Error(`Function error: ${functionError.message}`);
        if (data.error) throw new Error(`Simulation failed: ${data.error}`);
        console.log("Simulation function executed successfully:", data.message);
        setLoadingMessage('Simulation successful. Waiting for confirmation via Realtime...');
        // State will update via Realtime listener
    } catch (err) {
        console.error('Payment simulation error:', err);
        setError(`Simulation failed: ${err.message}`); setIsLoading(false); setLoadingMessage('');
    }
  };

  // --- Handle Return from NowPayments ---
   const handleNowPaymentsReturn = useCallback(() => {
      const query = new URLSearchParams(window.location.search);
      const returnStatus = query.get('payment_return');
      const requestIdParam = query.get('request_id'); // Use a different name to avoid conflict

      if (returnStatus && requestIdParam) {
          console.log(`Returned from NowPayments with status: ${returnStatus} for request: ${requestIdParam}`);
          // Clean URL without reloading page
          window.history.replaceState({}, document.title, window.location.pathname);

          // Update state based on return
          setCurrentRequestId(requestIdParam); // Set the ID from the URL

          if (returnStatus === 'success') {
              setLoadingMessage('Payment submitted. Waiting for blockchain confirmation...');
              setIsLoading(true);
              setPaymentStatus('confirming'); // Tentative status
              setError('');
              setNowPaymentsUrl(''); // Clear invoice URL
              setShowSimulateButton(false); // Hide simulate button
          } else if (returnStatus === 'cancel') {
              setError('Payment was canceled on the NowPayments page.');
              setPaymentStatus('canceled'); // Set final status
              setIsLoading(false);
              setLoadingMessage('');
              // Optional: Update DB record here if needed, though IPN might override
               updateRequestRecord(requestIdParam, { payment_status: 'canceled' });
          }
      }
  // Run only once on mount to check URL params
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateRequestRecord]); // Add updateRequestRecord dependency


  // --- Trigger Parsing ---
  const triggerParsing = async () => {
      if (!file || !currentRequestId || paymentStatus !== 'succeeded') {
          setError("Cannot start parsing. Ensure payment succeeded and file is selected."); return;
      }
      setIsLoading(true); setLoadingMessage('Uploading file and preparing analysis...');
      setError(''); setParsedData(null); setNeedsParsingTrigger(false);

      // Clear previous timer
      if (timerId) { clearInterval(timerId); setTimerId(null); }
      setCreatedAtTime(null); setTotalDuration(0);

      try {
          const timestamp = Date.now();
          const filePath = `user_statements/${currentRequestId}_${timestamp}_${file.name}`;
          console.log(`Uploading to Supabase Storage: ${filePath}`);

          await updateRequestRecord(currentRequestId, { storage_path: filePath, parsing_status: 'initiated' });

          const { error: uploadError } = await supabase.storage.from('statement-uploads').upload(filePath, file);
          if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
          console.log("File uploaded successfully to Storage.");

          console.log("Invoking parse-bank-statement function...");
          const { error: functionError } = await supabase.functions.invoke(
              'parse-bank-statement', { body: { requestId: currentRequestId, storagePath: filePath } }
          );
          if (functionError) throw new Error(`Function invocation failed: ${functionError.message}. Check function logs.`);
          console.log("Parse function invoked successfully. Waiting for Realtime...");

          // Fetch created_at for timer
          const { data: requestDetails, error: fetchError } = await supabase
            .from('requests').select('created_at').eq('id', currentRequestId).single();
          if (fetchError || !requestDetails) {
              console.warn("Could not fetch created_at for timer, using fallback.", fetchError?.message);
              setCreatedAtTime(Date.now());
          } else {
              setCreatedAtTime(new Date(requestDetails.created_at).getTime());
          }

          const estimatedDurationMs = pageCount > 0 ? pageCount * 20 * 1000 : 3 * 60 * 1000;
          setTotalDuration(estimatedDurationMs);
          const newTimerId = setInterval(() => setNow(Date.now()), 1000);
          setTimerId(newTimerId);
          console.log(`Started 'now' update timer ${newTimerId} for request ${currentRequestId}`);

          setIsLoading(true); // Ensure loading stays active
          setLoadingMessage(`Parsing in progress...`); // Timer displayed separately
          setParsingStatus('processing'); // Reflect active parsing

      } catch (err) {
          console.error('Error during parsing initiation:', err);
          setError(`Parsing failed: ${err.message}`);
          setIsLoading(false); setLoadingMessage('');
          if (timerId) clearInterval(timerId); setTimerId(null); setCreatedAtTime(null); setTotalDuration(0);
          if (currentRequestId) {
              await updateRequestRecord(currentRequestId, { parsing_status: 'error', error_message: `Client-side initiation failed: ${err.message}` });
          }
      }
  };

  // --- Test File Handling (Copied from original App.jsx) ---
  const handleTestFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (testFilePreviewUrl) { URL.revokeObjectURL(testFilePreviewUrl); setTestFilePreviewUrl(null); setTestPdfFileName(''); }
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') { setError('Test file must be a PDF.'); return; }
      // Clear normal flow data
      setFile(null); if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
      setParsedData(null); setPaymentStatus(''); setError('');
      const newPreviewUrl = URL.createObjectURL(selectedFile);
      setTestFilePreviewUrl(newPreviewUrl); setTestPdfFileName(selectedFile.name);
    } else { setTestPdfFileName(''); }
  };
  const handleTestJsonChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') { setError('Test data file must be JSON.'); setTestJsonData(null); setTestJsonFileName(''); return; }
      setFile(null); if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
      setParsedData(null); setPaymentStatus(''); setError('');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          if (json?.meta_data && json?.transactions_data) { setTestJsonData(json); setTestJsonFileName(selectedFile.name); setError(''); }
          else { throw new Error('Invalid JSON structure.'); }
        } catch (parseError) { setError(`Failed to parse test JSON: ${parseError.message}`); setTestJsonData(null); setTestJsonFileName(''); }
      };
      reader.onerror = () => { setError("Error reading JSON file."); setTestJsonData(null); setTestJsonFileName(''); }
      reader.readAsText(selectedFile);
    }
  };
  const handleDownloadJson = useCallback(() => {
    const dataToDownload = testJsonData || parsedData;
    const sourceFileName = testPdfFileName || file?.name;
    if (!dataToDownload) { setError("No data available to download."); return; }
    try {
      const jsonString = JSON.stringify(dataToDownload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = sourceFileName ? `parsed_${sourceFileName.replace(/\.pdf$/i, '')}.json` : `parsed_data_${currentRequestId || 'test'}.json`;
      link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); setError('');
    } catch (error) { setError("Could not generate download link."); }
  }, [parsedData, testJsonData, file, testPdfFileName, currentRequestId]);


  // --- Reset Function (Modified slightly) ---
  const resetState = () => {
     setPaymentStatus(''); setCurrentRequestId(null); setNeedsParsingTrigger(false); setNowPaymentsUrl(''); setShowSimulateButton(false);
     if (timerId) { clearInterval(timerId); setTimerId(null); }
     setCreatedAtTime(null); setTotalDuration(0);
     if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); }
     if (testFilePreviewUrl) { URL.revokeObjectURL(testFilePreviewUrl); }
     setFile(null); setFilePreviewUrl(null); setParsedData(null);
     setTestFilePreviewUrl(null); setTestJsonData(null); setTestPdfFileName(''); setTestJsonFileName('');
     setIsLoading(false); setLoadingMessage(''); setError('');
     setPageCount(0); // Also reset page count
     // Clear file input visually
     const fileInput = document.getElementById('file-upload');
     if (fileInput) fileInput.value = '';
     const testFileInput = document.getElementById('test-file-upload');
     if (testFileInput) testFileInput.value = '';
     const testJsonInput = document.getElementById('test-json-upload');
     if (testJsonInput) testJsonInput.value = '';
   };

   // --- Effects from original App.jsx ---
   useEffect(() => {
     // Check critical env vars
     if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY || !import.meta.env.VITE_APP_BASE_URL) {
        setError("Critical configuration missing. App may not function correctly.");
        console.error("ERROR: Missing environment variables!");
     }
     // Handle return from NowPayments on mount
     handleNowPaymentsReturn();

     // Cleanup object URLs on unmount
     return () => {
       if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
       if (testFilePreviewUrl) URL.revokeObjectURL(testFilePreviewUrl);
     };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Run only once

   useEffect(() => { // Cleanup timer on unmount
     return () => { if (timerId) clearInterval(timerId); };
   }, [timerId]);


  // --- Determine what data/preview to show ---
  const showTestDataResults = !!(testFilePreviewUrl && testJsonData);
  const showNormalResults = !!(filePreviewUrl && parsedData);
  const previewUrlToShow = showTestDataResults ? testFilePreviewUrl : filePreviewUrl;
  const dataToShow = showTestDataResults ? testJsonData : parsedData;
  // const showPlaceholderPreview = !showNormalResults && filePreviewUrl && !showTestDataResults; // Placeholder logic might need review
  // const showTestPlaceholderPreview = !showTestDataResults && testFilePreviewUrl; // Placeholder logic might need review


  // --- Render Logic ---
  return (
    // Using App.css classes for consistency for now
    <div className="container new-request-container">
      {/* Simple Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <h2>Create New Parsing Request</h2>
        <button onClick={() => navigate('/')} className="cta-button secondary">View History</button>
      </header>

      {!user && (
         <p className="warning-message">Please <a href="/">Sign In</a> to create a request.</p>
      )}

      {user && (
         <> {/* Main content area */}
           <div className="upload-section">
             {paymentStatus !== 'succeeded' ? (
               <>
                 <label htmlFor="file-upload" className={`custom-file-upload ${isLoading ? 'disabled' : ''}`}>
                   {file ? `Selected: ${file.name}` : '1. Choose PDF File'}
                 </label>
                 <input
                   id="file-upload" type="file" accept="application/pdf" onChange={handleFileChange} disabled={isLoading || !!currentRequestId || paymentStatus === 'succeeded'}
                 />
               </>
             ) : (
               <div className="locked-file"> <p>✅ {file?.name || 'File Locked'}</p> </div>
             )}

             {!needsParsingTrigger && paymentStatus !== 'succeeded' && (
                 <button onClick={handlePayment} disabled={!file || isLoading || !!currentRequestId || ['pending_creation', 'waiting', 'confirming', 'confirmed', 'sending'].includes(paymentStatus)} className="cta-button" >
                   {isLoading && paymentStatus === 'pending_creation' ? 'Creating Invoice...' : '2. Pay with Crypto'}
                 </button>
             )}

             {isDevelopment && showSimulateButton && !isLoading && (
                  <button onClick={handleSimulatePayment} className="cta-button simulate-button">
                     ⚡ Simulate Payment Success (Dev)
                 </button>
             )}

             {needsParsingTrigger && file && paymentStatus === 'succeeded' && (
                  <button onClick={triggerParsing} disabled={isLoading || !file} className="cta-button parse-button">
                   {isLoading ? 'Parsing...' : '3. Start Parsing'}
                 </button>
             )}

           </div> {/* End Upload Section */}

           {isDevelopment && nowPaymentsUrl && showSimulateButton && (
             <div className='dev-info'>
                 <p>Dev: Invoice created. Simulate success or pay manually:</p>
                 <a href={nowPaymentsUrl} target="_blank" rel="noopener noreferrer" style={{wordBreak: 'break-all'}}>{nowPaymentsUrl}</a>
             </div>
           )}

           {/* User Messages & Loading Indicators */}
           {error && <p className="error-message">Error: {error}</p>}
           {paymentStatus === 'canceled' && <p className="info-message">Payment was canceled. Select a file and try again.</p>}
           {paymentStatus === 'expired' && <p className="warning-message">The payment invoice expired. Please try again.</p>}
           {paymentStatus === 'failed' && <p className="error-message">Payment failed. Please check NowPayments or try again.</p>}
           {paymentStatus === 'waiting' && !isLoading && (
                <p className="info-message">Invoice created. Please proceed with payment {isDevelopment ? 'or simulation' : ''}.</p>
           )}
           {paymentStatus === 'succeeded' && !parsedData && !isLoading && !error && needsParsingTrigger && file && (
               <p className="success-message">Payment confirmed! Click "Start Parsing".</p>
           )}
           {/* Message if payment succeeded but file was somehow lost */}
           {paymentStatus === 'succeeded' && !isLoading && !error && needsParsingTrigger && !file && (
               <p className="warning-message">Payment confirmed! Please re-select the PDF file, then click "Start Parsing".</p>
           )}

           {/* General Spinner (if loading but NOT parsing) */}
           {isLoading && parsingStatus !== 'processing' && (
             <div className="loading-message-container">
               <div className="spinner"></div> <p>{loadingMessage || 'Processing...'}</p>
             </div>
           )}

           {/* Parsing-specific Loading State with Timer */}
           {isLoading && parsingStatus === 'processing' && (
               (() => {
                   // --- Start Replacement ---
                   // Use state variables: pageCount, createdAtTime, now
                   const estimatedDurationMs = pageCount > 0 ? pageCount * 20 * 1000 : 3 * 60 * 1000; // 20s/page, fallback 3 min
                   const currentCreatedAtTime = createdAtTime; // Use state variable
                   const elapsedTime = currentCreatedAtTime ? now - currentCreatedAtTime : 0; // Use state 'now' for current time
                   const remainingMs = Math.max(0, estimatedDurationMs - elapsedTime);
                   const completionTime = currentCreatedAtTime ? new Date(currentCreatedAtTime + estimatedDurationMs) : null;

                   return (
                     <div className="pending-parsing-container loading-message-container">
                       <div className="spinner"></div>
                       <div className="pending-message">
                         <h3>Parsing in Progress...</h3>
                         <p>Your bank statement is currently being processed. This may take several minutes depending on the size of the document.</p>

                         {/* Estimates & Dynamic Remaining Time */}
                         {pageCount > 0 && currentCreatedAtTime && completionTime ? (
                           <div className="progress-timer"> {/* Reusing class for styling */}
                             <p>Estimated total duration: ~{Math.ceil(estimatedDurationMs / 60000)} minutes ({pageCount} pages)</p>
                             <br />
                             <p>Calculated time remaining: {formatTime(remainingMs)}</p>
                             <br />
                             <p>Expected completion around: {completionTime.toLocaleTimeString()}</p>
                             {/* Optional: Add a simple progress bar based on elapsed time */}
                             {/* <progress max={estimatedDurationMs} value={elapsedTime}></progress> */}
                           </div>
                         ) : (
                           <p>Estimating time...</p>
                         )}

                         <p>You can leave this page and come back later - the status will update automatically.</p>
                       </div>
                     </div>
                   );
                   // --- End Replacement ---
               })()
           )}

           {/* --- RESULTS SECTION --- */}
           {/* Only render results section if there's a preview URL or parsed data */}
           {(previewUrlToShow || dataToShow) && (
             <div className="results-section" style={{marginTop: '30px'}}>
                {parsedData && !isLoading && !error && (
                   <div className="success-message-container"> <p className="success-message">✅ Parsing completed successfully!</p> </div>
                )}
                <div className="results-header">
                  <h2>Results {showTestDataResults ? '(Test Preview)' : ''}</h2>
                  <div className="results-actions">
                     {/* Reset button */}
                     <button onClick={resetState} className="cta-button secondary" style={{marginRight: '10px'}}>Start New</button>
                    {(showNormalResults || showTestDataResults) && (
                       <button onClick={handleDownloadJson} className="cta-button download-button"> Download JSON </button>
                    )}
                  </div>
                </div>

                <div className="summary-section">
                  {(showNormalResults || showTestDataResults) ? (
                    <>
                      {dataToShow?.meta_data?.['Ending Balance Offset'] === 0 && (
                        <div className="success-message-container accuracy-success">
                           <p className="success-message"> 🎯 100% Parsing Accuracy<br /> Parser achieved flawless accuracy (0 offset).</p>
                        </div>
                      )}
                      <StatementSummary metaData={dataToShow.meta_data} />
                    </>
                  ) : ( /* Show empty structure if no data yet but preview exists */
                    previewUrlToShow && (
                       <div className="summary-container"> {/* Placeholder structure */}
                          <h3>Summary</h3>
                          <div className="summary-grid">
                              <div><strong>Bank:</strong></div> <div><strong>Customer:</strong></div> <div><strong>Account Number:</strong></div> <div><strong>Offset:</strong></div>
                              <div><strong>Starting Date:</strong></div> <div><strong>Ending Date:</strong></div> <div><strong>Starting Balance:</strong></div> <div><strong>Ending Balance:</strong></div>
                              <div><strong>Transactions:</strong></div> <div><strong>Credits:</strong></div> <div><strong>Debits:</strong></div>
                           </div>
                       </div>
                    )
                  )}
                </div> {/* End summary-section */}

                <div className="results-content">
                  <div className="pdf-column">
                    {previewUrlToShow ? (
                       <iframe src={previewUrlToShow} width="100%" height="800px" title="PDF Preview" />
                     ) : (
                       <div className="empty-preview"> <p>PDF preview appears here.</p> </div>
                    )}
                  </div>
                  <div className="right-column">
                    <div className="transactions-column">
                      <TransactionsTable transactions={(showNormalResults || showTestDataResults) ? dataToShow.transactions_data : []} />
                    </div>
                    <div className="balances-section">
                      <BalancesTable balances={(showNormalResults || showTestDataResults) ? dataToShow.balances : []} />
                    </div>
                  </div>
                </div> {/* End results-content */}

             </div> /* End results-section */
           )} {/* End conditional rendering of results section */}

         </> /* End user logged in content */
      )}
    </div> // End Container
  );
}

export default NewRequestPage; 