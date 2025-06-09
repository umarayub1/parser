import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

// Initialize Supabase client
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

// Cache for plan configurations to reduce database calls
let planCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all subscription plans from database
 * @returns {Promise<Array>} Array of plan configurations
 */
export const getAllPlans = async () => {
  try {
    // Check cache first
    const now = Date.now();
    if (planCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return planCache;
    }

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('plan_order', { ascending: true });

    if (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }

    // Update cache
    planCache = plans || [];
    cacheTimestamp = now;

    return plans || [];
  } catch (error) {
    console.error('Error in getAllPlans:', error);
    throw error;
  }
};

/**
 * Get plan configuration by variant ID
 * @param {string} variantId - LemonSqueezy variant ID
 * @returns {Promise<Object|null>} Plan configuration or null
 */
export const getPlanByVariantId = async (variantId) => {
  try {
    if (!variantId) return null;

    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .or(`variant_id.eq.${variantId},yearly_variant_id.eq.${variantId}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error fetching plan by variant ID:', error);
      throw error;
    }

    return plan;
  } catch (error) {
    console.error('Error in getPlanByVariantId:', error);
    throw error;
  }
};

/**
 * Get credit cost per page for a specific variant ID
 * @param {string} variantId - LemonSqueezy variant ID
 * @returns {Promise<number>} Credit cost per page
 */
export const getCreditCostByVariantId = async (variantId) => {
  try {
    const plan = await getPlanByVariantId(variantId);
    if (!plan) {
      throw new Error(`No plan found for variant ID: ${variantId}`);
    }
    return parseFloat(plan.credit_cost_per_page);
  } catch (error) {
    console.error('Error in getCreditCostByVariantId:', error);
    throw error;
  }
};

/**
 * Get user's current plan based on their active subscription
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Plan configuration with subscription info
 */
export const getUserCurrentPlan = async (userId) => {
  try {
    if (!userId) return null;

    // Get user's active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('variant_id, status, lemonsqueezy_data')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      return null; // No active subscription
    }

    // Get plan configuration for this variant
    const plan = await getPlanByVariantId(subscription.variant_id);
    
    if (!plan) {
      return null;
    }

    return {
      ...plan,
      subscription_status: subscription.status,
      subscription_data: subscription.lemonsqueezy_data
    };
  } catch (error) {
    console.error('Error in getUserCurrentPlan:', error);
    return null;
  }
};

/**
 * Calculate credit cost for parsing based on page count and user's plan
 * @param {string} userId - User ID
 * @param {number} pageCount - Number of pages to parse
 * @returns {Promise<Object>} Credit calculation details
 */
export const calculateCreditCost = async (userId, pageCount) => {
  try {
    const userPlan = await getUserCurrentPlan(userId);
    
    // If no active plan found, user is on trial - use default rate
    if (!userPlan) {
      const defaultCreditCostPerPage = 0.17; // Default trial rate
      const totalCost = pageCount * defaultCreditCostPerPage;

      return {
        page_count: pageCount,
        credit_cost_per_page: defaultCreditCostPerPage,
        total_credits: parseFloat(totalCost.toFixed(2)),
        plan_name: 'Trial',
        plan_slug: 'trial'
      };
    }

    const creditCostPerPage = parseFloat(userPlan.credit_cost_per_page);
    const totalCost = pageCount * creditCostPerPage;

    return {
      page_count: pageCount,
      credit_cost_per_page: creditCostPerPage,
      total_credits: parseFloat(totalCost.toFixed(2)),
      plan_name: userPlan.plan_name,
      plan_slug: userPlan.plan_slug
    };
  } catch (error) {
    console.error('Error in calculateCreditCost:', error);
    throw error;
  }
};

/**
 * Invalidate plan cache (useful after plan updates)
 */
export const invalidatePlanCache = () => {
  planCache = null;
  cacheTimestamp = null;
}; 