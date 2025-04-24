// supabase/functions/create-nowpayments-invoice/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Admin client to update the DB with invoice details
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();
    if (!requestId) throw new Error("Request ID is required.");

    // --- Fetch page_count for the request ---
    const { data: requestData, error: fetchError } = await supabaseAdmin
      .from('requests')
      .select('page_count') // Assuming a 'page_count' column exists
      .eq('id', requestId)
      .single();

    if (fetchError) {
      console.error(`Error fetching request details for ${requestId}:`, fetchError);
      throw new Error(`Could not retrieve request details: ${fetchError.message}`);
    }
    if (!requestData) {
      throw new Error(`Request record not found for ID: ${requestId}`);
    }

    const pageCount = requestData.page_count;
    if (pageCount === null || pageCount === undefined || typeof pageCount !== 'number' || pageCount < 0) {
        console.warn(`Invalid page_count (${pageCount}) for request ${requestId}. Using minimum price.`);
        // Decide how to handle invalid page count - using minimum price here
    }
    // --- Calculate Dynamic Price ---
    // Price is max(0.1 * pageCount, $2.00)
    // Ensure pageCount is treated as 0 if invalid/null for calculation
    const calculatedPrice = Math.max(0.1 * (pageCount > 0 ? pageCount : 0), 2.00); 
    const priceAmountString = calculatedPrice.toFixed(2); // Ensure 2 decimal places

    console.log(`Request ID: ${requestId}, Page Count: ${pageCount}, Calculated Price: $${priceAmountString}`);
    // --- End Price Calculation ---


    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    const ipnCallbackUrl = Deno.env.get('IPN_CALLBACK_URL');
    const appBaseUrl = Deno.env.get('APP_BASE_URL');
    // const priceAmount = Deno.env.get('PAYMENT_PRICE_AMOUNT'); // No longer used directly
    const priceCurrency = Deno.env.get('PAYMENT_PRICE_CURRENCY');

    if (!apiKey || !ipnCallbackUrl || !appBaseUrl || !priceCurrency) { // Removed priceAmount check
         throw new Error("Missing required environment variables for NowPayments invoice creation.");
    }

    const successUrl = `${appBaseUrl}?payment_return=success&request_id=${requestId}`;
    const cancelUrl = `${appBaseUrl}?payment_return=cancel&request_id=${requestId}`;

    const invoicePayload = {
      price_amount: parseFloat(priceAmountString), // Use the calculated price
      price_currency: priceCurrency,
      order_id: requestId, // Link invoice to our internal request ID
      // order_description: `Bank Statement Parsing (${pageCount} pages)`, // Optional enhanced description
      ipn_callback_url: ipnCallbackUrl,
      success_url: successUrl, // Where user returns after potential success
      cancel_url: cancelUrl,   // Where user returns if they cancel on NowPayments page
      // is_fee_paid_by_user: true, // Optional: default false
      // case_sensitive_order_id: false, // default false
    };

    console.log("Creating NowPayments invoice with payload:", invoicePayload);

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`NowPayments API Error (${response.status}): ${errorBody}`);
      throw new Error(`Failed to create NowPayments invoice: ${errorBody}`);
    }

    const invoiceData = await response.json();
    console.log("NowPayments Invoice Created:", invoiceData);

    const { id: invoiceId, invoice_url: invoiceUrl } = invoiceData;

    if (!invoiceId || !invoiceUrl) {
        throw new Error("Invoice ID or URL missing in NowPayments response.");
    }

    // Update our DB record with the invoice details
    const { error: dbError } = await supabaseAdmin
        .from('requests')
        .update({
            nowpayments_invoice_id: invoiceId,
            nowpayments_invoice_url: invoiceUrl,
            payment_status: 'waiting', // User needs to pay
        })
        .eq('id', requestId);

    if (dbError) {
        // Log error, but still return URL to user if possible
        console.error(`Failed to update request ${requestId} with invoice details: ${dbError.message}`);
        // Depending on severity, maybe throw error here instead
    }

    // Return the URL for the user to pay
    return new Response(
      JSON.stringify({ invoiceUrl: invoiceUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error creating NowPayments invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});