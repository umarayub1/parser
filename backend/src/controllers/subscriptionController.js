import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import crypto from 'crypto';
import { createCheckoutSession, getSubscriptionData, getUserSubscriptions, cancelUserSubscription } from '../services/lemonsqueezyService.js';
import { storeWebhookEvent, updateSubscriptionStatus, createSubscriptionRecord, addCreditsToUser, getCreditsForVariant, getUserCredits } from '../utils/dbUtils.js';

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
    
    // Generate a unique reference ID for this checkout
    // This will help link the pending subscription with the created one
    const checkoutReference = `checkout_${userId}_${Date.now()}`;

    // Call LemonSqueezy service to create checkout
    const { checkoutUrl, checkoutId } = await createCheckoutSession(
      config.lemonSqueezy.storeId,
      planId,
      userId,
      userData.email,
      successUrl,
      cancelUrl,
      checkoutReference // Pass the reference ID
    );

    // Create record in subscriptions table with pending status
    try {
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          variant_id: planId,
          status: 'pending',
          checkout_id: checkoutId,
          checkout_reference: checkoutReference, // Store the reference ID
          created_at: new Date().toISOString()
          // Don't include lemonsqueezy_id as it's not available yet
          // It will be added when the subscription_created webhook is received
        });

      if (insertError) {
        console.error('Error creating pending subscription record:', insertError);
        // Don't store pending subscription if lemonsqueezy_id is required
        // The subscription will be created when webhook is received
      }
    } catch (error) {
      console.error('Error creating pending subscription record:', error);
      // Continue with checkout even if this fails
    }

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
 * Get subscription status for a user - only returns active subscriptions
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

    // Fetch only active subscriptions from database first
    const { data: localSubscription, error: localError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no active subscription found, return null
    if (localError && localError.code !== 'PGRST116') {
      throw localError;
    }

    if (!localSubscription) {
      return res.status(200).json({
        success: true,
        subscription: null
      });
    }

    // If we have a local subscription with a Lemon Squeezy ID, get latest data
    let subscriptionData = localSubscription;
    
    if (localSubscription?.lemonsqueezy_id) {
      try {
        // Get latest data from Lemon Squeezy
        const lemonSqueezyData = await getSubscriptionData(localSubscription.lemonsqueezy_id);
        
        // Update local record with latest status
        if (lemonSqueezyData) {
          const lsStatus = lemonSqueezyData.data.attributes.status;
          
          // Only return subscription if it's still active in Lemon Squeezy
          if (['active', 'on_trial', 'past_due'].includes(lsStatus)) {
            // Update our local reference
            subscriptionData = {
              ...localSubscription,
              status: lsStatus,
              lemonsqueezy_data: lemonSqueezyData.data
            };
          } else {
            // Subscription is no longer active, return null
            return res.status(200).json({
              success: true,
              subscription: null
            });
          }
        }
      } catch (error) {
        console.error('Error getting updated subscription data:', error);
        // Continue with local data if it's still considered active
      }
    }

    return res.status(200).json({
      success: true,
      subscription: subscriptionData
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
      // Get signature header - LemonSqueezy uses 'x-signature' consistently
      const signatureHeader = req.headers['x-signature'];
      
      if (!signatureHeader) {
        console.error('Webhook signature verification failed: Missing signature header');
        return res.status(401).json({
          success: false,
          error: 'Missing signature header'
        });
      }
      
      // Verify signature
      try {
        // Calculate the digest
        const hmac = crypto.createHmac('sha256', config.lemonSqueezy.webhookSecret);
        const calculatedDigest = hmac.update(req.rawBody).digest('hex');
        
        // Simple string comparison instead of Buffer conversion
        if (calculatedDigest !== signatureHeader) {
          console.error('Webhook signature verification failed: Invalid signature');
          return res.status(401).json({
            success: false,
            error: 'Invalid signature'
          });
        }
      } catch (error) {
        console.error('Error verifying webhook signature:', error);
        return res.status(401).json({
          success: false,
          error: 'Error verifying signature'
        });
      }
    }

    const { meta, data } = req.body;
    
    // Log webhook event for debugging
    console.log(`Received webhook event: ${meta.event_name}, ID: ${data?.id}`);
    
    // Store the webhook event in the database
    await storeWebhookEvent(meta.event_name, req.body);
    
    // Handle different webhook event types
    switch (meta.event_name) {
      case 'subscription_created':
        await handleSubscriptionCreated(data, meta.custom_data?.user_id);
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
        await handlePaymentSuccess(data, meta.custom_data?.user_id);
        break;
        
      case 'subscription_payment_failed':
        await handlePaymentFailed(data);
        break;
        
      default:
        // Log unsupported event
        console.log(`Received unsupported webhook event: ${meta.event_name}`);
    }
    
    // Return success when everything is processed correctly
    return res.status(200).json({
      success: true
    });
    
  } catch (error) {
    console.error('Error handling webhook:', error);
    
    // Log the webhook event as failed for manual review
    try {
      await storeWebhookEvent(
        req.body.meta?.event_name || 'unknown_event', 
        req.body,
        true, // Mark as processing_failed
        error.message
      );
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }
    
    // Return 202 to acknowledge receipt but indicate issues (avoids infinite retries)
    return res.status(202).json({
      success: false,
      message: 'Webhook received but had processing error',
      error_id: Date.now().toString() // Unique ID for tracking error in logs
    });
  }
};

