import config from '../config';
import apiClient from '../components/ApiClient.js';

class LemonSqueezyService {
  // Initialize checkout for a specific subscription plan
  async initializeCheckout(planId, userId) {
    try {
      // Call our backend API that will handle the LemonSqueezy integration
      const response = await fetch(`${config.apiBaseUrl}/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          planId,
          userId,
          successUrl: `${window.location.origin}/subscription?status=success`,
          cancelUrl: `${window.location.origin}/subscription?status=cancelled`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize checkout');
      }

      return data;
    } catch (error) {
      console.error('Error initializing LemonSqueezy checkout:', error);
      throw error;
    }
  }

  // Get current subscription status for a user
  async getSubscriptionStatus(userId) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/subscriptions/status/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch subscription status');
      }

      return data.subscription;
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw error;
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscriptionId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      return data;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  // Handle webhook data (this would be called by our backend)
  async handleWebhookData(eventData) {
    // This would normally be handled by the backend
    // Client-side code would just refresh the UI based on updated data
    return { success: true };
  }
}

export default new LemonSqueezyService(); 