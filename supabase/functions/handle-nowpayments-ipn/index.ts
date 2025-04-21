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

serve(async (req: Request) => {
  // --- IMPORTANT: Respond to NowPayments quickly, even before processing ---
  // NowPayments expects a quick 200 OK. Do verification/DB updates async if needed,
  // but for this simple case, we can do it inline if it's fast enough.

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
        payment_id, // Useful for tracking
        // ... other fields like pay_amount, actually_paid, etc.
    } = ipnData;

    if (!order_id) {
         console.error("IPN Error: Missing order_id in payload.");
         return new Response('Missing order_id', { status: 400 });
    }

    // 3. Update Database (using order_id which is our requestId)
    let dbUpdateData: any = {
        nowpayments_payment_status: payment_status, // Store the raw status
        nowpayments_payment_id: payment_id,
        nowpayments_invoice_id: invoice_id, // Can update/confirm invoice ID here too
    };

    let internalPaymentStatus = 'processing'; // Default internal status

    // Map NowPayments status to our internal status
    switch (payment_status) {
        case 'waiting':
            internalPaymentStatus = 'waiting'; // Waiting for user payment
            break;
        case 'confirming':
            internalPaymentStatus = 'confirming'; // Payment detected, waiting confirmations
            break;
        case 'confirmed':
             internalPaymentStatus = 'confirmed'; // Blockchain confirmed, pre-final
             break;
        case 'sending':
             internalPaymentStatus = 'sending'; // Funds being sent (less common to track)
             break;
        case 'partially_paid':
             internalPaymentStatus = 'partially_paid'; // Problem case
             break;
        case 'finished':
            internalPaymentStatus = 'succeeded'; // *** This is our SUCCESS trigger ***
            dbUpdateData.payment_status = 'succeeded'; // Update the main payment_status
            dbUpdateData.parsing_status = 'pending'; // Mark as ready for parsing
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
             internalPaymentStatus = payment_status; // Store unknown status directly
    }

    console.log(`Updating request ${order_id} with internal status ${internalPaymentStatus} and data:`, dbUpdateData);

    const { error: dbError } = await supabaseAdmin
        .from('requests')
        .update(dbUpdateData)
        .eq('id', order_id); // Match using our requestId stored in order_id

    if (dbError) {
        console.error(`IPN DB update failed for request ${order_id}:`, dbError);
        // Still return 200 OK to NowPayments, but log the error
        // Alternatively, could return 500, NowPayments might retry, but risks double processing.
    } else {
         console.log(`Successfully updated request ${order_id} based on IPN status ${payment_status}.`);
    }

    // 4. Respond 200 OK to NowPayments
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