/**
 * Retry failed webhook events
 * This function can be called periodically to retry failed webhook events
 */
export const retryFailedWebhooks = async (req, res) => {
  try {
    // Get failed webhook events from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: failedEvents, error } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processing_failed', true)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: true })
      .limit(10); // Process max 10 at a time
      
    if (error) {
      throw error;
    }
    
    if (!failedEvents || failedEvents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No failed webhooks to retry'
      });
    }
    
    const results = [];
    
    for (const event of failedEvents) {
      try {
        console.log(`Retrying webhook event: ${event.event_name}, ID: ${event.id}`);
        
        const { meta, data } = event.event_data;
        
        // Process the webhook event
        switch (meta.event_name) {
          case 'subscription_created':
            await handleSubscriptionCreated(data, meta.custom_data?.user_id || event.user_id);
            break;
          case 'subscription_payment_success':
            await handlePaymentSuccess(data, meta.custom_data?.user_id || event.user_id);
            break;
          // Add other cases as needed
        }
        
        // Mark as processed
        await supabase
          .from('webhook_events')
          .update({
            processing_failed: false,
            processed: true,
            error_message: null
          })
          .eq('id', event.id);
          
        results.push({ id: event.id, status: 'success' });
      } catch (error) {
        console.error(`Failed to retry webhook ${event.id}:`, error);
        results.push({ id: event.id, status: 'failed', error: error.message });
      }
    }
    
    return res.status(200).json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('Error retrying failed webhooks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retry webhooks'
    });
  }
};

/**
 * Validate subscription integrity
 * Checks for any subscription inconsistencies and fixes them
 */
