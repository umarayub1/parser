import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import crypto from 'crypto';
import { createCheckoutSession, getSubscriptionData, getUserSubscriptions, cancelUserSubscription } from '../services/lemonsqueezyService.js';
import { storeWebhookEvent, updateSubscriptionStatus, createSubscriptionRecord, addCreditsToUser, getCreditsForVariant } from '../utils/dbUtils.js';

// Initialize Supabase client
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

/**
 * Create a checkout session with LemonSqueezy for subscription
 */
export const createCheckout = async (req, res) => {
  try {
    const { planId, userId, successUrl, cancelUrl } = req.body;
    
    if (!planId || !userId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify the user exists
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Call LemonSqueezy service to create checkout
    const { checkoutUrl, checkoutId } = await createCheckoutSession(
      config.lemonSqueezy.storeId,
      planId,
      userId,
      userData.email,
      successUrl,
      cancelUrl
    );

    // Create record in subscriptions table with pending status
    // const { error: insertError } = await supabase
    //   .from('subscriptions')
    //   .insert({
    //     user_id: userId,
    //     variant_id: planId,
    //     status: 'pending',
    //     checkout_id: checkoutId
    //   });

    // if (insertError) {
    //   console.error('Error creating subscription record:', insertError);
    //   // Continue anyway as this is not critical for checkout
    // }

    return res.status(200).json({
      success: true,
      checkoutUrl
    });
    
  } catch (error) {
    console.error('Error creating checkout:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create checkout'
    });
  }
};

/**
 * Get subscription status for a user
 */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing user ID'
      });
    }


    // Fetch subscription from database first
    const { data: localSubscription, error: localError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If we have a local subscription with a Lemon Squeezy ID, get latest data
    let subscriptionData = localSubscription;
    
    if (localSubscription?.lemonsqueezy_id) {
      try {
        // Get latest data from Lemon Squeezy
        const lemonSqueezyData = await getSubscriptionData(localSubscription.lemonsqueezy_id);
        
        // Update local record with latest status
        if (lemonSqueezyData) {
          const lsStatus = lemonSqueezyData.data.attributes.status;
            
            // Update our local reference
            subscriptionData = {
              ...localSubscription,
              status: lsStatus,
              lemonsqueezy_data: lemonSqueezyData.data
          }
        }
      } catch (error) {
        console.error('Error getting updated subscription data:', error);
        // Continue with local data
      }
    }

    return res.status(200).json({
      success: true,
      subscription: subscriptionData || null
    });
    
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
};

/**
 * Cancel a subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing subscription ID'
      });
    }

    // Cancel subscription with Lemon Squeezy
    await cancelUserSubscription(subscriptionId);

    // Update subscription in database
    await updateSubscriptionStatus(subscriptionId, 'canceled');

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
};

/**
 * Handle LemonSqueezy webhooks
 * Verifies webhook signature using the raw request body
 * Requires the raw-body package for request body capture
 */
export const handleLemonSqueezyWebhook = async (req, res) => {
  try {
    // Check if rawBody exists
    if (!req.rawBody) {
      console.error('Error: No raw body available for webhook signature verification');
      return res.status(500).json({
        success: false, 
        error: 'Internal server error: Raw body not available'
      });
    }
    
    // Verify webhook signature if secret is configured
    if (config.lemonSqueezy.webhookSecret) {
      // Try to find the signature header with various case formats
      const signatureHeader = req.headers['x-signature'] || 
                            req.headers['X-Signature'] || 
                            req.get('x-signature');
      
      if (!signatureHeader) {
        return res.status(401).json({
          success: false,
          error: 'Missing signature header'
        });
      }
      
      try {
        const signature = Buffer.from(signatureHeader, 'utf8');
        
        // Calculate the digest
        const hmac = crypto.createHmac('sha256', config.lemonSqueezy.webhookSecret);
        const calculatedDigest = hmac.update(req.rawBody).digest('hex');
        const digest = Buffer.from(calculatedDigest, 'utf8');
        
        // Use try/catch around timingSafeEqual to handle potential buffer length mismatches
        try {
          const signaturesMatch = crypto.timingSafeEqual(digest, signature);
          
          if (!signaturesMatch) {
            return res.status(401).json({
              success: false,
              error: 'Invalid signature'
            });
          }
        } catch (error) {
          console.error('Error verifying webhook signature:', error.message);
          return res.status(401).json({
            success: false,
            error: 'Error verifying signature'
          });
        }
      } catch (error) {
        console.error('Error processing webhook signature:', error.message);
        return res.status(401).json({
          success: false,
          error: 'Error processing signature'
        });
      }
    }

    const { meta, data } = req.body;
    
    // Store the webhook event in the database
    await storeWebhookEvent(meta.event_name, req.body);
    
    // Handle different webhook event types
    switch (meta.event_name) {
      case 'subscription_created':
        await handleSubscriptionCreated(data, meta.custom_data.user_id);
        break;
        
      case 'subscription_updated':
        await handleSubscriptionUpdated(data);
        break;
        
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(data);
        break;
        
      case 'subscription_resumed':
        await handleSubscriptionResumed(data);
        break;
        
      case 'subscription_expired':
        await handleSubscriptionExpired(data);
        break;
        
      case 'subscription_payment_success':
        await handlePaymentSuccess(data, meta.custom_data.user_id);
        break;
        
      case 'subscription_payment_failed':
        await handlePaymentFailed(data);
        break;
        
      default:
        // Log unsupported event
        console.log(`Received unsupported webhook event: ${meta.event_name}`);
    }
    
    // Always respond with success to acknowledge receipt
    return res.status(200).json({
      success: true
    });
    
  } catch (error) {
    console.error('Error handling webhook:', error);
    
    // Still return 200 to avoid webhook retries
    // but log the error for debugging
    return res.status(200).json({
      success: true,
      message: 'Webhook received but had processing error'
    });
  }
};

