import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import supabase from '../services/supabase.js';
import { logApiRequest } from '../utils/logUtils.js';
import config from '../config/index.js';
import { calculateCreditCost } from '../services/planService.js';

/**
 * Parse PDF document
 */
export async function parsePdf(req, res) {
  const apiKeyId = req.apiKeyId;
  const userId = req.userId;
  const requestIp = req.headers['x-forwarded-for'] || req.ip;
  const requestStartTime = performance.now();
  let statusCode = 500;
  let responseBody = {};
  let requestBody = {};
  let errorMessage = null;
  
  try {
    if (req.is('multipart/form-data')) {
      // Handle file upload request
      const file = req.file;
      const callbackUrl = req.body.callback_url;
      const additionalInfo = req.body.additional_info;
      requestBody = { file: file.originalname, callbackUrl, additionalInfo };
      
      if (!file) {
        statusCode = 400;
        errorMessage = "No file uploaded";
        responseBody = { success: false, error: errorMessage };
        
        await logApiRequest(
          apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
          performance.now() - requestStartTime, requestIp, requestBody, responseBody, errorMessage
        );
        
        return res.status(statusCode).json(responseBody);
      }
      
      // Verify it's a PDF file
      if (file.mimetype !== 'application/pdf') {
        statusCode = 400;
        errorMessage = "Uploaded file is not a PDF";
        responseBody = { success: false, error: errorMessage };
        
        await logApiRequest(
          apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
          performance.now() - requestStartTime, requestIp, requestBody, responseBody, errorMessage
        );
        
        return res.status(statusCode).json(responseBody);
      }
      
      // Read the PDF file to get page count and other metadata
      let pageCount = 0;
      let metadata = null;
      
      try {
        const pdfBytes = fs.readFileSync(file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pageCount = pdfDoc.getPageCount();
        metadata = pdfDoc.getTitle() || null;
      } catch (pdfError) {
        console.error('Error reading PDF metadata:', pdfError);
      }
      
      // Create request entry in database
      const { data: requestData, error: requestError } = await supabase
        .from('requests')
        .insert({
          user_id: userId,
          file_name: file.originalname,
          file_size_bytes: file.size,
          page_count: pageCount,
          parsing_status: 'pending',
          is_api_request: true,
          api_key_id: apiKeyId,
          callback_url: callbackUrl || null,
          additional_info: additionalInfo || null
        })
        .select('id')
        .single();
        
      if (requestError) {
        throw new Error(`Failed to create request record: ${requestError.message}`);
      }
      
      const requestId = requestData.id;
      
      // Calculate credit cost based on user's plan
      const creditCalculation = await calculateCreditCost(userId, pageCount);
      const creditCost = Math.max(1, creditCalculation.total_credits);
      
      // Deduct credits
      const { error: creditDeductionError } = await supabase
        .rpc('deduct_credits', {
          user_id_input: userId,
          amount_input: creditCost
        });
        
      if (creditDeductionError) {
        throw new Error(`Failed to deduct credits: ${creditDeductionError.message}`);
      }

      // Update request status and store credits consumed
      await supabase
        .from('requests')
        .update({ 
          parsing_status: 'submitting',
          credits_consumed: creditCost
        })
        .eq('id', requestId);

      // Prepare form data for parsing API
      const formDataForParsingAPI = new FormData();
      
      // Create a readable stream from the file buffer
      const fileReadStream = fs.createReadStream(file.path);
      
      // Append the file to form data with proper metadata
      formDataForParsingAPI.append('file', fileReadStream, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.size
      });
      
      // Construct callback URL
      const parsingCallbackUrl = callbackUrl || config.parsingApi.callbackHandlerUrl;
      
      // Prepare headers for the callback
      const callbackHeaders = JSON.stringify({
        'Content-Type': 'application/json',
        'X-Callback-Signature': `Bearer ${config.parsingApi.callbackSecret}`,
        'X-Request-ID': requestId
      });

      // Add callback info to form data
      formDataForParsingAPI.append('callback_url', parsingCallbackUrl);
      formDataForParsingAPI.append('callback_headers', callbackHeaders);
      formDataForParsingAPI.append('retries', '1');

      // Call parsing API
      try {
        const parsingResponse = await axios.post(config.parsingApi.url, formDataForParsingAPI, {
          headers: {
            'accept': 'application/json',
            'api-key': config.parsingApi.key,
            ...formDataForParsingAPI.getHeaders()
          },
        });
        
        // Update request status to processing (credits_consumed already set above)
        await supabase
          .from('requests')
          .update({
            parsing_status: 'processing',
            parsing_started_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', requestId);
      } catch (apiError) {
        const errorBody = apiError.response?.data || apiError.message;
        await supabase
          .from('requests')
          .update({ 
            parsing_status: 'error', 
            error_message: `API submission failed: ${JSON.stringify(errorBody)}` 
          })
          .eq('id', requestId);
          
        throw new Error(`API submission failed (${apiError.response?.status || 'unknown'}): ${JSON.stringify(errorBody)}`);
      }

      // Cleanup temporary file
      fs.unlink(file.path, (err) => {
        if (err) console.error('Error removing temp file:', err);
      });

      // Set success response
      statusCode = 202;
      
      // Construct status URL
      const host = req.get('host');
      const protocol = req.protocol;
      const statusUrl = `${protocol}://${host}/api/parse-status/${requestId}`;
      
      responseBody = { 
        success: true, 
        message: 'PDF parsing job submitted successfully', 
        requestId: requestId,
        pageCount: pageCount,
        creditCost: creditCost.toFixed(1),
        creditCostPerPage: creditCalculation.credit_cost_per_page,
        planName: creditCalculation.plan_name,
        estimatedTime: `${pageCount * 20} seconds`, // Estimate 20 seconds per page
        pdfMetadata: metadata ? { title: metadata } : null,
        statusUrl: statusUrl,
        documentation: {
          checkStatus: `Make a GET request to ${statusUrl} with your API key in the Authorization header`,
          statusCodes: {
            200: "Request found, status information returned",
            401: "Invalid or missing API key",
            404: "Request not found or not accessible with your API key"
          }
        }
      };
      
      await logApiRequest(
        apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
        performance.now() - requestStartTime, requestIp, requestBody, responseBody, null
      );
      
      return res.status(statusCode).json(responseBody);
    } else if (req.is('application/json')) {
      // Handle JSON request (for status checks)
      const json = req.body;
      requestBody = json;
      
      // Check if this is a status request
      if (json.requestId) {
        // Redirect to the status endpoint
        const host = req.get('host');
        const protocol = req.protocol;
        const statusUrl = `${protocol}://${host}/api/parse-status/${json.requestId}`;
        
        statusCode = 303; // See Other
        responseBody = { 
          success: true, 
          message: 'Status checks should use the dedicated status endpoint', 
          statusUrl: statusUrl,
          documentation: {
            checkStatus: `Make a GET request to ${statusUrl} with your API key in the Authorization header`,
            statusCodes: {
              200: "Request found, status information returned",
              401: "Invalid or missing API key",
              404: "Request not found or not accessible with your API key"
            }
          }
        };
        
        await logApiRequest(
          apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
          performance.now() - requestStartTime, requestIp, requestBody, responseBody, null
        );
        
        return res.status(statusCode).json(responseBody);
      } else {
        statusCode = 400;
        errorMessage = "Invalid request. For PDF parsing, use multipart/form-data with a 'file' field. For status checks, use the /api/parse-status/:requestId endpoint.";
        responseBody = { success: false, error: errorMessage };
        
        await logApiRequest(
          apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
          performance.now() - requestStartTime, requestIp, requestBody, responseBody, errorMessage
        );
        
        return res.status(statusCode).json(responseBody);
      }
    } else {
      statusCode = 400;
      errorMessage = "Invalid content type. Use multipart/form-data for PDF parsing or application/json for status checks.";
      responseBody = { success: false, error: errorMessage };
      
      await logApiRequest(
        apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
        performance.now() - requestStartTime, requestIp, requestBody, responseBody, errorMessage
      );
      
      return res.status(statusCode).json(responseBody);
    }
  } catch (error) {
    console.error('Error in API Parse PDF function:', error);
    
    statusCode = 500;
    errorMessage = error.message || "Internal server error";
    responseBody = { success: false, error: errorMessage };
    
    // Log the error if we have a userId
    try {
      await logApiRequest(
        apiKeyId, userId, '/api/parse-pdf', req.method, statusCode, 
        performance.now() - requestStartTime, requestIp, requestBody, responseBody, errorMessage
      );
    } catch (err) {
      console.error('Error logging API error:', err);
    }
    
    return res.status(statusCode).json(responseBody);
  }
}

/**
 * Check PDF parse status
 */
export async function getParseStatus(req, res) {
  const apiKeyId = req.apiKeyId;
  const userId = req.userId;
  const requestIp = req.headers['x-forwarded-for'] || req.ip;
  const requestStartTime = performance.now();
  let statusCode = 500;
  let responseBody = {};
  let errorMessage = null;
  
  try {
    const { requestId } = req.params;
    
    // Get request data
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('id, parsing_status, error_message, created_at, parsing_started_at, parsing_completed_at, file_name')
      .eq('id', requestId)
      .eq('user_id', userId)
      .eq('is_api_request', true)
      .single();
      
    if (requestError || !requestData) {
      statusCode = 404;
      errorMessage = "Request not found or not authorized to access this request";
      responseBody = { success: false, error: errorMessage };
      
      await logApiRequest(
        apiKeyId, userId, `/api/parse-status/${requestId}`, req.method, statusCode, 
        performance.now() - requestStartTime, requestIp, {}, responseBody, errorMessage
      );
      
      return res.status(statusCode).json(responseBody);
    }
    
    const status = requestData.parsing_status;
    const isComplete = status === 'success';
    
    // If parsing is complete, include parsed data in the response
    let parsedData = null;
    if (isComplete) {
      const { data: fullRequestData, error: fullRequestError } = await supabase
        .from('requests')
        .select('parsed_data')
        .eq('id', requestId)
        .single();
        
      if (!fullRequestError && fullRequestData) {
        parsedData = fullRequestData.parsed_data;
      }
    }
    
    statusCode = 200;
    responseBody = {
      success: true,
      requestId: requestData.id,
      status: status,
      fileName: requestData.file_name,
      createdAt: requestData.created_at,
      startedAt: requestData.parsing_started_at,
      completedAt: requestData.parsing_completed_at,
      error: requestData.error_message,
      data: parsedData
    };
    
    await logApiRequest(
      apiKeyId, userId, `/api/parse-status/${requestId}`, req.method, statusCode, 
      performance.now() - requestStartTime, requestIp, {}, responseBody, null
    );
    
    return res.status(statusCode).json(responseBody);
  } catch (error) {
    console.error('Error in get parse status:', error);
    
    statusCode = 500;
    errorMessage = error.message || "Internal server error";
    responseBody = { success: false, error: errorMessage };
    
    try {
      await logApiRequest(
        apiKeyId, userId, `/api/parse-status/${req.params.requestId}`, req.method, statusCode, 
        performance.now() - requestStartTime, requestIp, {}, responseBody, errorMessage
      );
    } catch (err) {
      console.error('Error logging API error:', err);
    }
    
    return res.status(statusCode).json(responseBody);
  }
} 