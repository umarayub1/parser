import supabase from '../services/supabase.js';
import { generateApiKey } from '../utils/apiKeyUtils.js';

/**
 * Create a new API key
 */
export async function createApiKey(req, res) {
  try {
    const { name, expiresIn } = req.body;
    const userId = req.userId;
    
    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key name is required' 
      });
    }
    
    // Generate API key
    const keyData = generateApiKey();
    
    // Calculate expiration date if needed
    let expirationDate = null;
    if (expiresIn && expiresIn !== 'never') {
      const days = parseInt(expiresIn, 10);
      if (!isNaN(days) && days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        expirationDate = date.toISOString();
      }
    }
    
    // Save key to database
    const { error: insertError } = await supabase
      .from('api_keys')
      .insert({
        name: name.trim(),
        key_prefix: keyData.prefix,
        key_hash: keyData.hash,
        user_id: userId,
        expires_at: expirationDate,
        is_active: true
      });
      
    if (insertError) {
      throw new Error(`Failed to save API key: ${insertError.message}`);
    }
    
    // Return the full key once (it won't be retrievable later)
    res.status(201).json({
      success: true,
      apiKey: keyData.full_key,
      prefix: keyData.prefix,
      name: name.trim(),
      expiresAt: expirationDate
    });
    
  } catch (error) {
    console.error('Error creating API key:', error);
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while creating the API key'
    });
  }
}

/**
 * List API keys for a user
 */
export async function listApiKeys(req, res) {
  try {
    const userId = req.userId;
    
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at, expires_at, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      keys: data || []
    });
    
  } catch (error) {
    console.error('Error fetching API keys:', error);
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching API keys'
    });
  }
}

/**
 * Update API key (active status)
 */
export async function updateApiKey(req, res) {
  try {
    const { keyId } = req.params;
    const { is_active } = req.body;
    const userId = req.userId;
    
    // Check if the key belongs to the user
    const { data: keyData, error: fetchError } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();
      
    if (fetchError || !keyData) {
      return res.status(404).json({
        success: false,
        error: 'API key not found or not authorized'
      });
    }
    
    // Update the key
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ 
        is_active: !!is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);
      
    if (updateError) {
      throw new Error(`Failed to update API key: ${updateError.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: `API key ${is_active ? 'activated' : 'deactivated'} successfully`
    });
    
  } catch (error) {
    console.error('Error updating API key:', error);
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while updating the API key'
    });
  }
}

/**
 * Delete API key
 */
export async function deleteApiKey(req, res) {
  try {
    const { keyId } = req.params;
    const userId = req.userId;
    
    // Check if the key belongs to the user
    const { data: keyData, error: fetchError } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();
      
    if (fetchError || !keyData) {
      return res.status(404).json({
        success: false,
        error: 'API key not found or not authorized'
      });
    }
    
    // Delete the key
    const { error: deleteError } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);
      
    if (deleteError) {
      throw new Error(`Failed to delete API key: ${deleteError.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'API key deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting API key:', error);
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while deleting the API key'
    });
  }
}

/**
 * Verify API key
 */
export async function verifyApiKey(req, res) {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKeyHeader) {
    return res.status(400).json({
      success: false,
      error: 'No API key provided'
    });
  }
  
  const { isValid, userId, apiKeyId } = req;
  
  // Get key details
  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('name, key_prefix, created_at, last_used_at, expires_at')
    .eq('id', apiKeyId)
    .single();
    
  if (keyError) {
    return res.status(500).json({
      success: false,
      error: 'Error fetching API key details'
    });
  }
  
  // Get user details
  const { data: userData, error: userError } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single();
    
  if (userError) {
    return res.status(500).json({
      success: false,
      error: 'Error fetching user details'
    });
  }
  
  return res.status(200).json({
    success: true,
    message: 'API key is valid',
    key: {
      id: apiKeyId,
      name: keyData.name,
      prefix: keyData.key_prefix,
      created_at: keyData.created_at,
      last_used_at: keyData.last_used_at,
      expires_at: keyData.expires_at
    },
    user: {
      id: userId,
      email: userData.email,
      full_name: userData.full_name
    }
  });
} 