export const validateSubscriptions = async (req, res) => {
  try {
    // Get all active subscriptions
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .in('status', ['active', 'on_trial', 'past_due']);
      
    if (error) {
      throw error;
    }
    
    const validationResults = [];
    
    for (const subscription of subscriptions) {
      const issues = [];
      
      // Check if user has correct credits
      if (subscription.status === 'active') {
        try {
          const credits = await getUserCredits(subscription.user_id);
          if (credits === 0) {
            issues.push('User has no credits despite active subscription');
          }
        } catch (error) {
          issues.push(`Failed to check user credits: ${error.message}`);
        }
      }
      
      // Check if subscription exists in Lemon Squeezy
      if (subscription.lemonsqueezy_id) {
        try {
          const lsData = await getSubscriptionData(subscription.lemonsqueezy_id);
          if (lsData.data.attributes.status !== subscription.status) {
            issues.push(`Status mismatch: DB=${subscription.status}, LS=${lsData.data.attributes.status}`);
          }
        } catch (error) {
          issues.push(`Failed to verify with Lemon Squeezy: ${error.message}`);
        }
      }
      
      if (issues.length > 0) {
        validationResults.push({
          subscription_id: subscription.id,
          lemonsqueezy_id: subscription.lemonsqueezy_id,
          user_id: subscription.user_id,
          issues
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      total_subscriptions: subscriptions.length,
      issues_found: validationResults.length,
      validation_results: validationResults
    });
    
  } catch (error) {
    console.error('Error validating subscriptions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate subscriptions'
    });
  }
};

// Webhook event handlers

async function handleSubscriptionCreated(data, userId) {
  try {
    const attributes = data.attributes;
    const variantId = attributes.variant_id;
    const lemonsqueezyId = data.id;
    
    // Validate that we have the essential data
    if (!lemonsqueezyId) {
      throw new Error('Missing lemonsqueezy_id in subscription data');
    }
    
    if (!variantId) {
      throw new Error('Missing variant_id in subscription data');
    }
    
    // Verify we have a valid userId
    if (!userId) {
      userId = await getUserIdFromSubscription(lemonsqueezyId, variantId);
    }
    
    if (!userId) {
      throw new Error(`Cannot locate user ID for subscription ${lemonsqueezyId}`);
    }

    // Extract checkout reference from custom data if available
    const checkoutReference = data.attributes?.custom_data?.checkout_reference;
    
    // First try to find a pending subscription with the same checkout_reference
    let pendingSubscription = null;
    let pendingError = null;
    
    if (checkoutReference) {
      const pendingResult = await supabase
        .from('subscriptions')
        .select('*')
        .eq('checkout_reference', checkoutReference)
        .eq('status', 'pending')
        .maybeSingle();
      
      pendingSubscription = pendingResult.data;
      pendingError = pendingResult.error;
      
      if (pendingError) {
        console.error(`Error checking for pending subscription by reference: ${pendingError.message}`);
      }
      
      if (pendingSubscription) {
        console.log(`Found pending subscription with reference ${checkoutReference}, updating with lemonsqueezy_id ${lemonsqueezyId}`);
      }
    }
    
    // If no pending subscription found by reference, try to find by user_id and variant_id
    if (!pendingSubscription) {
      const pendingResult = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('variant_id', variantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .maybeSingle();
      
      pendingSubscription = pendingResult.data;
      pendingError = pendingResult.error;
      
      if (pendingError) {
        console.error(`Error checking for pending subscription by user and variant: ${pendingError.message}`);
      }
      
      if (pendingSubscription) {
        console.log(`Found pending subscription for user ${userId} and variant ${variantId}, updating with lemonsqueezy_id ${lemonsqueezyId}`);
      }
    }
    
    // If we found a pending subscription, update it instead of creating a new one
    if (pendingSubscription) {
      // Update the existing subscription with the lemonsqueezy_id and new status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          lemonsqueezy_id: lemonsqueezyId,
          status: attributes.status,
          lemonsqueezy_data: data,
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingSubscription.id);
        
      if (updateError) {
        console.error(`Error updating pending subscription: ${updateError.message}`);
        // Continue with normal flow as fallback
      } else {
        console.log(`Successfully updated pending subscription to created status`);
        // Continue with the rest of the function to handle active status, credits, etc.
      }
    }
    
    // Get current subscriptions for this user (excluding the pending one we may have just updated)
    const { data: existingSubscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial'])
      .neq('lemonsqueezy_id', lemonsqueezyId) // Don't include the current subscription
      .order('created_at', { ascending: false });
      
    if (error) {
      throw new Error(`Failed to check existing subscriptions: ${error.message}`);
    }
    
    // Handle multiple active subscriptions - cancel old ones if needed
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      console.log(`User ${userId} has ${existingSubscriptions.length} active subscription(s)`);
      
      for (const sub of existingSubscriptions) {
        // Don't cancel the current subscription
        if (sub.lemonsqueezy_id !== lemonsqueezyId) {
          console.log(`User ${userId} already has an active subscription. Cancelling old subscription ${sub.lemonsqueezy_id}`);
          try {
            // Check if the old subscription is from Lemon Squeezy
            if (sub.lemonsqueezy_id && typeof sub.lemonsqueezy_id === 'string' && sub.lemonsqueezy_id.startsWith('sub_')) {
              // Try to cancel in Lemon Squeezy first
              try {
                await cancelUserSubscription(sub.lemonsqueezy_id);
                console.log(`Successfully cancelled subscription ${sub.lemonsqueezy_id} in Lemon Squeezy`);
              } catch (cancelLSError) {
                console.error(`Failed to cancel subscription in Lemon Squeezy: ${cancelLSError.message}`);
                // Continue and update our database anyway
              }
            }
            
            // Mark old subscription as superseded in our database
            await updateSubscriptionStatus(
              sub.lemonsqueezy_id,
              'superseded',
              { superseded_by: lemonsqueezyId }
            );
          } catch (cancelError) {
            console.error(`Failed to update old subscription status: ${cancelError.message}`);
          }
        }
      }
    }
    
    // Create or update the subscription record
    // Only create a new record if we didn't find and update a pending subscription
    if (!pendingSubscription || pendingSubscription.lemonsqueezy_id !== lemonsqueezyId) {
      await createSubscriptionRecord(
        userId,
        variantId,
        lemonsqueezyId,
        attributes.status,
        data
      );
    }
    
    // If subscription is active or on trial, add initial credits
    if (attributes.status === 'active' || attributes.status === 'on_trial') {
      // Get plan details from config to ensure credits are consistent
      const planConfig = getPlanConfigByVariantId(variantId);
      
      if (planConfig && planConfig.credits > 0) {
        // Check if this is an upgrade, prorate credits if needed
        if (existingSubscriptions && existingSubscriptions.length > 0) {
          await handlePlanUpgrade(userId, existingSubscriptions[0], planConfig);
        } else {
          // Standard credit allocation for new subscription
          await addCreditsToUser(userId, planConfig.credits);
          
          // Record the initial credit transaction
          await supabase
            .from('credit_transactions')
            .insert({
              user_id: userId,
              amount: planConfig.credits,
              subscription_id: lemonsqueezyId,
              description: `Initial credits for ${planConfig.name || 'subscription'}`,
              created_at: new Date().toISOString()
            });
        }
      } else {
        console.warn(`No plan configuration found for variant ${variantId}`);
      }
    }
  } catch (error) {
    console.error('Error handling subscription created webhook:', error);
    throw error; // Rethrow to trigger error handling higher up
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
    // Validate input data
    if (!data || !data.attributes) {
      throw new Error('Invalid payment success data: missing attributes');
    }
    
    // Ensure we're using lemonsqueezy_id (subscription_id) for subscription identification
    const lemonsqueezyId = data.attributes.subscription_id;
    
    if (!lemonsqueezyId) {
      throw new Error('Payment success webhook missing subscription_id');
    }
    
    // First, update subscription status
    await updateSubscriptionStatus(
      lemonsqueezyId,
      'active',
      data
    );
    
    // Verify we have a valid userId
    if (!userId) {
      userId = await getUserIdFromSubscription(lemonsqueezyId);
      if (!userId) {
        throw new Error(`Cannot locate user ID for subscription ${lemonsqueezyId}`);
      }
    }
    
    // Get subscription data to find variant
    const subscription = await getSubscriptionData(lemonsqueezyId);
    
    if (!subscription || !subscription.data) {
      throw new Error(`Could not fetch subscription data for ${lemonsqueezyId}`);
    }
    
    // Fix: The response from getSubscriptionData already includes the data layer
    const attributes = subscription.data.attributes;
    const variantId = attributes.variant_id;
    
    if (!variantId) {
      throw new Error(`No variant ID found for subscription ${lemonsqueezyId}`);
    }

    // Get plan configuration
    const planConfig = getPlanConfigByVariantId(variantId);
    
    if (!planConfig) {
      throw new Error(`No plan configuration found for variant ${variantId}`);
    }
    
    // Determine if this is a recurring payment or initial payment
    const isRecurring = data.attributes.order_number && data.attributes.order_number.includes('RENEWAL');
    
    // For renewals - add the regular credit amount
    if (isRecurring) {
      // Check if it's yearly or monthly subscription
      const isYearly = attributes.variant_name && 
                      (attributes.variant_name.toLowerCase().includes('year') || 
                       attributes.variant_name.toLowerCase().includes('annual'));
      
      if (isYearly) {
        // For yearly plans, add one month's worth of credits each month
        // Store the last credit allocation date to prevent duplicates
        const { data: lastCreditData } = await supabase
          .from('credit_transactions')
          .select('created_at')
          .eq('user_id', userId)
          .eq('subscription_id', lemonsqueezyId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        const lastCreditDate = lastCreditData && lastCreditData[0] ? new Date(lastCreditData[0].created_at) : null;
        const now = new Date();
        
        // If last credit was added less than 25 days ago, skip
        if (lastCreditDate && ((now - lastCreditDate) / (1000 * 60 * 60 * 24)) < 25) {
          console.log(`Skipping credit allocation for yearly plan - credits were recently added on ${lastCreditDate}`);
          return;
        }
        
        await addCreditsToUser(userId, planConfig.credits);
        
        // Record the credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: planConfig.credits,
            subscription_id: lemonsqueezyId,
            description: `Monthly credit allocation for yearly ${planConfig.name || 'subscription'}`,
            created_at: now.toISOString()
          });
        
      } else {
        // Monthly plan renewal
        await addCreditsToUser(userId, planConfig.credits);
        
        // Record the credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: planConfig.credits,
            subscription_id: lemonsqueezyId,
            description: `Monthly renewal for ${planConfig.name || 'subscription'}`,
            created_at: new Date().toISOString()
          });
      }
    } else {
      // Initial payment is handled by the subscription_created event,
      // but we'll add credits here as a backup in case that event was missed
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('created_at')
        .eq('lemonsqueezy_id', lemonsqueezyId)
        .single();
        
      const isNewSubscription = !existingSubscription || 
        (new Date() - new Date(existingSubscription.created_at)) / (1000 * 60) < 10; // Created within last 10 minutes
        
      if (isNewSubscription) {
        await addCreditsToUser(userId, planConfig.credits);
        
        // Record the credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: planConfig.credits,
            subscription_id: lemonsqueezyId,
            description: `Initial credits for ${planConfig.name || 'subscription'}`,
            created_at: new Date().toISOString()
          });
      }
    }
  } catch (error) {
    console.error('Error handling payment success webhook:', error);
    throw error; // Rethrow to trigger webhook error handling
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

// Helper functions for subscription management

/**
 * Get user ID from subscription data or database
 */
async function getUserIdFromSubscription(subscriptionId, variantId) {
  try {
    // First try to find subscription in our database
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('lemonsqueezy_id', subscriptionId)
      .single();
      
    if (data && data.user_id) {
      return data.user_id;
    }
    
    // If not found, try to get it from LemonSqueezy API
    const subscription = await getSubscriptionData(subscriptionId);
    
    if (subscription?.data?.attributes?.custom_data?.user_id) {
      return subscription.data.attributes.custom_data.user_id;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user ID from subscription:', error);
    return null;
  }
}

/**
 * Get plan configuration by variant ID
 */
function getPlanConfigByVariantId(variantId) {
  // Check if plans array exists and is iterable
  if (config.lemonSqueezy.plans && Array.isArray(config.lemonSqueezy.plans)) {
    // Find the plan in config
    for (const plan of config.lemonSqueezy.plans) {
      if (parseInt(plan.variantId, 10) === parseInt(variantId, 10)) {
        return plan;
      }
    }
  }
  
  // Fallback to hardcoded values if plan not found in config
  if (variantId === config.lemonSqueezy.basicVariantId) {
    return { credits: 10, name: 'Basic Plan' };
  } else if (variantId === config.lemonSqueezy.proVariantId) {
    return { credits: 60, name: 'Pro Plan' };
  } else if (variantId === config.lemonSqueezy.premiumVariantId) {
    return { credits: 150, name: 'Premium Plan' };
  }
  
  return null;
}

/**
 * Handle plan upgrade/downgrade with credit proration
 */
async function handlePlanUpgrade(userId, oldSubscription, newPlanConfig) {
  try {
    // Get current user credits
    const currentCredits = await getUserCredits(userId);
    
    // Get old plan configuration
    const oldPlanConfig = getPlanConfigByVariantId(oldSubscription.variant_id);
    
    if (!oldPlanConfig) {
      // If old plan not found, just add new credits
      return await addCreditsToUser(userId, newPlanConfig.credits);
    }
    
    // Calculate remaining time in billing period for old subscription
    const oldEndDate = new Date(oldSubscription.renews_at || oldSubscription.ends_at);
    const now = new Date();
    const totalDaysInPeriod = 30; // Assume 30-day billing cycle
    
    let remainingDays = 0;
    if (oldEndDate > now) {
      const msRemaining = oldEndDate.getTime() - now.getTime();
      remainingDays = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    }
    
    // Prorate old subscription credits
    const proratedOldCredits = Math.round((remainingDays / totalDaysInPeriod) * oldPlanConfig.credits);
    
    // Add difference between old prorated credits and new full credits
    const creditAdjustment = newPlanConfig.credits - proratedOldCredits;
    
    if (creditAdjustment !== 0) {
      await addCreditsToUser(userId, creditAdjustment);
      
      // Log the adjustment
      console.log(`Plan change for user ${userId}: Adjusted credits by ${creditAdjustment} (new: ${newPlanConfig.credits}, old prorated: ${proratedOldCredits})`);
      
      // Store record of adjustment in database
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: creditAdjustment,
          description: `Plan change: ${oldPlanConfig.name || 'Previous plan'} to ${newPlanConfig.name || 'New plan'}`,
          created_at: new Date().toISOString()
        });
    }
    
    return { success: true, adjustment: creditAdjustment };
  } catch (error) {
    console.error('Error handling plan upgrade:', error);
    throw error;
  }
} 