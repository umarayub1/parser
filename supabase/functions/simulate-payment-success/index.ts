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
    const { requestId, type = 'parse' } = await req.json();
    if (!requestId) throw new Error("Request ID is required for simulation.");

    console.log(`Simulating payment success for request ID: ${requestId}, type: ${type}`);

    if (type === 'top_up') {
      // For top-up transactions
      // 1. Get the amount from the transaction
      const { data: transactionData, error: fetchError } = await supabaseAdmin
        .from('credit_transactions')
        .select('amount_usd, user_id')
        .eq('id', requestId)
        .single();

      if (fetchError || !transactionData) {
        throw new Error(`Could not find transaction: ${fetchError?.message || 'Transaction not found'}`);
      }

      // 2. Update the transaction status
      const { error: updateError } = await supabaseAdmin
        .from('credit_transactions')
        .update({
          payment_status: 'succeeded',
          nowpayments_payment_status: 'simulated_success',
          error_message: null,
        })
        .eq('id', requestId);

      if (updateError) {
        throw new Error(`Failed to update transaction: ${updateError.message}`);
      }

      // 3. Add credits to the user's account
      const { amount_usd, user_id } = transactionData;
      const creditAmount = Math.floor(amount_usd); // Convert to whole credits (1 USD = 1 credit)

      // Check if user has a profile record
      const { data: userProfile, error: profileFetchError } = await supabaseAdmin
        .from('profiles')
        .select('credits_remaining')
        .eq('id', user_id)
        .single();

      if (profileFetchError) {
        throw new Error(`Error checking user profile: ${profileFetchError.message}`);
      }

      // Update the profile with added credits
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          credits_remaining: (userProfile.credits_remaining || 0) + creditAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id);

      if (profileUpdateError) {
        throw new Error(`Failed to update user credits: ${profileUpdateError.message}`);
      }

      console.log(`Added ${creditAmount} credits to user ${user_id}`);
    } else {
      // Original parsing request logic
      const dbUpdateData = {
        payment_status: 'succeeded',
        parsing_status: 'pending',
        nowpayments_payment_status: 'simulated_success',
        error_message: null,
      };

      const { error: dbError } = await supabaseAdmin
        .from('requests')
        .update(dbUpdateData)
        .eq('id', requestId);

      if (dbError) {
        throw new Error(`Database update failed during simulation: ${dbError.message}`);
      }
    }

    console.log(`Successfully simulated payment success for ${type} request ${requestId}.`);

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
        status: 500,
      }
    );
  }
});