import { supabaseAdmin } from '../services/supabase.js';
import config from '../config/index.js';
import { getUserCurrentPlan } from '../services/planService.js';

/**
 * User signup
 */
export const signup = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name
        }
      }
    });
    
    if (error) throw error;
    
    // Create a profile entry in profiles table if needed
    if (data?.user?.id) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          full_name,
          credits_remaining: config.defaultCredits || 5
        });
        
      if (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }
    
    return res.status(201).json({
      success: true,
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Signup failed'
    });
  }
};

/**
 * User login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Sign in with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
};

/**
 * Google sign in
 */
export const googleSignIn = async (req, res) => {
  try {
    // Get the URL for Google OAuth sign-in
    const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: req.body.redirectUrl || config.frontendUrl
      }
    });
    
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      url: data.url
    });
  } catch (error) {
    console.error('Google sign in error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Google sign in failed'
    });
  }
};

/**
 * Handle OAuth callback
 */
export const handleAuthCallback = async (req, res) => {
  try {
    // This is usually handled by Supabase directly in the client
    // but we can provide an endpoint if needed for specific use cases
    return res.status(200).json({
      success: true,
      message: 'Authentication complete'
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Auth callback failed'
    });
  }
};

/**
 * User logout
 */
export const logout = async (req, res) => {
  try {
    // Extract the token from the request
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }
    
    // Sign out with Supabase Auth
    const { error } = await supabaseAdmin.auth.signOut();
    
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Logout failed'
    });
  }
};

/**
 * Get current user
 */
export const getUser = async (req, res) => {
  try {
    // User information should be added by the auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
    
    // Get extended user profile from database if needed
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();
      
    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "No rows found" which is fine - we may not have a profile yet
      console.error('Error fetching user profile:', profileError);
    }
    
    // Combine auth user with profile data
    const userWithProfile = {
      ...req.user,
      ...profile
    };
    
    return res.status(200).json({
      success: true,
      user: userWithProfile
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user profile'
    });
  }
};

/**
 * Get user's remaining credits
 */
export const getCredits = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
    
    // Get user's credits from the database
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('credits_remaining')
      .eq('id', req.user.id)
      .single();
      
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      credits: data?.credits_remaining || 0
    });
  } catch (error) {
    console.error('Get credits error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get credits'
    });
  }
};

/**
 * Get current session
 */
export const getSession = async (req, res) => {
  try {
    // User information should be added by the auth middleware
    if (!req.user || !req.session) {
      return res.status(401).json({
        success: false,
        error: 'No active session'
      });
    }

    // Fetch user's subscription plan using the plan service
    let userPlan = null;
    let creditCostPerPage = 0.17; // Default basic plan rate

    try {
      const currentPlan = await getUserCurrentPlan(req.user.id);
      
      if (currentPlan) {
        userPlan = {
          name: currentPlan.plan_name,
          variant_id: currentPlan.variant_id,
          status: currentPlan.subscription_status,
          plan_slug: currentPlan.plan_slug
        };
        creditCostPerPage = parseFloat(currentPlan.credit_cost_per_page);
      }
    } catch (error) {
      console.error('Error fetching user plan:', error);
      // Continue with default values if plan fetch fails
    }

    return res.status(200).json({
      success: true,
      session: req.session,
      user_plan: userPlan,
      credit_cost_per_page: creditCostPerPage
    });
  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get session'
    });
  }
};