// supabase/functions/simulate-payment-success/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@^2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Keep open for local dev
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Use Admin client for direct DB update
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Needs Service Role Key
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // IMPORTANT: Add a check to prevent accidental use in production if deployed
  // This relies on an environment variable *you* set for the function environment
  // Option 1: Check a specific secret/env var meant for this function
  // if (Deno.env.get('ALLOW_PAYMENT_SIMULATION') !== 'true') {
  //   console.warn("Payment simulation endpoint called in non-dev environment.");
  //   return new Response(JSON.stringify({ error: 'Simulation not allowed' }),
  //     { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  // }
  // Option 2: Rely on frontend not calling it (less secure if function is exposed)

  try {
    const { requestId } = await req.json();
    if (!requestId) throw new Error("Request ID is required for simulation.");

    console.log(`Simulating payment success for request ID: ${requestId}`);

    // Mimic the DB update from a successful IPN ('finished' status)
    const dbUpdateData = {
      payment_status: 'succeeded',
      parsing_status: 'pending', // Mark as ready for parsing
      nowpayments_payment_status: 'simulated_success', // Indicate simulation
      error_message: null, // Clear any previous errors
    };

    const { error: dbError } = await supabaseAdmin
      .from('requests')
      .update(dbUpdateData)
      .eq('id', requestId);

    if (dbError) {
      console.error(`Simulation DB update failed for request ${requestId}:`, dbError);
      throw new Error(`Database update failed during simulation: ${dbError.message}`);
    }

    console.log(`Successfully simulated payment success for request ${requestId}.`);

    return new Response(
      JSON.stringify({ success: true, message: 'Payment simulated successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error during payment simulation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Use 500 for server errors during simulation
      }
    );
  }
});