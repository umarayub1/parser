import crypto from 'crypto';
import supabase from '../services/supabase.js';

/**
 * Securely compare API keys
 * @param {string} providedKey - The key provided by the client
 * @param {string} storedHash - The hash stored in the database
 * @returns {boolean} - Whether the keys match
 */
export function verifyApiKeySecurely(providedKey, storedHash) {
  try {
    // Create a hash of the provided key
    const providedKeyHash = crypto.createHash('sha256').update(providedKey).digest('hex');
    
    // Use constant-time comparison to avoid timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedKeyHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch (error) {
    console.error('Error in secure key comparison:', error);
    return false;
  }
}

/**
 * Validate API key and authenticate user
 */
export async function validateApiKey(apiKeyHeader) {
  if (!apiKeyHeader || !apiKeyHeader.startsWith('Bearer ')) {
    return { isValid: false };
  }

  const apiKey = apiKeyHeader.substring(7); // Remove 'Bearer ' prefix
  const keyPrefix = apiKey.split('.')[0]; // Get prefix part

  if (!keyPrefix || !keyPrefix.startsWith('bp_')) {
    return { isValid: false };
  }

  // Look up key in database
  const { data: apiKeyData, error } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !apiKeyData) {
    console.error('Error looking up API key:', error);
    return { isValid: false };
  }

  // Verify key using our utility function
  const isMatch = verifyApiKeySecurely(apiKey, apiKeyData.key_hash);
  
  if (!isMatch) {
    return { isValid: false };
  }
  
  // Update last_used_at timestamp
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyData.id);

  return { 
    isValid: true, 
    userId: apiKeyData.user_id,
    apiKeyId: apiKeyData.id
  };
}

/**
 * Generate a secure API key
 */
export function generateApiKey() {
  // Generate prefix (bp_xxx format)
  const prefixBytes = crypto.randomBytes(3);
  const prefix = 'bp_' + prefixBytes.toString('hex');
  
  // Generate secure random string for the key
  const keyBytes = crypto.randomBytes(24);
  const key = keyBytes.toString('base64').replace(/[+/=]/g, ''); // Remove base64 special characters
  
  // Create full key
  const fullKey = `${prefix}.${key}`;
  
  // Create hash for storage (secure one-way hash)
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
  
  return {
    full_key: fullKey,
    prefix: prefix,
    hash: hash
  };
} 