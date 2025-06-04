import { lemonSqueezySetup, createCheckout as lsCreateCheckout, getSubscription, updateSubscription, listSubscriptions, listWebhooks, createWebhook } from '@lemonsqueezy/lemonsqueezy.js';
import config from '../config/index.js';

// Initialize Lemon Squeezy with API key
lemonSqueezySetup({
  apiKey: config.lemonSqueezy.apiKey,
  onError: (error) => console.error('Lemon Squeezy Error:', error)
});

/**
 * Create a checkout for a subscription
 */
export const createCheckoutSession = async (storeId, variantId, userId, userEmail, successUrl, cancelUrl, checkoutReference) => {
  try {
    const response = await lsCreateCheckout(storeId, variantId, {
      checkoutData: {
        email: userEmail,
        custom: {
          user_id: userId,
          checkout_reference: checkoutReference
        }
      },
      productOptions: {
        redirectUrl: successUrl
      },
      checkoutOptions: {
        embed: false,
        media: true,
        logo: true,
        desc: true,
        discount: true,
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      testMode: process.env.NODE_ENV !== 'production'
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return {
      checkoutUrl: response.data.data.attributes.url,
      checkoutId: response.data.data.id
    };
  } catch (error) {
    console.error('Error creating checkout:', error);
    throw error;
  }
};

/**
 * Get subscription data
 */
export const getSubscriptionData = async (subscriptionId) => {
  try {
    const response = await getSubscription(subscriptionId);
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error getting subscription:', error);
    throw error;
  }
};

/**
 * Get user subscriptions by email
 */
export const getUserSubscriptions = async (userEmail) => {
  try {
    const response = await listSubscriptions({
      filter: {
        userEmail
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    throw error;
  }
};

/**
 * Cancel a subscription
 */
export const cancelUserSubscription = async (subscriptionId) => {
  try {
    const response = await updateSubscription(subscriptionId, {
      cancelled: true
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
};
