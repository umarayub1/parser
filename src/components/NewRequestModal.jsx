import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectCredits, fetchCredits } from '../store/authSlice';
import { PDFDocument } from 'pdf-lib';
import ApiClient from './ApiClient';
import { supabase } from '../supabaseClient';
import './NewRequestModal.css';

const NewRequestModal = ({ isOpen, onClose, onRequestsCreated }) => {
  const user = useSelector(selectUser);
  const userCredits = useSelector(selectCredits);
  const dispatch = useDispatch();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCost, setTotalCost] = useState(0);
  const [processingFiles, setProcessingFiles] = useState([]);
  const [creditCostPerPage, setCreditCostPerPage] = useState(0.17);
  const [userPlan, setUserPlan] = useState(null);

  // Fetch credits and user plan when modal opens
  useEffect(() => {
    const fetchUserData = async () => {
      if (isOpen && user?.id) {
        if (userCredits === 0 || userCredits === undefined) {
          dispatch(fetchCredits());
        }
        
        try {
          // Fetch user plan information
          const plan = await ApiClient.getUserPlan();
          setUserPlan(plan);
          
          // Fetch credit cost per page based on user's plan
          const costPerPage = await ApiClient.getCreditCostPerPage();
          setCreditCostPerPage(costPerPage);
        } catch (error) {
          console.error('Error fetching user plan:', error);
          // Keep default values
        }
      }
    };
    
    fetchUserData();
  }, [isOpen, user?.id, userCredits, dispatch]);

  // Calculate total cost when files change or credit cost per page changes
  useEffect(() => {
    const cost = files.reduce((total, file) => total + (file.pageCount * creditCostPerPage), 0);
    setTotalCost(cost);
  }, [files, creditCostPerPage]);

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    setError('');
    setIsLoading(true);

    const processedFiles = [];

    for (const file of selectedFiles) {
      if (file.type !== 'application/pdf') {
        setError(`${file.name} is not a PDF file. Only PDF files are allowed.`);
        continue;
      }

      try {
        // Get page count
        const fileBuffer = await file.arrayBuffer();
        let pageCount = 0;
        
        try {
          const pdfDoc = await PDFDocument.load(fileBuffer);
          pageCount = pdfDoc.getPageCount();
        } catch (pdfError) {
          console.log("PDF load failed, trying ignoreEncryption...");
          try {
            const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
            pageCount = pdfDoc.getPageCount();
          } catch (secondError) {
            console.log("Second PDF load failed, using fallback...");
            const fileSizeInKB = file.size / 1024;
            pageCount = Math.max(1, Math.ceil(fileSizeInKB / 50));
          }
        }

        processedFiles.push({
          file,
          name: file.name,
          size: file.size,
          pageCount,
          cost: pageCount * creditCostPerPage,
          id: Math.random().toString(36).substr(2, 9)
        });
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setError(`Could not process ${file.name}: ${error.message}`);
      }
    }

    setFiles(processedFiles);
    setIsLoading(false);
  };

  const removeFile = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    if ((userCredits || 0) < totalCost) {
      setError(`Insufficient credits. You need ${totalCost.toFixed(1)} credits but have ${(userCredits || 0).toFixed(1)}. Please top up your credits.`);
      return;
    }

    setIsLoading(true);
    setError('');
    // Mark all files as processing immediately
    setProcessingFiles(files.map(f => f.id));

    try {
      // Process all files simultaneously
      const processFilePromises = files.map(async (fileData) => {
        // 1. Create request record
        const requestData = {
          file_name: fileData.name,
          file_size: fileData.size,
          page_count: fileData.pageCount
        };

        const createResponse = await ApiClient.createRequest(requestData);
        if (!createResponse.success) {
          throw new Error(`Failed to create request for ${fileData.name}: ${createResponse.error}`);
        }

        const requestId = createResponse.data.id;

        // 2. Upload file to storage
        const timestamp = Date.now();
        const filePath = `user_statements/${requestId}_${timestamp}_${fileData.name}`;

        const { error: uploadError } = await supabase.storage
          .from('statement-uploads')
          .upload(filePath, fileData.file);

        if (uploadError) {
          throw new Error(`Failed to upload ${fileData.name}: ${uploadError.message}`);
        }

        // 3. Update request with storage path
        await ApiClient.updateRequest(requestId, {
          storage_path: filePath,
          parsing_status: 'initiated'
        });

        // 4. Trigger parsing
        const parseResponse = await ApiClient.invokeFunction('parse-bank-statement', {
          requestId,
          storagePath: filePath
        });

        if (!parseResponse.success) {
          throw new Error(`Failed to start parsing for ${fileData.name}: ${parseResponse.error}`);
        }

        return requestId;
      });

              // Wait for all requests to complete
        const createdRequests = await Promise.all(processFilePromises);

        // Refresh user credits in Redux state
        dispatch(fetchCredits());

        // Notify parent component
        if (onRequestsCreated) {
          onRequestsCreated(createdRequests);
        }

        // Close modal and reset state
        onClose();
        setFiles([]);
        setProcessingFiles([]);
        setError('');

    } catch (err) {
      console.error('Error processing files:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setProcessingFiles([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Request</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="credits-info">
            <div className="credits-display">
              <span className="credits-label">Available Credits:</span>
              <span className="credits-value">{(userCredits || 0).toFixed(1)}</span>
            </div>
            {totalCost > 0 && (
              <div className="cost-display">
                <span className="cost-label">Total Cost:</span>
                <span className={`cost-value ${(userCredits || 0) < totalCost ? 'insufficient' : ''}`}>
                  {totalCost.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="file-upload-section">
            <input
              type="file"
              id="pdf-files"
              multiple
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isLoading}
              style={{ display: 'none' }}
            />
            <label htmlFor="pdf-files" className={`upload-button ${isLoading ? 'disabled' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Choose PDF Files
            </label>
          </div>

          {error && <div className="error-message">{error}</div>}

          {files.length > 0 && (
            <div className="files-list">
              <h3>Selected Files ({files.length})</h3>
              {files.map((fileData) => (
                <div key={fileData.id} className="file-item">
                  <div className="file-info">
                    <div className="file-name">{fileData.name}</div>
                    <div className="file-details">
                      {fileData.pageCount} pages • {fileData.cost.toFixed(1)} credits
                    </div>
                  </div>
                  <div className="file-actions">
                    {processingFiles.includes(fileData.id) ? (
                      <div className="processing-indicator">
                        <div className="spinner"></div>
                        Processing...
                      </div>
                    ) : (
                      <button
                        className="remove-file"
                        onClick={() => removeFile(fileData.id)}
                        disabled={isLoading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={isLoading || files.length === 0 || (userCredits || 0) < totalCost}
          >
            {isLoading ? 'Processing...' : `Submit ${files.length} Request${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewRequestModal; 