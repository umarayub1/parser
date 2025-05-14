// API endpoint configuration
const config = {
  // API base URL - uses environment variable or falls back to default
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  
  // Supabase configuration
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  // Application base URL
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL || 'http://localhost:8080'
};

export default config; 