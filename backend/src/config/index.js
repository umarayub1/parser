import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
  port: process.env.BACKEND_PORT || 4000,
  supabaseUrl: process.env.VITE_SUPABASE_URL || '',
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'],
  uploads: process.env.FILE_SIZE_LIMIT || '10mb',
  environment: process.env.NODE_ENV || 'development',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || process.env.VITE_APP_BASE_URL || 'http://localhost:5173',
  
  // LemonSqueezy configuration
  lemonSqueezy: {
    apiKey: process.env.LEMONSQUEEZY_API_KEY || '',
    storeId: process.env.LEMONSQUEEZY_STORE_ID || '',
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
    basicVariantId: process.env.LEMONSQUEEZY_BASIC_VARIANT_ID || '',
    proVariantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID || '',
    premiumVariantId: process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID || '',
    // Plans array for easy iteration and configuration
    plans: [
      {
        variantId: process.env.LEMONSQUEEZY_BASIC_VARIANT_ID || '',
        credits: 10,
        name: 'Basic Plan'
      },
      {
        variantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID || '',
        credits: 50,
        name: 'Pro Plan'
      },
      {
        variantId: process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID || '',
        credits: 100,
        name: 'Premium Plan'
      }
    ]
  }
};

export default config; 