// Webhook event handlers

async function handleSubscriptionCreated(data, userId) {
  try {
    const attributes = data.attributes;
    const variantId = attributes.variant_id;
    // Ensure we're using lemonsqueezy_id (data.id) for subscription identification
    const lemonsqueezyId = data.id;
    
    // Create or update the subscription record
    if (userId) {
      await createSubscriptionRecord(
        userId,
        variantId,
        lemonsqueezyId,
        attributes.status,
        data
      );
      
      // If subscription is active or on trial, add initial credits
      if (attributes.status === 'active' || attributes.status === 'on_trial') {
        const credits = await getCreditsForVariant(variantId);
        if (credits > 0) {
          await addCreditsToUser(userId, credits);
        }
      }
    } else {
      console.warn('Cannot locate user ID in subscription webhook data');
    }
  } catch (error) {
    console.error('Error handling subscription created webhook:', error);
  }
}

async function handleSubscriptionUpdated(data) {
  try {
    // Ensure we're using lemonsqueezy_id (data.id) for subscription identification
    const lemonsqueezyId = data.id;
    
    // Update status in database
    await updateSubscriptionStatus(
      lemonsqueezyId,
      data.attributes.status,
      data
    );
  } catch (error) {
    console.error('Error handling subscription updated webhook:', error);
  }
}

async function handleSubscriptionCancelled(data) {
  try {
    // Ensure we're using lemonsqueezy_id (data.id) for subscription identification
    const lemonsqueezyId = data.id;
    
    // Update status in database
    await updateSubscriptionStatus(
      lemonsqueezyId,
      'canceled',
      data
    );
  } catch (error) {
    console.error('Error handling subscription cancelled webhook:', error);
  }
}

async function handleSubscriptionResumed(data) {
  try {
    // Ensure we're using lemonsqueezy_id (data.id) for subscription identification
    const lemonsqueezyId = data.id;
    
    // Update status in database
    await updateSubscriptionStatus(
      lemonsqueezyId,
      'active',
      data
    );
  } catch (error) {
    console.error('Error handling subscription resumed webhook:', error);
  }
}

async function handleSubscriptionExpired(data) {
  try {
    // Ensure we're using lemonsqueezy_id (data.id) for subscription identification
    const lemonsqueezyId = data.id;
    
    // Update status in database
    await updateSubscriptionStatus(
      lemonsqueezyId,
      'expired',
      data
    );
  } catch (error) {
    console.error('Error handling subscription expired webhook:', error);
  }
}

async function handlePaymentSuccess(data, userId) {
  try {
    // Ensure we're using lemonsqueezy_id (subscription_id) for subscription identification
    const lemonsqueezyId = data.attributes.subscription_id;
    
    // First, update subscription status
    await updateSubscriptionStatus(
      lemonsqueezyId,
      'active',
      data
    );
    
    // Then, get subscription data to find variant
    const subscription = await getSubscriptionData(lemonsqueezyId);
    
    if (subscription && subscription.data) {
      const attributes = subscription.data.data.attributes;
      const variantId = attributes.variant_id;
      
      if (userId) {
        // Add credits to the user account
        const credits = await getCreditsForVariant(variantId);
        if (credits > 0) {
          await addCreditsToUser(userId, credits);
        }
      }
    }
  } catch (error) {
    console.error('Error handling payment success webhook:', error);
  }
}

async function handlePaymentFailed(data) {
  try {
    // Ensure we're using lemonsqueezy_id (subscription_id) for subscription identification
    const lemonsqueezyId = data.attributes.subscription_id;
    
    // Update status in database
    await updateSubscriptionStatus(
      lemonsqueezyId,
      'past_due',
      data
    );
  } catch (error) {
    console.error('Error handling payment failed webhook:', error);
  }
} 