import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatementSummary from './StatementSummary';
import TransactionsTable from './TransactionsTable';
import BalancesTable from './BalancesTable';
import '../App.css';

function RequestPage() {
  const { requestId } = useParams();
  const [parsedData, setParsedData] = useState(null);
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  const channelRef = useRef(null);

  useEffect(() => {
    async function fetchRequestData() {
      if (!requestId) return;

      setIsLoading(true);
      setError('');

      try {
        // Fetch request details
        const { data: requestData, error: requestError } = await supabase
          .from('requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (requestError) throw new Error(`Request fetch error: ${requestError.message}`);
        if (!requestData) throw new Error('Request not found');

        setRequest(requestData);

        // --- Attempt to fetch PDF preview if storage path exists --- 
        // Moved outside the parsing_status check to show preview earlier
        if (requestData.storage_path) {
          console.log("Attempting to fetch PDF preview from storage path:", requestData.storage_path);
          const { data: fileData, error: fileError } = await supabase.storage
            .from('statement-uploads') // Ensure this matches your bucket name
            .download(requestData.storage_path);

          if (!fileError && fileData) {
            // Revoke existing URL before creating a new one
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }
            const url = URL.createObjectURL(fileData);
            setPreviewUrl(url);
            console.log("PDF preview URL set from initial fetch.");
          } else {
            console.error("Error fetching PDF preview on initial load:", fileError?.message);
            // Don't set an error message here, just means preview unavailable
          }
        }
        // --- End PDF Preview Fetch ---

        // Only process data if parsing is complete
        if (requestData.parsing_status === 'success' && requestData.parsed_data) {
          const receivedData = typeof requestData.parsed_data === 'string'
            ? JSON.parse(requestData.parsed_data)
            : requestData.parsed_data;
          setParsedData(receivedData);
        } else if (requestData.parsing_status === 'error') {
          setError(`Parsing error: ${requestData.error_message || 'Unknown error'}`);
        } else if (requestData.parsing_status === 'pending') {
          if (requestData.payment_status === 'succeeded') {
            // Payment is good, parsing just hasn't started or is in progress
            setParsedData(null);
            setError(null);
            // Don't set isLoading since we're showing a specific pending state
          } else {
            // Payment may not be completed
            setError(`This request is pending. Payment status: ${requestData.payment_status}`);
          }
        }
      } catch (err) {
        console.error('Error fetching request data:', err);
        setError(`Error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequestData();

    // Cleanup function to revoke URL when component unmounts or previewUrl changes
    return () => {
      if (previewUrl) {
        console.log("Revoking PDF preview URL:", previewUrl);
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [requestId]);

  // --- Realtime Subscription Effect ---
  useEffect(() => {
    // Only subscribe if we have a requestId and the status might change
    if (requestId && request && ['pending', 'processing'].includes(request.parsing_status)) {
      console.log(`Subscribing to Realtime updates for request ID: ${requestId}`);

      // Ensure cleanup of previous channel if dependencies change
      if (channelRef.current) {
        console.log("Removing previous Realtime channel before creating new one.");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`request-status:${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'requests',
            filter: `id=eq.${requestId}`,
          },
          async (payload) => {
            console.log('Realtime UPDATE received on RequestPage:', payload);
            const updatedRequest = payload.new;

            if (updatedRequest) {
              // Update the core request state first
              setRequest(updatedRequest);

              // Handle specific status changes
              if (updatedRequest.parsing_status === 'success') {
                console.log("Realtime: Parsing success detected.");
                setIsLoading(false);
                setError('');

                if (updatedRequest.parsed_data) {
                  try {
                    const receivedData = typeof updatedRequest.parsed_data === 'string'
                      ? JSON.parse(updatedRequest.parsed_data)
                      : updatedRequest.parsed_data;
                    setParsedData(receivedData);
                    console.log("Realtime: Parsed data updated.");

                    // Fetch/update preview URL if necessary
                    if (updatedRequest.storage_path && !previewUrl) {
                      console.log("Realtime: Fetching PDF preview URL...");
                      const { data: fileData, error: fileError } = await supabase.storage
                        .from('statement-uploads')
                        .download(updatedRequest.storage_path);

                      if (!fileError && fileData) {
                        const url = URL.createObjectURL(fileData);
                        // Revoke previous URL if it exists before setting new one
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl);
                        }
                        setPreviewUrl(url);
                        console.log("Realtime: PDF preview URL set.");
                      } else {
                        console.error("Realtime: Error fetching PDF preview:", fileError?.message);
                      }
                    }

                  } catch (parseErr) {
                    console.error("Realtime: Error parsing received data:", parseErr);
                    setError("Error processing updated data received from server.");
                    setParsedData(null);
                  }
                } else {
                  console.warn("Realtime: Parsing success reported, but no parsed_data found in payload.");
                  setError("Parsing finished, but result data seems missing.");
                  setParsedData(null);
                }

              } else if (updatedRequest.parsing_status === 'error') {
                console.log("Realtime: Parsing error detected.");
                setIsLoading(false);
                setError(`Parsing error: ${updatedRequest.error_message || 'Unknown processing error'}`);
                setParsedData(null);

              } else if (updatedRequest.parsing_status === 'processing') {
                console.log("Realtime: Parsing switched to 'processing'.");
                setIsLoading(true);
                setError('');
                setParsedData(null);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Realtime channel subscribed successfully for ${requestId}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
            console.error('Realtime subscription error:', status, err);
          } else {
            console.log(`Realtime channel status: ${status}`);
          }
        });

      channelRef.current = channel;

    } else {
      if (channelRef.current) {
        console.log("Removing Realtime channel (no active request or final status).");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }

    return () => {
      if (channelRef.current) {
        console.log("Cleaning up Realtime channel on effect cleanup.");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [requestId, request, previewUrl]);

  // Function to handle JSON download
  const handleDownloadJson = () => {
    if (!parsedData) {
      setError("No data available to download.");
      return;
    }

    try {
      const jsonString = JSON.stringify(parsedData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `parsed_data_${requestId}.json`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating download link:", error);
      setError("Could not generate download link.");
    }
  };

  // Render logic
  return (
    <div className="container">
      <h1>Bank Statement Request Results</h1>
      <div className="request-info">
        <h2>Request #{requestId}</h2>
        {request && (
          <div className="request-details">
            <p><strong>File:</strong> {request.file_name}</p>
            <p><strong>Payment Status:</strong> {request.payment_status}</p>
            <p><strong>Parsing Status:</strong> {request.parsing_status}</p>
            <p><strong>Created:</strong> {new Date(request.created_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Error and Loading States */}
      {error && <p className="error-message">Error: {error}</p>}
      
      {isLoading ? (
        <div className="loading-message-container">
          <div className="spinner"></div>
          <p>Loading request data...</p>
        </div>
      ) : null}
      
      {/* Pending Parsing Status */}
      {!isLoading && !error && request && request.parsing_status === 'processing' && request.payment_status === 'succeeded' && (
        <div className="pending-parsing-container">
          <div className="spinner"></div>
          <div className="pending-message">
            <h3>Parsing in Progress</h3>
            <p>Your bank statement is currently being processed. This may take several minutes depending on the size of the document.</p>
            {request.page_count && (
              <>
                <p>Estimated duration: {Math.ceil((request.page_count * 20 * 1000) / 60000)} minutes</p>
                <p>Expected completion: {new Date(Date.now() + (request.page_count * 20 * 1000)).toLocaleTimeString()}</p>
              </>
            )}
            <p>You can leave this page and come back later - the permanent link will always show the latest status.</p>
          </div>
        </div>
      )}

      {/* Results Section - Only show if we have parsed data */}
      {parsedData && (
        <div className="results-section">
          <div className="results-header">
            <h2>Results</h2>
            <button onClick={handleDownloadJson} className="cta-button download-button">
              Download JSON
            </button>
          </div>
          
          <div className="summary-section">
            <StatementSummary metaData={parsedData.meta_data} />
          </div>

          <div className="results-content">
            <div className="pdf-column">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  width="100%"
                  height="800px"
                  title="PDF Preview"
                />
              ) : (
                <div className="empty-preview">
                  <p>PDF preview not available</p>
                </div>
              )}
            </div>
            <div className="right-column">
              <div className="transactions-column">
                <TransactionsTable transactions={parsedData.transactions_data || []} />
              </div>
              <div className="balances-section">
                <BalancesTable balances={parsedData.balances || []} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="navigation-buttons">
        <a href="/" className="cta-button">Back to Home</a>
      </div>
    </div>
  );
}

export default RequestPage; 