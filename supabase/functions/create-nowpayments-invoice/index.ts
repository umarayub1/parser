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
    const { requestId, type = 'parse', amount } = await req.json();
    if (!requestId) throw new Error("Request ID is required.");

    let priceAmountString = '';
    let orderId = requestId;
    let orderDescription = '';
    
    if (type === 'top_up') {
      // For top-up transactions, use the provided amount
      if (!amount || amount < 5) throw new Error("Amount must be at least $5 for top-ups");
      
      priceAmountString = amount.toFixed(2);
      orderDescription = `Credit Top-Up ($${priceAmountString})`;
      
      // Update the credit transaction record
      const { error: updateError } = await supabaseAdmin
        .from('credit_transactions')
        .update({
          amount_usd: parseFloat(priceAmountString),
          payment_status: 'waiting'
        })
        .eq('id', requestId);

      if (updateError) {
        console.error(`Error updating credit transaction for ${requestId}:`, updateError);
        throw new Error(`Could not update credit transaction: ${updateError.message}`);
      }
    } else {
      // Original parsing request logic - fetch page count
      const { data: requestData, error: fetchError } = await supabaseAdmin
        .from('requests')
        .select('page_count')
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
      }
      
      // Calculate price for parsing
      const calculatedPrice = Math.max(0.1 * (pageCount > 0 ? pageCount : 0), 2.00); 
      priceAmountString = calculatedPrice.toFixed(2);
      orderDescription = `Bank Statement Parsing (${pageCount} pages)`;
    }

    console.log(`Request ID: ${requestId}, Type: ${type}, Price: $${priceAmountString}`);

    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    const ipnCallbackUrl = Deno.env.get('IPN_CALLBACK_URL');
    const appBaseUrl = Deno.env.get('APP_BASE_URL');
    const priceCurrency = Deno.env.get('PAYMENT_PRICE_CURRENCY');

    if (!apiKey || !ipnCallbackUrl || !appBaseUrl || !priceCurrency) {
         throw new Error("Missing required environment variables for NowPayments invoice creation.");
    }

    // Return URLs for both parsing and top-up requests
    const returnPath = type === 'top_up' ? '/top-up' : '';
    const successUrl = `${appBaseUrl}${returnPath}?payment_return=success&request_id=${requestId}`;
    const cancelUrl = `${appBaseUrl}${returnPath}?payment_return=cancel&request_id=${requestId}`;

    const invoicePayload = {
      price_amount: parseFloat(priceAmountString),
      price_currency: priceCurrency,
      order_id: orderId,
      order_description: orderDescription,
      ipn_callback_url: ipnCallbackUrl,
      success_url: successUrl,
      cancel_url: cancelUrl,
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
    if (type === 'top_up') {
      const { error: dbError } = await supabaseAdmin
        .from('credit_transactions')
        .update({
          nowpayments_invoice_id: invoiceId,
          nowpayments_invoice_url: invoiceUrl,
          payment_status: 'waiting',
        })
        .eq('id', requestId);

      if (dbError) {
        console.error(`Failed to update credit transaction ${requestId} with invoice details: ${dbError.message}`);
      }
    } else {
      const { error: dbError } = await supabaseAdmin
        .from('requests')
        .update({
          nowpayments_invoice_id: invoiceId,
          nowpayments_invoice_url: invoiceUrl,
          payment_status: 'waiting',
        })
        .eq('id', requestId);

      if (dbError) {
        console.error(`Failed to update request ${requestId} with invoice details: ${dbError.message}`);
      }
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