import { supabase } from '../supabaseClient';
import config from '../config';

class ApiClient {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
  }

  // Helper method to get the current session token
  async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${session?.access_token || ''}`,
      'Content-Type': 'application/json',
    };
  }

  // Helper method to handle API responses
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    return response.json();
  }

  // Get all requests for the current user
  async getRequests() {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/supabase/requests`, { headers });
    return this.handleResponse(response);
  }

  // Get a specific request by ID
  async getRequestById(id) {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/supabase/requests/${id}`, { headers });
    return this.handleResponse(response);
  }

  // Create a new request
  async createRequest(requestData) {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/supabase/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestData),
    });
    return this.handleResponse(response);
  }

  // Update an existing request
  async updateRequest(id, updateData) {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/supabase/requests/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData),
    });
    return this.handleResponse(response);
  }

  // Delete a request (soft delete)
  async deleteRequest(id) {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/supabase/requests/${id}`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse(response);
  }

  // Upload a file to storage
  async uploadFile(file, requestId) {
    const headers = await this.getAuthHeader();
    // Remove Content-Type as it will be set automatically for FormData
    delete headers['Content-Type'];
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('requestId', requestId);
    
    const response = await fetch(`${this.baseUrl}/supabase/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return this.handleResponse(response);
  }

  // Invoke a Supabase Edge Function
  async invokeFunction(functionName, body) {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/supabase/functions/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }
}

export default new ApiClient(); 