import { supabase } from '../supabaseClient';
import config from '../config';

/**
 * API Client for interacting with the backend API
 */
class ApiClient {
  /**
   * User signup
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} fullName - User's full name (optional)
   * @returns {Promise<Object>} - Signup result
   */
  static async signup(email, password, fullName = null) {
    const response = await fetch(`${config.apiBaseUrl}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email, 
        password, 
        full_name: fullName 
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    return data;
  }

  /**
   * User login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} - Login result with session and user
   */
  static async login(email, password) {
    // Try the backend API first
    try {
      const response = await fetch(`${config.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store session in Supabase to maintain session state
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      return data;
    } catch (error) {
      console.error('API login failed, falling back to Supabase:', error);
      
      // Fall back to Supabase direct login if API is not available
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      return data;
    }
  }

  /**
   * User logout
   * @returns {Promise<Object>} - Logout result
   */
  static async logout() {
    const session = await this.getSession();
    
    if (session) {
      try {
        // Try the backend API first
        const response = await fetch(`${config.apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('API logout failed');
        }
      } catch (error) {
        console.error('API logout failed, falling back to Supabase:', error);
      }
    }
    
    // Always sign out via Supabase to clear local session
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    
    return { success: true };
  }

  /**
   * Get current user with profile information
   * @returns {Promise<Object|null>} - User object or null if not authenticated
   */
  static async getCurrentUser() {
    const session = await this.getSession();
    if (!session) {
      return null;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/auth/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get user profile');
      }

      return data.user;
    } catch (error) {
      console.error('API user fetch failed, falling back to Supabase:', error);
      
      // Fall back to Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw userError;
      }
      
      return user;
    }
  }

  /**
   * Get user's remaining credits
   * @returns {Promise<number>} - Number of credits remaining
   */
  static async getCredits() {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/auth/credits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get credits');
    }

    return data.credits;
  }

  /**
   * Create a new API key
   * @param {string} name - Name for the API key
   * @param {string} expiresIn - Expiration period (e.g. '30', '90', 'never')
   * @returns {Promise<Object>} - Created API key data
   */
  static async createApiKey(name, expiresIn = 'never') {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name, expiresIn })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create API key');
    }

    return data;
  }

  /**
   * Get all API keys for the current user
   * @returns {Promise<Array>} - List of API keys
   */
  static async getApiKeys() {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch API keys');
    }

    return data.keys;
  }

  /**
   * Update API key (activate/deactivate)
   * @param {string} keyId - ID of the API key
   * @param {boolean} isActive - Whether the key should be active
   * @returns {Promise<Object>} - Update result
   */
  static async updateApiKey(keyId, isActive) {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ is_active: isActive })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update API key');
    }

    return data;
  }

  /**
   * Delete an API key
   * @param {string} keyId - ID of the API key
   * @returns {Promise<Object>} - Deletion result
   */
  static async deleteApiKey(keyId) {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete API key');
    }

    return data;
  }

  /**
   * Get API requests for a specific key
   * @param {string} keyId - ID of the API key
   * @param {number} limit - Maximum number of requests to return
   * @returns {Promise<Array>} - List of API requests
   */
  static async getApiRequests(keyId, limit = 50) {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}/requests?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch API requests');
    }

    return data.requests;
  }

  /**
   * Parse a PDF file using the API
   * @param {File} file - PDF file to parse
   * @param {string} apiKey - API key for authentication
   * @param {string} callbackUrl - Optional callback URL
   * @param {Object} additionalInfo - Optional additional information
   * @returns {Promise<Object>} - Parsing job information
   */
  static async parsePdf(file, apiKey, callbackUrl = null, additionalInfo = null) {
    const formData = new FormData();
    formData.append('file', file);
    
    if (callbackUrl) {
      formData.append('callback_url', callbackUrl);
    }

    if (additionalInfo) {
      formData.append('additional_info', JSON.stringify(additionalInfo));
    }
    
    const response = await fetch(`${config.apiBaseUrl}/parse-pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to parse PDF');
    }

    return data;
  }

  /**
   * Check parsing status
   * @param {string} requestId - ID of the parsing request
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Object>} - Status information
   */
  static async checkParsingStatus(requestId, apiKey) {
    const response = await fetch(`${config.apiBaseUrl}/parse-status/${requestId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to check parsing status');
    }

    return data;
  }

  /**
   * Verify API key
   * @param {string} apiKey - API key to verify
   * @returns {Promise<Object>} - Verification result
   */
  static async verifyApiKey(apiKey) {
    const response = await fetch(`${config.apiBaseUrl}/verify-key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify API key');
    }

    return data;
  }

  /**
   * Get current session
   * @returns {Promise<Object|null>} - Session object or null if not authenticated
   */
  static async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return session;
  }
}

export default ApiClient; 