import config from '../config';

const API_BASE_URL = config.apiBaseUrl;

/**
 * Submit a support request
 */
export const submitSupportRequest = async (supportData) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if user is logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/support`, {
      method: 'POST',
      headers,
      body: JSON.stringify(supportData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit support request');
    }

    return data;
  } catch (error) {
    console.error('Error submitting support request:', error);
    throw error;
  }
};

/**
 * Get user's support requests (requires authentication)
 */
export const getUserSupportRequests = async () => {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authorization header for authenticated requests
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/support`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch support requests');
    }

    return data;
  } catch (error) {
    console.error('Error fetching support requests:', error);
    throw error;
  }
}; 