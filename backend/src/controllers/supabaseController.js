import supabase from '../services/supabase.js';
import { executeQuery } from '../utils/database.js';
import fs from 'fs';

// Get all requests for a user
export const getRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Define the optimized query to fetch only ending balance offset
    const query = `
      SELECT 
        id,
        created_at,
        file_name,
        page_count,
        parsing_status,
        parsed_data->'meta_data'->>'Ending Balance Offset' as ending_balance_offset
      FROM requests 
      WHERE user_id = $1 
        AND is_deleted = false 
      ORDER BY created_at DESC
    `;
    
    // Execute the raw PostgreSQL query
    const result = await executeQuery(query, [userId]);
    
    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch requests'
    });
  }
};

// Get a specific request by ID
export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error(`Error fetching request ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch request'
    });
  }
};

// Create a new request
export const createRequest = async (req, res) => {
  try {
    const { file_name, file_size, page_count } = req.body;
    const userId = req.user.id;
    
    const insertData = {
      file_name,
      file_size,
      page_count,
      payment_status: 'pending',
      parsing_status: 'pending',
      user_id: userId
    };
    
    const { data, error } = await supabase
      .from('requests')
      .insert(insertData)
      .select('id')
      .single();

    if (error) throw error;
    if (!data || !data.id) {
      throw new Error('Failed to create request record or retrieve its ID');
    }
    
    return res.status(201).json({
      success: true,
      data: { id: data.id }
    });
  } catch (error) {
    console.error('Error creating request:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create request'
    });
  }
};

// Update an existing request
export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    // First check if the request belongs to this user
    const { data: existingRequest, error: checkError } = await supabase
      .from('requests')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (checkError || !existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Request not found or access denied'
      });
    }
    
    const { error } = await supabase
      .from('requests')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      message: 'Request updated successfully'
    });
  } catch (error) {
    console.error(`Error updating request ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update request'
    });
  }
};

// Delete a request (soft delete)
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // First check if the request belongs to this user
    const { data: existingRequest, error: checkError } = await supabase
      .from('requests')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (checkError || !existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Request not found or access denied'
      });
    }
    
    // Soft delete by setting is_deleted to true
    const { error } = await supabase
      .from('requests')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      message: 'Request deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting request ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete request'
    });
  }
};

// Upload file to Supabase storage
export const uploadToStorage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'RequestId is required'
      });
    }
    
    const userId = req.user.id;
    const filePath = `user_statements/${requestId}_${Date.now()}_${req.file.originalname}`;
    
    // Check if the request belongs to this user
    const { data: existingRequest, error: checkError } = await supabase
      .from('requests')
      .select('id')
      .eq('id', requestId)
      .eq('user_id', userId)
      .single();
      
    if (checkError || !existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Request not found or access denied'
      });
    }
    
    // Update request record with storage path
    await supabase
      .from('requests')
      .update({
        storage_path: filePath,
        parsing_status: 'initiated'
      })
      .eq('id', requestId);
    
    // Read file from disk
    const fileBuffer = fs.readFileSync(req.file.path);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('statement-uploads')
      .upload(filePath, fileBuffer);
      
    // Clean up the local file
    fs.unlinkSync(req.file.path);
    
    if (uploadError) throw uploadError;
    
    return res.status(200).json({
      success: true,
      data: {
        storagePath: filePath
      }
    });
  } catch (error) {
    console.error('Error uploading file to storage:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
};

// Invoke Supabase Edge Function
export const invokeFunction = async (req, res) => {
  try {
    const { functionName } = req.params;
    const body = req.body;
    
    // Only allow specific function names for security
    const allowedFunctions = ['parse-bank-statement', 'create-nowpayments-invoice', 'simulate-payment-success'];
    if (!allowedFunctions.includes(functionName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid function name'
      });
    }
    
    // If invoking functions related to a request, verify user owns the request
    if (body.requestId) {
      const userId = req.user.id;
      
      const { data: existingRequest, error: checkError } = await supabase
        .from('requests')
        .select('id')
        .eq('id', body.requestId)
        .eq('user_id', userId)
        .single();
        
      if (checkError || !existingRequest) {
        return res.status(404).json({
          success: false,
          error: 'Request not found or access denied'
        });
      }
    }
    
    // Forward to the migrated functions endpoints
    console.log(`Forwarding to migrated function: ${functionName}`);
    
    // Create a request to the appropriate functions endpoint
    const functionsUrl = `/api/functions/${functionName}`;
    
    // Redirect to the appropriate function endpoint
    req.url = functionsUrl;
    
    // Import and call the corresponding function from functionsController
    let result;
    switch (functionName) {
      case 'parse-bank-statement':
        const { parseBankStatement } = await import('../controllers/functionsController.js');
        result = await parseBankStatement(req, res);
        break;
      case 'create-nowpayments-invoice':
        const { createNowpaymentsInvoice } = await import('../controllers/functionsController.js');
        result = await createNowpaymentsInvoice(req, res);
        break;
      case 'simulate-payment-success':
        const { simulatePaymentSuccess } = await import('../controllers/functionsController.js');
        result = await simulatePaymentSuccess(req, res);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid function name'
        });
    }
    
    return result;
    
  } catch (error) {
    console.error(`Error invoking function ${req.params.functionName}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || `Failed to invoke function ${req.params.functionName}`
    });
  }
}; 