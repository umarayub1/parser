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
        price: 39.99,
        credits: 40,
        features: ['Credits roll over to next month', 'Basic support', 'Access to core features'],
        variantId: import.meta.env.VITE_LEMONSQUEEZY_BASIC_VARIANT_ID,
        yearlyVariantId: import.meta.env.VITE_LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        price: 99.99,
        credits: 100,
        features: ['Credits roll over to next month', 'Priority support', 'Access to all features'],
        variantId: import.meta.env.VITE_LEMONSQUEEZY_PRO_VARIANT_ID,
        yearlyVariantId: import.meta.env.VITE_LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: 199.99,
        credits: 200,
        features: ['Credits roll over to next month', 'Premium support', 'Early access to new features'],
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