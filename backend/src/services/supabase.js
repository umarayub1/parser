import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export default supabase; 