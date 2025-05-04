import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, getSessionThunk } from '../store/authSlice';
import { supabase } from '../supabaseClient';
import StatementSummary from './StatementSummary';
import TransactionsTable from './TransactionsTable';
import BalancesTable from './BalancesTable';
import UserCredits from './UserCredits';
import '../App.css';

// Helper function to format time
function formatTime(ms) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ---> Added: Cache helper functions
const getCachedData = (key) => {
  try {
    const cached = sessionStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error(`Error reading cache key ${key}:`, error);
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error writing cache key ${key}:`, error);
  }
};
// <--- End Added

function RequestPage() {
  const { id } = useParams(); // Changed from requestId to id to match the route parameter
  const requestId = id; // For backward compatibility with existing code
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  
  // Check for missing ID early and show a helpful error
  useEffect(() => {
    if (!requestId) {
      console.error("No request ID provided in URL parameters");
      setError("No request ID provided. Please select a request from the dashboard.");
      setIsLoading(false);
    }
  }, [requestId]);
  
  // ---> Modified: Initialize state from cache if available
  const cacheKeyRequest = `request-${requestId}`;
  const cacheKeyParsed = `parsed-${requestId}`;
  const [request, setRequest] = useState(() => getCachedData(cacheKeyRequest));
  const [parsedData, setParsedData] = useState(() => {
      const cached = getCachedData(cacheKeyParsed);
      // Ensure cached parsed data has the expected structure
      if (cached?.meta_data && cached?.transactions_data) {
          return cached;
      }
      return null; 
  });
  // <--- End Modified
  const [previewUrl, setPreviewUrl] = useState(null); // Don't cache preview URL
  // ---> Modified: isLoading depends on whether we have *any* request data initially
  const [isLoading, setIsLoading] = useState(!request); // Start loading only if no cached request
  // <--- End Modified
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const timerIntervalRef = useRef(null);
  const channelRef = useRef(null);

  // Initialize auth on component mount
  useEffect(() => {
    const initAuth = async () => {
      setIsAuthLoading(true);
      await dispatch(getSessionThunk());
      setIsAuthLoading(false);
    };
    
    initAuth();
  }, [dispatch]);

  useEffect(() => {
    let isMounted = true;

    async function fetchRequestData() {
      if (!requestId) {
        setError("No Request ID provided.");
        setIsLoading(false);
        return;
      }

      console.log(`Fetching data for request ID: ${requestId} (Initial load or refresh)`);
      // Reset error only if not already set from cache issues potentially
      // setError(''); 
      // No need to reset parsedData/request here as they might come from cache

      // Revoke previous URL if it exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null); 
      }
      
      // ---> Added: Set loading true only if we didn't load from cache
      if (!request) {
        setIsLoading(true); 
      }
      // <--- End Added

      try {
        // Fetch request details regardless of cache to get latest status
        const { data: requestData, error: requestError } = await supabase
          .from('requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (!isMounted) return;

        if (requestError) throw new Error(`Request fetch error: ${requestError.message}`);
        if (!requestData) throw new Error('Request not found.');

        console.log("Fresh request data fetched:", requestData);
        // Update state and cache
        setRequest(requestData);
        setCachedData(cacheKeyRequest, requestData);
        setError(''); // Clear previous errors on successful fetch

        // Process parsed data if successful
        if (requestData.parsing_status === 'success' && requestData.parsed_data) {
          try {
            const receivedData = typeof requestData.parsed_data === 'string'
              ? JSON.parse(requestData.parsed_data)
              : requestData.parsed_data;
            if (!receivedData?.meta_data || !receivedData?.transactions_data) {
              throw new Error("Fetched data is missing expected structure.");
            }
            setParsedData(receivedData);
            setCachedData(cacheKeyParsed, receivedData); // Cache parsed data
          } catch (parseErr) {
            console.error("Error parsing fetched data:", parseErr);
            setError(`Failed to process results: ${parseErr.message}`);
            setParsedData(null); // Clear potentially stale parsed data
            sessionStorage.removeItem(cacheKeyParsed); // Remove invalid item from cache
          }
        } else if (requestData.parsing_status === 'error') {
          setError(`Parsing failed: ${requestData.error_message || 'Unknown error'}`);
          setParsedData(null); // Clear potentially stale parsed data
          sessionStorage.removeItem(cacheKeyParsed); // Remove parsed data if status is error
        } else {
          // If status is pending/processing, ensure parsedData state is null
          setParsedData(null);
          sessionStorage.removeItem(cacheKeyParsed); // Remove parsed data if not success/error
        }

        // Fetch Preview URL (always fetch, don't cache)
        if (requestData.storage_path) {
          console.log("Fetching PDF preview URL for path:", requestData.storage_path);
          try {
            const { data: urlData, error: urlError } = await supabase
              .storage
              .from('statement-uploads')
              .createSignedUrl(requestData.storage_path, 60 * 60); // 1 hour validity

            if (!isMounted) return;

            if (urlError) throw new Error(`Preview URL error: ${urlError.message}`);

            console.log("Signed URL fetched:", urlData.signedUrl);
            setPreviewUrl(urlData.signedUrl);
          } catch (previewErr) {
             // Don't overwrite main error state if preview fails, just log it
            console.error("Error fetching PDF preview URL:", previewErr);
            // Optionally set a specific preview error state if needed
          }
        }

      } catch (err) { // Catch errors from fetching request or parsing URL
        if (!isMounted) return;
        console.error('Error during request data fetch/processing:', err);
        setError(`Failed to load request: ${err.message}`);
        // Clear potentially stale cache if the main request fetch fails
        // setRequest(null); 
        // setParsedData(null);
        // sessionStorage.removeItem(cacheKeyRequest);
        // sessionStorage.removeItem(cacheKeyParsed);
      } finally {
        if (isMounted) setIsLoading(false); // Stop loading indicator
      }
    }

    // Only fetch data if we're not loading auth
    if (!isAuthLoading) {
      fetchRequestData();
    }

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("RequestPage unmounting or requestId changed - cleaning up");
      // No need to clear sessionStorage here
      // Revoke object URL if it exists
       if (previewUrl) {
         URL.revokeObjectURL(previewUrl);
         // No need to setPreviewUrl(null) on unmount, new load will handle it
       }
      // Clear timers and channels
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (channelRef.current) {
        console.log("Removing Realtime channel on unmount/cleanup.");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // ---> Modified: Add cache keys to dependency array
  }, [requestId, cacheKeyRequest, cacheKeyParsed, isAuthLoading]);
  // <--- End Modified

  useEffect(() => {
    // ---> Modified: Logic for managing Realtime subscription
    // Condition to determine if subscription is needed
    const needsSubscription = request && 
                             !['success', 'error'].includes(request.parsing_status) && 
                             !['failed', 'expired', 'canceled', 'refunded', 'succeeded', 'na'].includes(request.payment_status); 
                             // Include payment status check just in case, though credit model reduces its importance here

    if (!needsSubscription) {
      if (channelRef.current) {
        console.log("Removing Realtime channel (request status is final or no request data).");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return; // Exit if no subscription needed
    }

    // If subscription is needed but already exists, do nothing
    if (channelRef.current) {
      console.log("Realtime channel already exists and is needed.");
      return;
    }

    // Create subscription if needed and doesn't exist
    console.log(`Subscribing to Realtime updates for request ID: ${requestId}`);
    const channel = supabase
      .channel(`request-status:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
        (payload) => {
          console.log('Realtime UPDATE received:', payload);
          const updatedRequest = payload.new;
          if (updatedRequest) {
            // Update state and cache
            setRequest(updatedRequest);
            setCachedData(cacheKeyRequest, updatedRequest);
            setError(''); // Clear error on successful update

            if (updatedRequest.parsing_status === 'success' && updatedRequest.parsed_data) {
              try {
                const receivedData = typeof updatedRequest.parsed_data === 'string'
                  ? JSON.parse(updatedRequest.parsed_data)
                  : updatedRequest.parsed_data;
                if (!receivedData?.meta_data || !receivedData?.transactions_data) {
                  throw new Error("Updated data is missing expected structure.");
                }
                setParsedData(receivedData);
                setCachedData(cacheKeyParsed, receivedData); // Update parsed data cache
                console.log("Realtime: Parsed data updated from subscription.");
              } catch (parseErr) {
                console.error("Realtime: Error parsing updated data:", parseErr);
                setError(`Failed to process update: ${parseErr.message}`);
                setParsedData(null);
                sessionStorage.removeItem(cacheKeyParsed); // Remove invalid item from cache
              }
            } else if (updatedRequest.parsing_status === 'error') {
              setError(`Parsing failed: ${updatedRequest.error_message || 'Unknown error'}`);
              setParsedData(null);
              sessionStorage.removeItem(cacheKeyParsed); // Remove parsed data cache on error
            } else {
              // If status is pending/processing ensure parsedData is null
              setParsedData(null);
               sessionStorage.removeItem(cacheKeyParsed); // Remove parsed data cache if not success/error
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`Realtime channel subscribed successfully for ${requestId}`);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) console.error('Realtime subscription error:', status, err);
        else console.log(`Realtime channel status: ${status}`);
      });

    channelRef.current = channel;
  // ---> Modified: Add cache keys to dependency array
  }, [request, requestId, cacheKeyRequest, cacheKeyParsed]);
  // <--- End Modified

  useEffect(() => {
    if (request && request.parsing_status === 'processing') {
      if (!timerIntervalRef.current) {
        console.log("Starting per-second 'now' update timer.");
        timerIntervalRef.current = setInterval(() => {
          setNow(Date.now());
        }, 1000);
      }
    } else {
      if (timerIntervalRef.current) {
        console.log("Clearing per-second 'now' update timer.");
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        console.log("Cleaning up timer interval on effect re-run/unmount.");
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [request]);

  const timerDetails = React.useMemo(() => {
    if (!request || request.parsing_status !== 'processing' || !request.created_at || !request.page_count || request.page_count <= 0) {
      return null;
    }
    const createdAtTime = new Date(request.created_at).getTime();
    const estimatedDurationMs = request.page_count * 20 * 1000;
    const elapsedTime = now - createdAtTime;
    const remainingMs = Math.max(0, estimatedDurationMs - elapsedTime);
    const completionTime = new Date(createdAtTime + estimatedDurationMs);
    return {
        remainingFormatted: formatTime(remainingMs),
        completionTimeFormatted: completionTime.toLocaleTimeString(),
        estimatedDurationMinutes: Math.ceil(estimatedDurationMs / 60000)
    };
  }, [request, now]);

  const handleDownloadJson = useCallback(() => {
    if (!parsedData) {
      setError("No parsed data available to download.");
      return;
    }
    try {
      const jsonString = JSON.stringify(parsedData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = request?.file_name
        ? `parsed_${request.file_name.replace(/\.pdf$/i, '')}.json`
        : `parsed_data_${requestId}.json`;
      link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url); setError('');
    } catch (downloadError) {
      console.error("Error creating download link:", downloadError);
      setError("Could not generate download link.");
    }
  }, [parsedData, request, requestId]);

  let statusIndicator = null;
  if (isAuthLoading) {
    statusIndicator = (
      <div className="loading-message-container">
        <div className="spinner"></div> <p>Loading authentication...</p>
      </div>
    );
  } else if (!user) {
    statusIndicator = (
      <div className="error-message-container">
        <p className="error-message">Please sign in to view request details</p>
        <button onClick={() => navigate('/')} className="cta-button">Go to Home Page</button>
      </div>
    );
  } else if (isLoading) {
    statusIndicator = (
      <div className="loading-message-container">
        <div className="spinner"></div> <p>Loading request details...</p>
      </div>
    );
  } else if (error) {
    statusIndicator = <p className="error-message">Error: {error}</p>;
  } else if (request) {
      if (request.parsing_status === 'pending') {
          statusIndicator = <p className="info-message">Parsing pending. Waiting to start processing...</p>;
      } else if (request.parsing_status === 'initiated') {
          statusIndicator = <p className="info-message">Parsing initiated. Preparing to process...</p>;
      } else if (request.parsing_status === 'processing') {
          const estimatedDurationMs = request.page_count > 0 ? request.page_count * 20 * 1000 : 3 * 60 * 1000; // 20s/page, fallback 3 min
          const createdAtTime = new Date(request.created_at).getTime();
          const elapsedTime = now - createdAtTime; // Use state 'now' for current time
          const remainingMs = Math.max(0, estimatedDurationMs - elapsedTime);
          const completionTime = new Date(createdAtTime + estimatedDurationMs);
          statusIndicator = (
            
              <div className="pending-parsing-container loading-message-container">
                  <div className="spinner"></div>
                  <div className="pending-message">
                  <h3>Parsing in Progress...</h3>
                  <p>Your bank statement is currently being processed. This may take several minutes depending on the size of the document.</p>
                  
                  {/* Original Estimates & Dynamic Remaining Time */}
                  {request.page_count ? (
                    <div className="progress-timer"> {/* Reusing class for styling */}
                      <p>Estimated total duration: ~{Math.ceil(estimatedDurationMs / 60000)} minutes ({request.page_count} pages)</p>
                      <br />
                      <p>Calculated time remaining: {formatTime(remainingMs)}</p>
                      <br />
                      <p>Expected completion around: {completionTime.toLocaleTimeString()}</p>
                      {/* Optional: Add a simple progress bar based on elapsed time */} 
                      {/* <progress max={estimatedDurationMs} value={elapsedTime}></progress> */}
                    </div>
                  ) : (
                    <p>Estimating time (no page count)...</p>
                  )}
                  </div>
              </div>
          );
      } else if (request.parsing_status === 'success' && parsedData) {
          statusIndicator = (
              <div className="success-message-container">
                  <p className="success-message">✅ Parsing completed successfully!</p>
              </div>
          );
      } else if (request.parsing_status === 'success' && !parsedData) {
          statusIndicator = <p className="error-message">Parsing reported success, but results could not be loaded.</p>;
      }
  }

  return (
    <div className="container request-details-container">

      <div className="status-indicator-area" style={{ marginBottom: '20px' }}>
          {statusIndicator}
      </div>

      {!isAuthLoading && user && (
        <div className="results-section">
          <div className="results-header">
            <h2>{request?.file_name || (isLoading ? 'Loading...' : 'Statement')}</h2>
            <div className="results-actions">
              {request?.parsing_status === 'success' && parsedData && (
                <button onClick={handleDownloadJson} className="cta-button download-button">
                  Download JSON
                </button>
              )}
            </div>
          </div>

          <div className="summary-section">
              {parsedData?.meta_data?.['Ending Balance Offset'] === 0 && request?.parsing_status === 'success' && (
                <div className="success-message-container accuracy-success">
                    <p className="success-message"> 🎯 100% Parsing Accuracy<br /> Parser achieved flawless accuracy (0 offset).</p>
                </div>
              )}
              <StatementSummary metaData={parsedData?.meta_data} />
          </div>

          <div className="results-content">
            <div className="pdf-column">
              {previewUrl ? (
                <iframe src={previewUrl} width="100%" height="800px" title="PDF Preview" />
              ) : (
                <div className="empty-preview">
                  {isLoading && <p>Loading preview...</p>}
                  {!isLoading && request?.storage_path && <p>Could not load preview.</p>}
                  {!isLoading && !request?.storage_path && <p>No statement file found for this request.</p>}
                  {error && !isLoading && <p>Preview unavailable due to error.</p>}
                </div>
              )}
            </div>
            <div className="right-column">
              <div className="transactions-column">
                <TransactionsTable transactions={parsedData?.transactions_data || []} isLoading={isLoading || (request?.parsing_status === 'processing')} />
              </div>
              <BalancesTable balances={parsedData?.balances || []} isLoading={isLoading || (request?.parsing_status === 'processing')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequestPage; 