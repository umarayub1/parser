import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

// Initialize Supabase client
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

/**
 * Store a webhook event in the database
 * @param {string} eventName - The name of the event
 * @param {object} eventData - The event data payload
 * @param {boolean} processingFailed - Flag to indicate if processing failed
 * @param {string} errorMessage - Error message if processing failed
 */
export const storeWebhookEvent = async (eventName, eventData, processingFailed = false, errorMessage = null) => {
  try {
    // Extract lemonsqueezy_id based on the event type
    let lemonsqueezyId = null;
    let userId = null;
    
    if (eventData.data) {
      if (eventName.includes('payment')) {
        // For payment events, the subscription ID is in attributes.subscription_id
        lemonsqueezyId = eventData.data.attributes?.subscription_id;
      } else {
        // For subscription events, the ID is directly in data.id
        lemonsqueezyId = eventData.data.id;
      }
    }
    
    // Try to extract user_id from custom_data
    if (eventData.meta?.custom_data?.user_id) {
      userId = eventData.meta.custom_data.user_id;
    }
    
    if (!lemonsqueezyId) {
      console.warn(`Could not extract lemonsqueezy_id from ${eventName} event`);
    }
    
    // Generate unique event ID for de-duplication
    const eventId = `${lemonsqueezyId || 'unknown'}-${eventName}-${Date.now()}`;
    
    const { error } = await supabase
      .from('webhook_events')
      .upsert({
        id: eventId,
        lemonsqueezy_id: lemonsqueezyId,
        event_name: eventName,
        event_data: eventData,
        user_id: userId,
        processed: !processingFailed,
        processing_failed: processingFailed,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error storing webhook event:', error);
      throw error;
    }

    return { success: true, eventId };
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
export const createSubscriptionRecord = async (userId, variantId, lemonsqueezyId, status, data) => {
  try {
    // First, check if this subscription already exists
    const { data: existingSubscription, error: checkError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('lemonsqueezy_id', lemonsqueezyId)
      .maybeSingle();
      
    if (checkError) {
      console.error('Error checking for existing subscription:', checkError);
    }
    
    // If subscription exists, update it
    if (existingSubscription) {
      console.log(`Updating existing subscription: ${lemonsqueezyId}`);
      
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status,
          lemonsqueezy_data: data,
          updated_at: new Date().toISOString()
        })
        .eq('lemonsqueezy_id', lemonsqueezyId);
        
      if (updateError) {
        console.error('Error updating subscription record:', updateError);
        throw updateError;
      }
      
      return existingSubscription.id;
    }
    
    // Otherwise create a new record
    const { data: newSubscription, error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        variant_id: variantId,
        lemonsqueezy_id: lemonsqueezyId,
        status,
        lemonsqueezy_data: data,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (insertError) {
      console.error('Error creating subscription record:', insertError);
      throw insertError;
    }
    
    return newSubscription.id;
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
      .select('credits_remaining')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      throw error;
    }

    return data?.credits_remaining || 0;
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
        credits_remaining: currentCredits + creditsToAdd
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
 * Ensure the credit_transactions table exists
 */
export const ensureCreditTransactionsTable = async () => {
  try {
    // Check if the table exists by querying it
    const { error } = await supabase
      .from('credit_transactions')
      .select('id')
      .limit(1);
    
    // If there's an error with "relation credit_transactions does not exist", create the table
    if (error && error.message && error.message.includes('relation "credit_transactions" does not exist')) {
      console.log('Creating credit_transactions table...');
      
      // Create the table using SQL - need to use service role key for this
      const { error: createError } = await supabase.rpc('create_credit_transactions_table');
      
      if (createError) {
        // If RPC fails, log error but don't halt application
        console.error('Error creating credit_transactions table:', createError);
      } else {
        console.log('credit_transactions table created successfully');
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in ensureCreditTransactionsTable:', error);
    return { success: false, error };
  }
};

// Call this on application startup
ensureCreditTransactionsTable().catch(err => {
  console.error('Failed to ensure credit_transactions table:', err);
  // Non-fatal error, continue application startup
}); 