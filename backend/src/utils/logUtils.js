import supabase from '../services/supabase.js';

/**
 * Log API request details
 */
export async function logApiRequest(
  apiKeyId,
  userId,
  endpoint,
  method,
  statusCode,
  responseTime,
  requestIp,
  requestBody,
  responseBody,
  errorMessage
) {
  try {
    await supabase.from('api_requests').insert({
      api_key_id: apiKeyId,
      user_id: userId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTime,
      request_ip: requestIp,
      request_body: requestBody,
      response_body: responseBody,
      error_message: errorMessage
    });
  } catch (error) {
    console.error('Error logging API request:', error);
  }
} 