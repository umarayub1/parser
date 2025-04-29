import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatementSummary from './StatementSummary';
import TransactionsTable from './TransactionsTable';
import BalancesTable from './BalancesTable';
import '../App.css';

// Helper function to format time
function formatTime(ms) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function RequestPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const timerIntervalRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRequestData() {
      if (!requestId) {
        setError("No Request ID provided.");
        setIsLoading(false);
        return;
      }

      console.log(`Fetching data for request ID: ${requestId}`);
      setIsLoading(true);
      setError('');
      setParsedData(null);
      setRequest(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      try {
        const { data: requestData, error: requestError } = await supabase
          .from('requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (!isMounted) return;

        if (requestError) throw new Error(`Request fetch error: ${requestError.message}`);
        if (!requestData) throw new Error('Request not found.');

        console.log("Initial request data fetched:", requestData);
        setRequest(requestData);

        if (requestData.parsing_status === 'success' && requestData.parsed_data) {
          try {
            const receivedData = typeof requestData.parsed_data === 'string'
              ? JSON.parse(requestData.parsed_data)
              : requestData.parsed_data;
            if (!receivedData?.meta_data || !receivedData?.transactions_data) {
              throw new Error("Fetched data is missing expected structure.");
            }
            setParsedData(receivedData);
          } catch (parseErr) {
            console.error("Error parsing initial data:", parseErr);
            setError(`Failed to process results: ${parseErr.message}`);
          }
        } else if (requestData.parsing_status === 'error') {
          setError(`Parsing failed: ${requestData.error_message || 'Unknown error'}`);
        }

        if (requestData.storage_path) {
          console.log("Fetching PDF preview URL for path:", requestData.storage_path);
          try {
            const { data: urlData, error: urlError } = await supabase
              .storage
              .from('statement-uploads')
              .createSignedUrl(requestData.storage_path, 60 * 60);

            if (!isMounted) return;

            if (urlError) throw new Error(`Preview URL error: ${urlError.message}`);

            console.log("Signed URL fetched:", urlData.signedUrl);
            setPreviewUrl(urlData.signedUrl);
          } catch (previewErr) {
            console.error("Error fetching PDF preview URL:", previewErr);
          }
        }

      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching request details:', err);
        setError(`Failed to load request: ${err.message}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchRequestData();

    return () => {
      isMounted = false;
      console.log("RequestPage unmounting or requestId changed - cleaning up");
      if (previewUrl) {
        setPreviewUrl(null);
      }
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
  }, [requestId]);

  useEffect(() => {
    if (!request || ['success', 'error', 'failed', 'expired', 'canceled', 'refunded'].includes(request.payment_status) && ['success', 'error'].includes(request.parsing_status)) {
      if (channelRef.current) {
        console.log("Removing Realtime channel (request status is final or no request data).");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    if (channelRef.current) {
      console.log("Realtime channel already exists.");
      return;
    }

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
            setRequest(updatedRequest);

            if (updatedRequest.parsing_status === 'success' && updatedRequest.parsed_data) {
              try {
                const receivedData = typeof updatedRequest.parsed_data === 'string'
                  ? JSON.parse(updatedRequest.parsed_data)
                  : updatedRequest.parsed_data;
                if (!receivedData?.meta_data || !receivedData?.transactions_data) {
                  throw new Error("Updated data is missing expected structure.");
                }
                setParsedData(receivedData);
                setError('');
                console.log("Realtime: Parsed data updated from subscription.");
              } catch (parseErr) {
                console.error("Realtime: Error parsing updated data:", parseErr);
                setError(`Failed to process update: ${parseErr.message}`);
                setParsedData(null);
              }
            } else if (updatedRequest.parsing_status === 'error') {
              setError(`Parsing failed: ${updatedRequest.error_message || 'Unknown error'}`);
              setParsedData(null);
            } else if (updatedRequest.parsing_status === 'processing' || updatedRequest.parsing_status === 'initiated'){
              setError('');
              setParsedData(null);
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
  }, [request, requestId]);

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
  if (isLoading) {
    statusIndicator = (
      <div className="loading-message-container">
        <div className="spinner"></div> <p>Loading request details...</p>
      </div>
    );
  } else if (error) {
    statusIndicator = <p className="error-message">Error: {error}</p>;
  } else if (request) {
      if (request.payment_status !== 'succeeded' && request.payment_status !== 'na') {
          statusIndicator = <p className="warning-message">Payment Status: {request.payment_status}. Waiting for payment confirmation.</p>;
      } else if (request.parsing_status === 'pending') {
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <h2>Request Details</h2>
        <div>
            <button onClick={() => navigate('/new-request')} className="cta-button secondary" style={{ marginRight: '10px' }}>Create New</button>
            <button onClick={() => navigate('/')} className="cta-button secondary">View History</button>
        </div>
      </header>

      <div className="status-indicator-area" style={{ marginBottom: '20px' }}>
          {statusIndicator}
      </div>

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
            <div className="balances-section">
              <BalancesTable balances={parsedData?.balances || []} isLoading={isLoading || (request?.parsing_status === 'processing')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RequestPage; 