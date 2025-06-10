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
    
    if (error) {
      console.error('Error getting user from session:', error?.message || error);
      return { user: null, session: null };
    }
    
    if (!user) {
      console.log('No user found for session token');
      return { user: null, session: null };
    }
    
    // Create a session object with the token for stateless operation
    // In serverless environments, we need to reconstruct the session from the token
    const session = {
      access_token: sessionToken,
      user: user,
      expires_at: user.exp ? user.exp * 1000 : Date.now() + (24 * 60 * 60 * 1000), // Default to 24 hours if no exp
      token_type: 'bearer'
    };
    
    console.log('Session reconstructed for user:', user.id, 'expires at:', new Date(session.expires_at));
    
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
  
  if (!session) {
    return res.status(401).json({ 
      success: false, 
      error: 'Session could not be established' 
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