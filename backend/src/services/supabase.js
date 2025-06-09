import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

// Initialize Supabase client with anon key for user authentication
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// Initialize Supabase admin client with service role key for admin operations
const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;
export { supabaseAdmin }; 