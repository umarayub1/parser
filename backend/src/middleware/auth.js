import supabase from '../services/supabase.js';
import { validateApiKey } from '../utils/apiKeyUtils.js';

/**
 * Get the user from the session token
 */
export async function getUserFromSession(sessionToken) {
  if (!sessionToken) {
    return null;
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    
    if (error || !user) {
      console.error('Error getting user from session:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error in getUserFromSession:', error);
    return null;
  }
}

/**
 * User authentication middleware using session token
 */
export async function authenticateUser(req, res, next) {
  // Check for session token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }
  
  const sessionToken = authHeader.replace('Bearer ', '');
  const user = await getUserFromSession(sessionToken);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired session' 
    });
  }
  
  // Add user to the request object
  req.user = user;
  next();
}

/**
 * API key authentication middleware
 */
export async function authenticateApiKey(req, res, next) {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKeyHeader) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  const { isValid, userId, apiKeyId } = await validateApiKey(apiKeyHeader);
  
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  // Store in request for later use
  req.userId = userId;
  req.apiKeyId = apiKeyId;
  
  next();
} 