import config from '../config';

// Global cache for frequently accessed data
const apiCache = {
  credits: {
    value: null,
    timestamp: 0,
    expiresIn: 60000, // 1 minute cache
    fetchInProgress: false
  },
  session: {
    value: null,
    timestamp: 0,
    expiresIn: 60000, // 1 minute cache
    fetchInProgress: false
  }
};

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
  async signup(email, password, fullName = null) {
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
  async login(email, password) {
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

    // Store auth token in localStorage for persistence
    if (data.session?.access_token) {
      localStorage.setItem('auth_token', data.session.access_token);
    }

    return data;
  }

  /**
   * User logout
   * @returns {Promise<Object>} - Logout result
   */
  async logout() {
    const sessionResponse = await this.getSession();
    
    if (sessionResponse.success && sessionResponse.session) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionResponse.session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error('API logout failed');
        }
      } catch (error) {
        console.error('API logout failed:', error);
      }
    }
    
    // Clear local storage token
    localStorage.removeItem('auth_token');
    
    return { success: true };
  }

  /**
   * Get current user with profile information
   * @returns {Promise<Object|null>} - User object or null if not authenticated
   */
  async getCurrentUser() {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session) {
      return null;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/auth/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionResponse.session.access_token}`
        }
      });

      const data = await this.handleApiResponse(response);

      return data.user;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Get user's remaining credits (cached version)
   * @param {boolean} forceRefresh - Whether to force a fresh API call
   * @returns {Promise<number>} - Number of credits remaining
   */
  async getCredits(forceRefresh = false) {
    // Check cache first if not forcing refresh
    const now = Date.now();
    if (!forceRefresh && 
        apiCache.credits.value !== null && 
        (now - apiCache.credits.timestamp) < apiCache.credits.expiresIn) {
      console.log('ApiClient: Using cached credits');
      return apiCache.credits.value;
    }
    
    // If there's already a fetch in progress, wait for it instead of making a duplicate call
    if (apiCache.credits.fetchInProgress) {
      console.log('ApiClient: Credits fetch already in progress, waiting...');
      // Wait for the existing fetch to complete (poll every 100ms)
      return new Promise((resolve) => {
        const checkCache = () => {
          if (!apiCache.credits.fetchInProgress) {
            resolve(apiCache.credits.value);
          } else {
            setTimeout(checkCache, 100);
          }
        };
        checkCache();
      });
    }

    try {
      // Mark that we're fetching
      apiCache.credits.fetchInProgress = true;
      console.log('ApiClient: Fetching fresh credits');
      
      const sessionResponse = await this.getSession();
      if (!sessionResponse.success || !sessionResponse.session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${config.apiBaseUrl}/auth/credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionResponse.session.access_token}`
        }
      });

      const data = await this.handleApiResponse(response);

      // Update cache
      apiCache.credits.value = data.credits;
      apiCache.credits.timestamp = now;
      
      // Trigger storage event to notify other components/tabs of credit update
      try {
        localStorage.setItem('credits_updated', Date.now().toString());
        localStorage.removeItem('credits_updated'); // Clean up immediately
      } catch (e) {
        // Ignore localStorage errors
      }
      
      return data.credits;
    } catch (error) {
      // If there's an error, pass it up but still clear the fetchInProgress flag
      throw error;
    } finally {
      // Always clear the fetch in progress flag
      apiCache.credits.fetchInProgress = false;
    }
  }

  /**
   * Invalidate specific cache entries
   * @param {string} cacheKey - The cache key to invalidate ('credits', 'session', 'requests', etc.)
   */
  invalidateCache(cacheKey) {
    if (apiCache[cacheKey]) {
      console.log(`ApiClient: Invalidating ${cacheKey} cache`);
      apiCache[cacheKey].value = null;
      apiCache[cacheKey].timestamp = 0;
      apiCache[cacheKey].fetchInProgress = false;
    }
  }

  /**
   * Create a new API key
   * @param {string} name - Name for the API key
   * @param {string} expiresIn - Expiration period (e.g. '30', '90', 'never')
   * @returns {Promise<Object>} - Created API key data
   */
  async createApiKey(name, expiresIn = 'never') {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionResponse.session.access_token}`
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
  async getApiKeys() {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionResponse.session.access_token}`
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
  async updateApiKey(keyId, isActive) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionResponse.session.access_token}`
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
  async deleteApiKey(keyId) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionResponse.session.access_token}`
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
  async getApiRequests(keyId, limit = 50) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${config.apiBaseUrl}/keys/${keyId}/requests?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionResponse.session.access_token}`
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
  async parsePdf(file, apiKey, callbackUrl = null, additionalInfo = null) {
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
  async checkParsingStatus(requestId, apiKey) {
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
  async verifyApiKey(apiKey) {
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
   * Invoke a backend function
   * @param {string} functionName - The name of the function to invoke
   * @param {Object} body - The payload to send to the function
   * @returns {Promise<Object>} - The result from the function
   */
  async invokeFunction(functionName, body) {
    const sessionResponse = await this.getSession();
    const session = sessionResponse.success ? sessionResponse.session : null;
    
    if (!session?.access_token) {
      // For publicly accessible functions or functions that handle their own auth,
      // we might proceed without a session token, but backend must be designed for this.
      // For now, let's assume most invoked functions require auth.
      // If a specific function is public, this check might need to be bypassed or handled differently.
      console.warn(`invokeFunction '${functionName}': No active session or access token. Proceeding without Authorization header.`);
      // Depending on backend setup, this might be an error or expected for some functions.
      // throw new Error('Authentication required to invoke function'); 
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/functions/${functionName}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      const responseData = await response.json();
      if (!response.ok) {
        // Log more details for easier debugging
        console.error(`Error invoking function ${functionName}:`, {
          status: response.status,
          statusText: response.statusText,
          body: responseData
        });
        throw new Error(responseData.error || responseData.message || `Failed to invoke function ${functionName}. Status: ${response.status}`);
      }
      return responseData; // Return the full response data object which should include { success, data, error, message }
    } catch (error) {
      console.error(`Network or other error invoking function ${functionName}:`, error);
      // Ensure a consistent error structure if possible, or re-throw
      throw new Error(error.message || `A network or unexpected error occurred while invoking ${functionName}.`);
    }
  }

  /**
   * Check if a JWT token is expired
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if token is expired
   */
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));
      
      // Check if token has expiration time
      if (!payload.exp) return false; // If no exp claim, assume it doesn't expire
      
      // Check if current time is past expiration (exp is in seconds, Date.now() is in milliseconds)
      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime >= payload.exp;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // If we can't parse it, assume it's expired
    }
  }

  /**
   * Handle API response and check for authentication errors
   * @param {Response} response - Fetch response object
   * @returns {Promise<Object>} - Parsed response data
   */
  async handleApiResponse(response) {
    const data = await response.json();
    
    // If we get a 401 (Unauthorized), the token is likely expired
    if (response.status === 401) {
      console.log('ApiClient: Received 401 response, clearing token and redirecting to login');
      localStorage.removeItem('auth_token');
      
      // If we're in a browser environment, redirect to login
      if (typeof window !== 'undefined' && window.location) {
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
          console.log('ApiClient: Redirecting to login page');
          window.location.href = '/login';
        }
      }
      
      throw new Error('Session expired. Please log in again.');
    }
    
    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }
    
    return data;
  }

  /**
   * Get credit cost per page for the current user's plan
   * @returns {Promise<number>} - Credit cost per page
   */
  async getCreditCostPerPage() {
    try {
      const sessionResponse = await this.getSession();
      if (sessionResponse.success) {
        return sessionResponse.credit_cost_per_page || 0.17; // Default to basic plan rate
      }
      return 0.17; // Default basic plan rate
    } catch (error) {
      console.error('Error getting credit cost per page:', error);
      return 0.17; // Default basic plan rate
    }
  }

  /**
   * Get user plan information
   * @returns {Promise<Object|null>} - User plan object or null if no active subscription
   */
  async getUserPlan() {
    try {
      const sessionResponse = await this.getSession();
      if (sessionResponse.success) {
        return sessionResponse.user_plan || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting user plan:', error);
      return null;
    }
  }

  /**
   * Calculate credit cost for PDF parsing based on page count and user's plan
   * @param {number} pageCount - Number of pages in the PDF
   * @returns {Promise<number>} - Total credit cost for parsing
   */
  async calculatePdfCreditCost(pageCount) {
    try {
      const costPerPage = await this.getCreditCostPerPage();
      return pageCount * costPerPage;
    } catch (error) {
      console.error('Error calculating PDF credit cost:', error);
      return pageCount * 0.17; // Default basic plan rate
    }
  }

  /**
   * Get current session
   * @returns {Promise<Object|null>} - Session object or null if not authenticated
   */
  async getSession() {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        return { success: false, error: 'No token found' };
      }
      
      // Check if token is expired before making API call
      if (this.isTokenExpired(token)) {
        console.log('ApiClient: Token expired, removing from localStorage');
        localStorage.removeItem('auth_token');
        return { success: false, error: 'Token expired' };
      }
      
      // Check cache first
      const now = Date.now();
      if (apiCache.session.value !== null && 
          (now - apiCache.session.timestamp) < apiCache.session.expiresIn) {
        console.log('ApiClient: Using cached session');
        return apiCache.session.value;
      }
      
      // If there's already a session fetch in progress, wait for it instead of making a duplicate call
      if (apiCache.session.fetchInProgress) {
        console.log('ApiClient: Session fetch already in progress, waiting...');
        // Wait for the existing fetch to complete (poll every 100ms)
        return new Promise((resolve) => {
          const checkCache = () => {
            if (!apiCache.session.fetchInProgress) {
              resolve(apiCache.session.value);
            } else {
              setTimeout(checkCache, 100);
            }
          };
          checkCache();
        });
      }
      
      try {
        // Mark that we're fetching
        apiCache.session.fetchInProgress = true;
        console.log('ApiClient: Validating session with backend');
        
        // Validate token with our backend
        const response = await fetch(`${config.apiBaseUrl}/auth/session`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = await response.json();
        let result;
        
        if (response.ok && data.success) {
          result = { 
            success: true, 
            session: data.session || { access_token: token },
            user_plan: data.user_plan || null,
            credit_cost_per_page: data.credit_cost_per_page || 0.17
          };
        } else {
          // If session is invalid, clear token and redirect to login
          localStorage.removeItem('auth_token');
          result = { success: false, error: 'Invalid or expired session' };
          
          // If we're in a browser environment, redirect to login
          if (typeof window !== 'undefined' && window.location) {
            // Only redirect if we're not already on the login page
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
        }
        
        // Update cache
        apiCache.session.value = result;
        apiCache.session.timestamp = now;
        
        return result;
      } catch (error) {
        console.error('Error getting session:', error);
        const result = { success: false, error: error.message };
        
        // Update cache with error result
        apiCache.session.value = result;
        apiCache.session.timestamp = now;
        
        return result;
      } finally {
        // Always clear the fetch in progress flag
        apiCache.session.fetchInProgress = false;
      }
    } catch (error) {
      console.error('Unexpected error in getSession:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Google sign in
   * @param {string} redirectUrl - Optional URL to redirect to after sign-in
   * @returns {Promise<Object>} - Sign in result with URL to redirect to
   */
  async googleSignIn(redirectUrl = null) {
    try {
      const response = await fetch(`${config.apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          redirectUrl: redirectUrl || window.location.origin 
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Google sign in failed');
      }

      return data; // contains { success: true, url: "..." }
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  }

  /**
   * Get all requests for the current user
   */
  async getRequests() {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session?.access_token) {
      throw new Error('Authentication required to get requests.');
    }
    const headers = {
      'Authorization': `Bearer ${sessionResponse.session.access_token}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${config.apiBaseUrl}/supabase/requests`, { headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error fetching requests: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get a specific request by ID
   */
  async getRequestById(id) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session?.access_token) {
      throw new Error('Authentication required to get request by ID.');
    }
    const headers = {
      'Authorization': `Bearer ${sessionResponse.session.access_token}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${config.apiBaseUrl}/supabase/requests/${id}`, { headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error fetching request by ID: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Create a new request
   */
  async createRequest(requestData) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session?.access_token) {
      throw new Error('Authentication required to create request.');
    }
    const headers = {
      'Authorization': `Bearer ${sessionResponse.session.access_token}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${config.apiBaseUrl}/supabase/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error creating request: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Update an existing request
   */
  async updateRequest(id, updateData) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session?.access_token) {
      throw new Error('Authentication required to update request.');
    }
    const headers = {
      'Authorization': `Bearer ${sessionResponse.session.access_token}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${config.apiBaseUrl}/supabase/requests/${id}`, {
      method: 'PUT', // Typically PUT or PATCH for updates
      headers,
      body: JSON.stringify(updateData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error updating request: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Delete a request (soft delete)
   */
  async deleteRequest(id) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session?.access_token) {
      throw new Error('Authentication required to delete request.');
    }
    const headers = {
      'Authorization': `Bearer ${sessionResponse.session.access_token}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${config.apiBaseUrl}/supabase/requests/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error deleting request: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(file, requestId) {
    const sessionResponse = await this.getSession();
    if (!sessionResponse.success || !sessionResponse.session?.access_token) {
      throw new Error('Authentication required to upload file.');
    }
    // For FormData, Content-Type is set by the browser. Do not set it manually.
    const headers = {
      'Authorization': `Bearer ${sessionResponse.session.access_token}`,
    };
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('requestId', requestId);
    
    const response = await fetch(`${config.apiBaseUrl}/supabase/upload`, { // Ensure this endpoint is correct
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error uploading file: ${response.status}`);
    }
    return response.json();
  }
}

export default new ApiClient(); 