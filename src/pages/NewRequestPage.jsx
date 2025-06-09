import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PDFDocument } from 'pdf-lib'; // Import pdf-lib

// Import necessary components
import StatementSummary from '../components/StatementSummary';
import TransactionsTable from '../components/TransactionsTable';
import BalancesTable from '../components/BalancesTable';
import UserCredits from '../components/UserCredits'; // Import UserCredits component
import SummaryPlaceholder from '../components/SummaryPlaceholder';
import DownloadDataButton from '../components/DownloadDataButton'; // Import our new component
import apiClient from '../components/ApiClient.js'; // Corrected import path to components
// import PdfPreview from '../components/PdfPreview'; // Using iframe directly for now

// Import Redux selectors/actions if needed (currently only uses user)
import { selectUser, getSessionThunk, setSession } from '../store/authSlice';

// Import styles (using App.css for now, consider dedicated CSS)
import '../App.css';

// Add consistent typography styles
const typographyStyles = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  heading: {
    fontSize: '1.8rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#333',
  },
  subheading: {
    fontSize: '1.4rem',
    fontWeight: '500',
    marginBottom: '0.75rem',
    color: '#333',
  },
  text: {
    fontSize: '1.05rem',
    lineHeight: '1.5',
    color: '#444',
    margin: '0 0 0.5rem 0',
  },
  smallText: {
    fontSize: '0.95rem',
    lineHeight: '1.4',
    color: '#666',
  },
  label: {
    fontSize: '1.05rem',
    fontWeight: '500',
    color: '#555',
  }
};

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
  console.log('NewRequestPage component rendered!');
  
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser); // Get user from Redux

  // --- State from original App.jsx ---
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [parsingStatus, setParsingStatus] = useState(''); // pending, initiated, processing, success, error
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [createdAtTime, setCreatedAtTime] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [totalDuration, setTotalDuration] = useState(0);
  // User credits state
  const [userCredits, setUserCredits] = useState(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);

  // --- Test State (kept from original for consistency) ---
  const [testFilePreviewUrl, setTestFilePreviewUrl] = useState(null);
  const [testJsonData, setTestJsonData] = useState(null);
  const [testPdfFileName, setTestPdfFileName] = useState('');
  const [testJsonFileName, setTestJsonFileName] = useState('');

  // Ref to store the realtime channel
  const channelRef = useRef(null);

  // --- Auth Initialization ---
  useEffect(() => {
    // Only try to get session if we don't already have user data
    if (!user) {
      dispatch(getSessionThunk());
    }
    
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("NewRequestPage: Auth state changed:", _event);
        if (session) {
          dispatch(setSession(session));
        }
      }
    );
    
    return () => {
      if (authListener?.subscription) {
        console.log("NewRequestPage: Unsubscribing from auth listener");
        authListener.subscription.unsubscribe();
      }
    };
  }, [dispatch, user]);

  // Fetch user credits
  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!user) {
        setUserCredits(0); // Clear credits if no user
        return;
      }
      
      try {
        setIsLoadingCredits(true);
        // Use apiClient to fetch credits
        const credits = await apiClient.getCredits(); 
        // The ApiClient.getCredits() method now directly returns the number of credits
        // or throws an error if the fetch fails.
        setUserCredits(credits || 0);
      } catch (err) {
        console.error('Error fetching user credits via ApiClient:', err.message);
        setUserCredits(0); // Set to 0 or handle error appropriately
      } finally {
        setIsLoadingCredits(false);
      }
    };
    
    fetchUserCredits();
  }, [user]);

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
        payment_status: null, // Payment handled separately via credits
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
    // Subscribe if we have a request ID and parsing is not yet finished/failed
    if (currentRequestId && !['success', 'error'].includes(parsingStatus)) {
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
  }, [currentRequestId, parsingStatus]); // Dependencies: Only request ID and parsing status


  // --- File Handling ---
  const handleFileChange = async (event) => {
     // Prevent default behavior and store current scroll position
     const currentScrollY = window.scrollY;
     
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
      setError('');
      setParsedData(null);
      setParsingStatus('');
      setCurrentRequestId(null);
      setPageCount(0);

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
    
    // Restore scroll position after state updates to prevent unwanted scrolling
    setTimeout(() => {
      window.scrollTo(0, currentScrollY);
    }, 0);
  };

  // --- Trigger Parsing (Upload -> Invoke Function) ---
  const triggerParsing = async () => {
      if (!file) { // Ensure file is selected
          setError("Please select a PDF file first.");
          return;
      }
      if (!user?.id) { // Ensure user is logged in
          setError("You must be signed in to start parsing.");
          return;
      }

      // Check if user has enough credits
      const requiredCredits = pageCount * 0.1;
      if (userCredits < requiredCredits) {
          setError(`Not enough credits. You need ${requiredCredits.toFixed(1)} credits but have ${userCredits.toFixed(1)}. Please top up your credits.`);
          return;
      }

      setIsLoading(true); // Start loading
      setLoadingMessage('Uploading file and preparing analysis...'); // Initial message
      setError('');
      setParsedData(null); // Clear previous results
      setParsingStatus('initiated'); // Set initial parsing status

      // Clear previous timer if any
      if (timerId) {
          clearInterval(timerId);
          setTimerId(null);
      }
      setCreatedAtTime(null);
      setTotalDuration(0);

      try {
          // 1. Create Initial Request Record (if not already created or if file changed)
          // Ensure we have a request ID. If not, create one.
          let reqId = currentRequestId;
          if (!reqId) {
              console.log(`Creating initial request record for file ${file.name} with ${pageCount} pages.`);
              reqId = await createInitialRequestRecord(file, pageCount);
              if (!reqId) throw new Error("Failed to create initial database record.");
              setCurrentRequestId(reqId); // Store the new request ID
          }
          // 1. Upload file to Supabase Storage
          const timestamp = Date.now();
          const filePath = `user_statements/${reqId}_${timestamp}_${file.name}`;
          console.log(`Uploading to Supabase Storage: ${filePath}`);

          // store the path in the request record
          await updateRequestRecord(reqId, {
            storage_path: filePath,
            parsing_status: 'initiated' // Add this to indicate parsing has started
          });

          // 2. Upload file to Supabase Storage
          const { error: uploadError } = await supabase.storage.from('statement-uploads').upload(filePath, file);
          if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
          console.log("File uploaded successfully to Storage.");

          console.log("Invoking parse-bank-statement function via backend API...");
          const { success, error: functionError } = await apiClient.invokeFunction(
              'parse-bank-statement',
              { requestId: reqId, storagePath: filePath }
          );
          if (!success || functionError) {
            throw new Error(`Backend API call to parse-bank-statement failed: ${functionError}. Check backend logs.`);
          }
          console.log("Parse function invoked successfully via backend API. Waiting for Realtime...");

          // Fetch created_at for timer
          const { data: requestDetails, error: fetchError } = await supabase
            .from('requests').select('created_at').eq('id', reqId).single();
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
          console.log(`Started 'now' update timer ${newTimerId} for request ${reqId}`);

          // CRITICAL: Ensure loading state stays active during the entire parsing process
          setIsLoading(true);
          setLoadingMessage(`Parsing in progress...`); // Timer displayed separately
          setParsingStatus('processing'); // Reflect active parsing

      } catch (err) {
          console.error('Error during parsing initiation:', err);
          setError(`Parsing failed: ${err.message}`);
          setIsLoading(false); setLoadingMessage('');
          if (timerId) clearInterval(timerId); setTimerId(null); setCreatedAtTime(null); setTotalDuration(0);
          if (reqId) { // Use reqId captured earlier
              await updateRequestRecord(reqId, {
                  parsing_status: 'error',
                  error_message: `Client-side parsing initiation failed: ${err.message}`
              });
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
      setParsedData(null); setParsingStatus(''); setError('');
      const newPreviewUrl = URL.createObjectURL(selectedFile);
      setTestFilePreviewUrl(newPreviewUrl); setTestPdfFileName(selectedFile.name);
    } else { setTestPdfFileName(''); }
  };
  const handleTestJsonChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') { setError('Test data file must be JSON.'); setTestJsonData(null); setTestJsonFileName(''); return; }
      setFile(null); if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
      setParsedData(null); setParsingStatus(''); setError('');
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

  // --- Reset Function (Modified slightly) ---
  const resetState = () => {
     setParsingStatus('');

     // Clear timer if running during reset
     if (timerId) {
         clearInterval(timerId);
         setTimerId(null);
     }
     setCreatedAtTime(null);
     setTotalDuration(0);
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
  const sourceFileName = showTestDataResults ? testPdfFileName : (file?.name || '');
  // const showPlaceholderPreview = !showNormalResults && filePreviewUrl && !showTestDataResults; // Placeholder logic might need review
  // const showTestPlaceholderPreview = !showTestDataResults && testFilePreviewUrl; // Placeholder logic might need review


  // --- Render Logic ---
  return (
    // Using App.css classes for consistency for now
    <div className="container new-request-container" style={{ fontFamily: typographyStyles.fontFamily }}>
      {/* Simple Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
      </header>

      {!user && (
         <p className="warning-message" style={{ ...typographyStyles.text, color: '#f57c00' }}>Please <a href="/">Sign In</a> to create a request.</p>
      )}

      {user && (
         <> {/* Main content area */}
           <div className="upload-section">
             {/* Visually hidden file input */}
             <input
               type="file"
               id="file-upload" // Added ID for label association
               onChange={handleFileChange}
               accept=".pdf"
               disabled={isLoading || (!!currentRequestId && parsingStatus !== 'pending' && parsingStatus !== 'error' && parsingStatus !== 'success')}
               style={{ display: 'none' }} // Hide the default input
             />
             {/* Styled label acting as the button */}
             {!file ? (
               <label
                 htmlFor="file-upload"
                 className={`cta-button ${isLoading ? 'disabled' : ''}`}
                 style={{ fontSize: '1rem', padding: '12px 24px', display: 'inline-block', textAlign: 'center' }}
               >
                 Choose PDF File
               </label>
             ) : (
               <>
                 <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                   {/* Keep consistent button size, but with action appropriate for state */}
                   {user && !isLoading && (!parsingStatus || parsingStatus === 'pending' || parsingStatus === 'error' || parsingStatus === 'success') ? (
                     <button 
                       onClick={parsingStatus === 'success' ? resetState : triggerParsing} 
                       disabled={parsingStatus !== 'success' && (pageCount === 0 || userCredits < (pageCount * 0.1))} 
                       className="cta-button"
                       style={{fontSize: '1rem', padding: '12px 24px'}} // Natural button sizing
                     >
                       {parsingStatus === 'error' ? 'Retry Parsing' : 
                        parsingStatus === 'success' ? 'New Request' : 'Start Parsing'}
                     </button>
                   ) : (
                     <button 
                       className="cta-button" 
                       disabled={true}
                       style={{fontSize: '1rem', padding: '12px 24px'}} // Natural button sizing
                     >
                       Processing...
                     </button>
                   )}
                   
                   {/* Subtle Cancel/Remove File Button - only show when not processing and not successful */}
                   {!isLoading && parsingStatus !== 'success' && (
                     <button 
                       onClick={() => {
                         // Clear the current file and reset state
                         if (filePreviewUrl) {
                           URL.revokeObjectURL(filePreviewUrl);
                           setFilePreviewUrl(null);
                         }
                         setFile(null);
                         setPageCount(0);
                         setParsedData(null);
                         setParsingStatus('');
                         setCurrentRequestId(null);
                         setError('');
                         
                         // Clear the file input
                         const fileInput = document.getElementById('file-upload');
                         if (fileInput) fileInput.value = '';
                       }}
                       title="Remove file and choose a different one"
                       style={{
                         width: '32px',
                         height: '32px',
                         borderRadius: '50%',
                         border: 'none',
                         backgroundColor: 'transparent',
                         color: '#dc3545',
                         cursor: 'pointer',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         fontSize: '18px',
                         fontWeight: 'bold',
                         transition: 'all 0.2s ease',
                         marginLeft: '5px'
                       }}
                       onMouseOver={(e) => {
                         e.target.style.backgroundColor = '#dc3545';
                         e.target.style.color = 'white';
                         e.target.style.transform = 'scale(1.1)';
                       }}
                       onMouseOut={(e) => {
                         e.target.style.backgroundColor = 'transparent';
                         e.target.style.color = '#dc3545';
                         e.target.style.transform = 'scale(1)';
                       }}
                     >
                       ×
                     </button>
                   )}
                 </div>
                 
                 {/* Show file information separately */}
                 <div className="file-info" style={{marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px', display: 'flex', alignItems: 'center'}}>
                   <div style={{flex: 1}}>
                     <p style={{...typographyStyles.text, margin: '0'}}><strong>File:</strong> {file.name}</p>
                     <p style={{...typographyStyles.text, margin: '5px 0 0'}}><strong>Pages:</strong> {pageCount} ({(pageCount * 0.1).toFixed(1)} credits)</p>
                     {pageCount > 0 && userCredits < (pageCount * 0.1) && (
                       <p style={{...typographyStyles.text, margin: '5px 0 0', color: 'red'}}><strong>Not enough credits!</strong> You need {(pageCount * 0.1).toFixed(1)} credits but have {userCredits.toFixed(1)}. <a href="/top-up">Top up</a></p>
                     )}
                   </div>
                 </div>
               </>
             )}
           </div>

           {/* User Messages & Loading Indicators */}
           {error && <p className="error-message" style={typographyStyles.text}>Error: {error}</p>}

           {/* General Spinner (if loading but NOT parsing) */}
           {isLoading && parsingStatus !== 'processing' && (
             <div className="loading-message-container">
               <div className="spinner"></div> <p style={typographyStyles.text}>{loadingMessage || 'Processing...'}</p>
             </div>
           )}

           {/* Parsing-specific Loading State with Timer */}
           {isLoading && parsingStatus === 'processing' && (
               (() => {
                   // --- Start Replacement ---
                   // Use state variables: pageCount, createdAtTime, now
                   const estimatedDurationMs = pageCount > 0 ? pageCount * 40 * 1000 : 3 * 60 * 1000; // 20s/page, fallback 3 min
                   const currentCreatedAtTime = createdAtTime; // Use state variable
                   const elapsedTime = currentCreatedAtTime ? now - currentCreatedAtTime : 0; // Use state 'now' for current time
                   const remainingMs = Math.max(0, estimatedDurationMs - elapsedTime);
                   const completionTime = currentCreatedAtTime ? new Date(currentCreatedAtTime + estimatedDurationMs) : null;

                   return (
                     <div className="pending-parsing-container loading-message-container">
                       <div className="spinner"></div>
                       <div className="pending-message">
                         <h3 style={typographyStyles.subheading}>Parsing in Progress...</h3>
                         <p style={typographyStyles.text}>Your bank statement is currently being processed. This may take several minutes depending on the size of the document.</p>

                         {/* Estimates & Dynamic Remaining Time */}
                         {pageCount > 0 && currentCreatedAtTime && completionTime ? (
                           <div className="progress-timer"> {/* Reusing class for styling */}
                             <p style={typographyStyles.text}>Estimated total duration: ~{Math.ceil(estimatedDurationMs / 60000)} minutes ({pageCount} pages)</p>
                             <br />
                             <p style={typographyStyles.text}>Calculated time remaining: {formatTime(remainingMs)}</p>
                             <br />
                             <p style={typographyStyles.text}>Expected completion around: {completionTime.toLocaleTimeString()}</p>
                             {/* Optional: Add a simple progress bar based on elapsed time */}
                             {/* <progress max={estimatedDurationMs} value={elapsedTime}></progress> */}
                           </div>
                         ) : (
                           <p style={typographyStyles.text}>Estimating time...</p>
                         )}

                         <p style={typographyStyles.text}>You can leave this page and come back later - the status will update automatically.</p>
                       </div>
                     </div>
                   );
                   // --- End Replacement ---
               })()
           )}

           {/* --- RESULTS SECTION --- */}
           {/* Show placeholder sections even before PDF upload */}
           <div className="results-section" style={{marginTop: '30px'}}>
             <div className="results-header">
               <h2 style={typographyStyles.heading}>Results {showTestDataResults ? '(Test Preview)' : (!previewUrlToShow && !dataToShow ? '(Preview)' : '')}</h2>
             </div>

             {/* Success messages with improved UI */}
             <div className="messages-section">
               {parsedData && !isLoading && !error && (
                 <div className="success-message-container" style={{ 
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   backgroundColor: '#e7f7ee', 
                   marginBottom: '16px',
                   border: '1px solid #c3e6d1'
                 }}> 
                   <p className="success-message" style={{ 
                     margin: 0, 
                     display: 'flex', 
                     alignItems: 'center', 
                     gap: '8px',
                     fontWeight: '500'
                   }}>
                     <span style={{ fontSize: '1.2em' }}></span> 
                     Parsing completed successfully!
                   </p> 
                 </div>
               )}
               
               {dataToShow?.meta_data?.['Ending Balance Offset'] === 0 && (
                 <div className="success-message-container accuracy-success" style={{ 
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   backgroundColor: '#edf6ff', 
                   marginBottom: '16px',
                   border: '1px solid #c9e0f7'
                 }}>
                   <p className="success-message" style={{ 
                     margin: 0, 
                     display: 'flex', 
                     alignItems: 'center',
                     gap: '8px',
                     fontWeight: '500'
                   }}> 
                     <span style={{ fontSize: '1.2em' }}></span>
                     100% Parsing Accuracy - Parser achieved flawless accuracy (0 offset).
                   </p>
                 </div>
               )}
             </div>

             <div className="summary-section">
               {(showNormalResults || showTestDataResults) ? (
                 <>
                   <StatementSummary metaData={dataToShow.meta_data} />
                 </>
               ) : ( 
                 /* Show empty structure if no data yet, even before preview exists */
                 <SummaryPlaceholder />
               )}
             </div> {/* End summary-section */}

             {/* Download button repositioned here - between summary and transactions */}
             {(showNormalResults || showTestDataResults) && (
               <div className="download-section" style={{ 
                 display: 'flex', 
                 justifyContent: 'flex-end',
                 marginBottom: '16px',
                 marginTop: '16px'
               }}>
                 <DownloadDataButton 
                   data={dataToShow}
                   filename={sourceFileName ? 
                     `parsed_${sourceFileName.replace(/\.pdf$/i, '')}` : 
                     `parsed_data_${currentRequestId || 'test'}`}
                   onError={setError}
                   buttonStyle={{ fontSize: '1rem' }}
                 />
               </div>
             )}

             <div className="results-content">
               <div className="pdf-column">
                 {previewUrlToShow ? (
                    <iframe src={previewUrlToShow} width="100%" height="800px" title="PDF Preview" />
                  ) : (
                    <div className="empty-preview" style={{height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', border: '1px dashed #ccc'}}> 
                      <p style={typographyStyles.text}>Upload a PDF to see the preview here</p> 
                    </div>
                 )}
               </div>
               <div className="right-column">
                 <div className="transactions-column">
                   <TransactionsTable 
                     transactions={(showNormalResults || showTestDataResults) ? dataToShow.transactions_data : []}
                     metaData={(showNormalResults || showTestDataResults) ? dataToShow.meta_data : {}} 
                   />
                 </div>
                 <BalancesTable 
                   balances={(showNormalResults || showTestDataResults) ? dataToShow.balances : []}
                   metaData={(showNormalResults || showTestDataResults) ? dataToShow.meta_data : {}} 
                 />
               </div>
             </div> {/* End results-content */}

           </div> {/* End results-section */}

         </> /* End user logged in content */
      )}
    </div> // End Container
  );
}

export default NewRequestPage;