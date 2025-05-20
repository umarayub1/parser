import supabase from '../services/supabase.js';
import { validateApiKey } from '../utils/apiKeyUtils.js';

/**
 * Get the user from the session token
 */
export async function getUserFromSession(sessionToken) {
  if (!sessionToken) {
    return { user: null, session: null };
  }
  
  try {
    // Get user from session token
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    
    if (error || !user) {
      console.error('Error getting user from session:', error);
      return { user: null, session: null };
    }
    
    // Get session data
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return { user, session: null };
    }
    
    return { user, session };
  } catch (error) {
    console.error('Error in getUserFromSession:', error);
    return { user: null, session: null };
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
  const { user, session } = await getUserFromSession(sessionToken);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired session' 
    });
  }
  
  // Add user and session to the request object
  req.user = user;
  req.session = session;
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