// supabase/functions/handle-nowpayments-ipn/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2';
import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts"; // Deno's crypto module

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or NowPayments IP range if known
  'Access-Control-Allow-Headers': 'x-nowpayments-sig, content-type', // Allow necessary headers
};

// Initialize Supabase Admin Client (use service role for DB updates)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use Service Role for backend updates
);

// Function to process a successful top-up
async function processTopUp(requestId: string, amount: number) {
  try {
    // 1. Get the transaction details to find the user
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('credit_transactions')
      .select('user_id, amount_usd')
      .eq('id', requestId)
      .single();

    if (fetchError || !transaction) {
      throw new Error(`Could not find transaction: ${fetchError?.message || 'Record not found'}`);
    }

    const { user_id, amount_usd } = transaction;
    // Use the amount from the transaction record or fall back to the provided amount
    const creditAmount = Math.floor(amount_usd || amount);

    if (!user_id) {
      throw new Error('Transaction has no associated user ID');
    }

    // 2. Check if user already has a profile record
    const { data: userProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('credits_remaining')
      .eq('id', user_id)
      .single();

    if (profileFetchError) {
      throw new Error(`Error checking user profile: ${profileFetchError.message}`);
    }

    // 3. Update the profile with added credits
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
    return true;
  } catch (error) {
    console.error('Error processing top-up:', error);
    return false;
  }
}

// Main function to handle the request
serve(async (req: Request) => {
  // Handle CORS preflight (though less likely needed for webhooks)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
     console.warn("Received non-POST request to IPN handler");
     return new Response('Method Not Allowed', { status: 405 });
  }

  const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET');
  if (!ipnSecret) {
      console.error("FATAL: NOWPAYMENTS_IPN_SECRET is not set.");
      // Don't reveal internal errors to the caller
      return new Response('Internal Server Error', { status: 500 });
  }

  try {
    // 1. Verification
    const signature = req.headers.get('x-nowpayments-sig');
    const bodyText = await req.text(); // Get raw body text

    if (!signature) {
      console.warn("IPN verification failed: Missing signature header.");
      return new Response('Signature missing', { status: 400 });
    }

    // Calculate expected signature
    const hmac = crypto.createHmac('sha512', ipnSecret);
    const digest = hmac.update(bodyText).digest('hex');

    if (digest !== signature) {
       console.warn(`IPN verification failed: Signature mismatch. Got ${signature}, expected ${digest}`);
       return new Response('Invalid signature', { status: 400 });
    }
    console.log("IPN Signature Verified Successfully.");

    // 2. Parse the verified data
    const ipnData = JSON.parse(bodyText);
    console.log("Received IPN Data:", JSON.stringify(ipnData, null, 2));

    const {
        order_id, // This should be our requestId
        invoice_id,
        payment_status,
        payment_id,
        pay_amount,
        actually_paid,
        order_description,
    } = ipnData;

    if (!order_id) {
         console.error("IPN Error: Missing order_id in payload.");
         return new Response('Missing order_id', { status: 400 });
    }

    // Determine if this is a top-up transaction based on the order description
    const isTopUp = order_description?.toLowerCase().includes('credit top-up');
    console.log(`IPN for order ${order_id} is ${isTopUp ? 'a top-up' : 'a parsing request'}`);

    // 3. Prepare DB update data
    let dbUpdateData: any = {
        nowpayments_payment_status: payment_status,
        nowpayments_payment_id: payment_id,
        nowpayments_invoice_id: invoice_id,
    };

    let internalPaymentStatus = 'processing'; // Default internal status

    // Map NowPayments status to our internal status
    switch (payment_status) {
        case 'waiting':
            internalPaymentStatus = 'waiting';
            break;
        case 'confirming':
            internalPaymentStatus = 'confirming';
            break;
        case 'confirmed':
             internalPaymentStatus = 'confirmed';
             break;
        case 'sending':
             internalPaymentStatus = 'sending';
             break;
        case 'partially_paid':
             internalPaymentStatus = 'partially_paid';
             break;
        case 'finished':
            internalPaymentStatus = 'succeeded';
            dbUpdateData.payment_status = 'succeeded';
            
            if (!isTopUp) {
              // For parsing requests
              dbUpdateData.parsing_status = 'pending';
            } else {
              // For top-up requests, process the credit addition
              const topUpAmount = actually_paid || pay_amount;
              const success = await processTopUp(order_id, topUpAmount);
              if (!success) {
                console.error(`Failed to process top-up for ${order_id}`);
                // Still mark payment as successful, but log the error
              }
            }
            break;
        case 'failed':
            internalPaymentStatus = 'failed';
            dbUpdateData.payment_status = 'failed';
            dbUpdateData.error_message = `NowPayments status: ${payment_status}`;
            break;
        case 'refunded':
             internalPaymentStatus = 'refunded';
             dbUpdateData.payment_status = 'refunded';
             break;
        case 'expired':
            internalPaymentStatus = 'expired';
            dbUpdateData.payment_status = 'expired';
            dbUpdateData.error_message = `NowPayments status: ${payment_status}`;
            break;
        default:
             console.warn(`Unhandled NowPayments status: ${payment_status}`);
             internalPaymentStatus = payment_status;
    }

    // 4. Update DB based on transaction type
    let dbError = null;
    
    if (isTopUp) {
      console.log(`Updating credit transaction ${order_id} with status ${internalPaymentStatus}`);
      const { error } = await supabaseAdmin
        .from('credit_transactions')
        .update(dbUpdateData)
        .eq('id', order_id);
      dbError = error;
    } else {
      console.log(`Updating parsing request ${order_id} with status ${internalPaymentStatus}`);
      const { error } = await supabaseAdmin
        .from('requests')
        .update(dbUpdateData)
        .eq('id', order_id);
      dbError = error;
    }

    if (dbError) {
        console.error(`IPN DB update failed for ${isTopUp ? 'top-up' : 'request'} ${order_id}:`, dbError);
        // Still return 200 OK to NowPayments, but log the error
    } else {
         console.log(`Successfully updated ${isTopUp ? 'top-up' : 'request'} ${order_id} based on IPN status ${payment_status}.`);
    }

    // 5. Respond 200 OK to NowPayments
    return new Response('IPN Processed', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 200
    });

  } catch (error) {
    console.error('Error processing IPN:', error);
    // Don't give details to the caller
    return new Response('Internal Server Error', { status: 500 });
  }
});