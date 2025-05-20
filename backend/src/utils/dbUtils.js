import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

// Initialize Supabase client
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

/**
 * Store a webhook event in the database
 */
export const storeWebhookEvent = async (eventName, eventData) => {
  try {
    // Extract lemonsqueezy_id based on the event type
    let lemonsqueezyId = null;
    
    if (eventData.data) {
      if (eventName.includes('payment')) {
        // For payment events, the subscription ID is in attributes.subscription_id
        lemonsqueezyId = eventData.data.attributes?.subscription_id;
      } else {
        // For subscription events, the ID is directly in data.id
        lemonsqueezyId = eventData.data.id;
      }
    }
    
    if (!lemonsqueezyId) {
      console.warn(`Could not extract lemonsqueezy_id from ${eventName} event`);
    }
    
    const { error } = await supabase
      .from('webhook_events')
      .upsert({
        lemonsqueezy_id: lemonsqueezyId,
        event_name: eventName,
        event_data: eventData,
        processed: false,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'lemonsqueezy_id,event_name',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error storing webhook event:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error in storeWebhookEvent:', error);
    throw error;
  }
};

/**
 * Update subscription status in database
 */
export const updateSubscriptionStatus = async (lemonSqueezyId, status, data = {}) => {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status,
        lemonsqueezy_data: data,
        updated_at: new Date().toISOString()
      })
      .eq('lemonsqueezy_id', lemonSqueezyId);

    if (error) {
      console.error('Error updating subscription status:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateSubscriptionStatus:', error);
    throw error;
  }
};

/**
 * Create or update a subscription record
 */
export const createSubscriptionRecord = async (userId, variantId, lemonSqueezyId, status, data = {}) => {
  try {
    // Use upsert functionality (insert with on conflict)
    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          variant_id: variantId,
          lemonsqueezy_id: lemonSqueezyId,
          status,
          lemonsqueezy_data: data,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'lemonsqueezy_id',
          ignoreDuplicates: false
        }
      );

    if (error) {
      console.error('Error upserting subscription record:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error in createSubscriptionRecord:', error);
    throw error;
  }
};

/**
 * Get user credits
 */
export const getUserCredits = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      throw error;
    }

    return data.credits || 0;
  } catch (error) {
    console.error('Error in getUserCredits:', error);
    throw error;
  }
};

/**
 * Add credits to user
 */
export const addCreditsToUser = async (userId, creditsToAdd) => {
  try {
    // Get current credits
    const currentCredits = await getUserCredits(userId);
    
    // Update with new credits
    const { error } = await supabase
      .from('profiles')
      .update({
        credits: currentCredits + creditsToAdd
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user credits:', error);
      throw error;
    }

    return { success: true, newTotal: currentCredits + creditsToAdd };
  } catch (error) {
    console.error('Error in addCreditsToUser:', error);
    throw error;
  }
};

/**
 * Get credits for a subscription variant
 */
export const getCreditsForVariant = async (variantId) => {
  // Return credits based on variant ID from config
  if (variantId === config.lemonSqueezy.basicVariantId) {
    return 10; // Basic plan: 10 credits
  } else if (variantId === config.lemonSqueezy.proVariantId) {
    return 60; // Pro plan: 60 credits
  } else if (variantId === config.lemonSqueezy.premiumVariantId) {
    return 150; // Premium plan: 150 credits
  }
  
  return 0; // Default: 0 credits
}; 