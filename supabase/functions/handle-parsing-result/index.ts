// supabase/functions/handle-parsing-result/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2';
// Import crypto if using HMAC verification for callback_headers
// import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

// Use Admin client to update DB securely
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Secret for verifying callbacks (MUST match what submit-parsing-job sends)
const CALLBACK_SECRET = Deno.env.get('PARSING_CALLBACK_SECRET'); // Set this secret!

serve(async (req: Request) => {
    // --- Respond Quickly ---
    // Acknowledge receipt immediately if possible, process async?
    // For now, process inline but keep it fast.

    if (req.method !== 'POST') {
        console.warn("CALLBACK: Received non-POST request.");
        return new Response('Method Not Allowed', { status: 405 });
    }

    if (!CALLBACK_SECRET) {
        console.error("CALLBACK: FATAL - PARSING_CALLBACK_SECRET is not set.");
        return new Response("Configuration Error", { status: 500 });
    }

    try {
        // 1. Verification (Example: Using a simple 'X-Callback-Signature' header)
        // Adjust based on how `submit-parsing-job` sends the header
        const receivedSignature = req.headers.get('X-Callback-Signature'); // Example header name
        if (!receivedSignature) {
            console.warn("CALLBACK: Missing X-Callback-Signature header.");
            return new Response("Unauthorized: Missing signature", { status: 401 });
        }

        // Verify the signature (e.g., simple shared secret comparison)
        // IMPORTANT: Use a more robust method like HMAC for production if possible,
        // comparing against data you expect (like requestId).
        if (receivedSignature !== `Bearer ${CALLBACK_SECRET}`) { // Simple Bearer token check
             console.warn("CALLBACK: Invalid X-Callback-Signature.");
             return new Response("Unauthorized: Invalid signature", { status: 401 });
        }
        console.log("CALLBACK: Signature verified.");

        // 2. Parse Callback Body
        const resultData = await req.json();
        console.log("CALLBACK: Received data:", JSON.stringify(resultData, null, 2));

        // 3. Extract Necessary Info
        // *** Adjust based on the ACTUAL payload sent by the parsing service ***
        const requestId = resultData.requestId || req.headers.get('X-Request-ID'); // How do you get the requestId back? Embed in URL or body?
        const jobStatus = resultData.status; // e.g., 'success', 'error'
        const parsedJson = resultData.data || resultData.result; // The actual parsed JSON
        const errorMessage = resultData.error || resultData.message; // Error details if failed

        if (!requestId) {
            console.error("CALLBACK: Could not determine Request ID from callback.");
            return new Response("Bad Request: Missing Request ID", { status: 400 });
        }

        // 4. Update Database. Current timestamp with timezone
        let dbUpdateData: any = {
            parsing_completed_at: new Date().toISOString(),
        };
        let finalStatus = 'unknown';

        if (jobStatus === 'success' || jobStatus === 'completed') {
            finalStatus = 'success';
            dbUpdateData.parsing_status = 'success';
            dbUpdateData.parsed_data = parsedJson || {}; // Store result, ensure it's not null
            dbUpdateData.error_message = null;
        } else { // Assume failure otherwise
            finalStatus = 'error';
            dbUpdateData.parsing_status = 'error';
            dbUpdateData.parsed_data = resultData || null; // Store the whole result for debugging
            dbUpdateData.error_message = errorMessage || `Parsing failed with status: ${jobStatus}`;
        }

        console.log(`CALLBACK: Updating request ${requestId} to status '${finalStatus}'`);
        const { error: dbError } = await supabaseAdmin
            .from('requests')
            .update(dbUpdateData)
            .eq('id', requestId);

        if (dbError) {
            console.error(`CALLBACK: DB update failed for request ${requestId}:`, dbError);
            // Still return 200 OK to the callback sender if verification passed,
            // but log the internal error. Don't want sender to retry endlessly if DB fails.
        } else {
            console.log(`CALLBACK: Successfully updated request ${requestId}.`);
        }

        // 5. Respond 200 OK to the Parsing Service
        return new Response("Callback received successfully.", { status: 200 });

    } catch (error) {
        console.error("CALLBACK: Error processing callback:", error);
        // Don't reveal detailed errors externally
        return new Response("Internal Server Error processing callback", { status: 500 });
    }
});