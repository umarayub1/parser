// API endpoint configuration
const config = {
  // API base URL - uses environment variable or falls back to default
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  
  // Supabase configuration
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  // Application base URL
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL || 'http://localhost:8080',
  
  // LemonSqueezy configuration
  lemonSqueezy: {
    enabled: import.meta.env.VITE_LEMONSQUEEZY_ENABLED === 'true',
    storeId: import.meta.env.VITE_LEMONSQUEEZY_STORE_ID,
    apiKey: import.meta.env.VITE_LEMONSQUEEZY_API_KEY,
    
    // Subscription plans
    plans: [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 9.99,
        credits: 10,
        features: ['10 credits per month', 'Basic support', 'Access to core features'],
        variantId: import.meta.env.VITE_LEMONSQUEEZY_BASIC_VARIANT_ID,
        yearlyVariantId: import.meta.env.VITE_LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        price: 49.99,
        credits: 60,
        features: ['60 credits per month', 'Priority support', 'Access to all features'],
        variantId: import.meta.env.VITE_LEMONSQUEEZY_PRO_VARIANT_ID,
        yearlyVariantId: import.meta.env.VITE_LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: 99.99,
        credits: 150,
        features: ['150 credits per month', 'Premium support', 'Early access to new features'],
        variantId: import.meta.env.VITE_LEMONSQUEEZY_PREMIUM_VARIANT_ID,
        yearlyVariantId: import.meta.env.VITE_LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID
      }
    ],
    
    // Variant IDs for backwards compatibility
    basicVariantId: import.meta.env.VITE_LEMONSQUEEZY_BASIC_VARIANT_ID,
    proVariantId: import.meta.env.VITE_LEMONSQUEEZY_PRO_VARIANT_ID,
    premiumVariantId: import.meta.env.VITE_LEMONSQUEEZY_PREMIUM_VARIANT_ID
  }
};

export default config; 