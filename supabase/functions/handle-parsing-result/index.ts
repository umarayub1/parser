// supabase/functions/handle-parsing-result/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@^2';
import { Resend } from 'npm:resend';
// Import crypto if using HMAC verification for callback_headers
// import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

// Use Admin client to update DB securely
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const callbackSecret = Deno.env.get('PARSING_CALLBACK_SECRET')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const appBaseUrl = Deno.env.get('APP_BASE_URL');
const emailFromAddress = Deno.env.get('EMAIL_FROM_ADDRESS');

let supabaseAdmin: SupabaseClient;
try {
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    console.log("Supabase Admin Client initialized.");
} catch (e) {
    console.error("Failed to initialize Supabase Admin Client:", e);
    // Cannot proceed without Supabase Admin client
    throw new Error("Supabase Admin initialization failed.");
}

console.log("Environment Check:", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
    hasCallbackSecret: !!callbackSecret,
    hasResendApiKey: !!resendApiKey,
    hasAppBaseUrl: !!appBaseUrl,
    hasEmailFromAddress: !!emailFromAddress
});

serve(async (req: Request) => {
    // --- Respond Quickly (Acknowledge Receipt) ---
    // It's generally better practice for callbacks to acknowledge quickly.
    // However, for simplicity here, we process fully before responding.

    // --- Basic Checks ---
    if (req.method !== 'POST') {
        console.warn("CALLBACK: Received non-POST request.");
        return new Response('Method Not Allowed', { status: 405 });
    }
    if (!callbackSecret) {
        console.error("CALLBACK: FATAL - PARSING_CALLBACK_SECRET is not set.");
        return new Response("Configuration Error", { status: 500 });
    }

    try {
        // 1. Verification (Example: Using a simple 'X-Callback-Signature' header)
        const receivedSignature = req.headers.get('X-Callback-Signature');
        if (!receivedSignature || receivedSignature !== `Bearer ${callbackSecret}`) {
            console.warn("CALLBACK: Invalid or missing X-Callback-Signature.");
            return new Response("Unauthorized: Invalid signature", { status: 401 });
        }
        console.log("CALLBACK: Signature verified.");

        // 2. Parse Callback Body
        const resultData = await req.json();
        console.log("CALLBACK: Received data:", JSON.stringify(resultData).substring(0, 500) + "..."); // Log snippet

        // 3. Extract Necessary Info (Adjust based on ACTUAL payload)
        const requestId = resultData.requestId || req.headers.get('X-Request-ID');
        const jobStatus = resultData.status;
        const parsedJson = resultData.data || resultData.result;
        const errorMessage = resultData.error || resultData.message;

        if (!requestId) {
            console.error("CALLBACK: Could not determine Request ID from callback.");
            return new Response("Bad Request: Missing Request ID", { status: 400 });
        }
        console.log(`CALLBACK: Processing result for Request ID: ${requestId}`);

        // 4. Fetch the Request Record BEFORE updating (to get user_id and file_name)
        console.log(`CALLBACK: Fetching current request data for ${requestId}...`);
        const { data: currentRequest, error: fetchError } = await supabaseAdmin
            .from('requests')
            .select('id, user_id, file_name')
            .eq('id', requestId)
            .maybeSingle(); // Use maybeSingle in case ID is somehow invalid

        if (fetchError) {
            console.error(`CALLBACK: Failed to fetch request ${requestId}:`, fetchError);
            // Decide if this is fatal. If we can't fetch, we might not want to update.
            return new Response("Internal Server Error fetching request data", { status: 500 });
        }
        if (!currentRequest) {
             console.error(`CALLBACK: Request ${requestId} not found.`);
             // If request doesn't exist, no point proceeding
             return new Response("Bad Request: Request ID not found", { status: 400 });
        }
        console.log(`CALLBACK: Found request data for ${requestId}:`, { userId: currentRequest.user_id, fileName: currentRequest.file_name });

        // 5. Determine Update Data based on Job Status
        let dbUpdateData: any = {
            parsing_completed_at: new Date().toISOString(),
        };
        let finalStatus = 'unknown';

        if (jobStatus === 'success' || jobStatus === 'completed') {
            finalStatus = 'success';
            dbUpdateData.parsing_status = 'success';
            dbUpdateData.parsed_data = parsedJson || {};
            dbUpdateData.error_message = null;
        } else {
            finalStatus = 'error';
            dbUpdateData.parsing_status = 'error';
            dbUpdateData.parsed_data = null; // Don't store potentially huge error data here
            dbUpdateData.error_message = errorMessage || `Parsing failed with status: ${jobStatus}`;
        }

        // 6. Update Database
        console.log(`CALLBACK: Updating request ${requestId} to status '${finalStatus}'`);
        const { error: dbError } = await supabaseAdmin
            .from('requests')
            .update(dbUpdateData)
            .eq('id', requestId);

        let emailSent = false;
        let emailErrorMsg: string | null = null;

        if (dbError) {
            console.error(`CALLBACK: DB update failed for request ${requestId}:`, dbError);
            // Don't try to send email if DB update failed
        } else {
            console.log(`CALLBACK: Successfully updated request ${requestId} in DB.`);

            // 7. <<< Send Email Logic (only if DB update succeeded and status is success) >>>
            if (finalStatus === 'success' && currentRequest.user_id) {
                console.log(`CALLBACK: Attempting to send completion email for user ${currentRequest.user_id}.`);

                if (!resendApiKey || !appBaseUrl || !emailFromAddress) {
                    emailErrorMsg = "Missing required environment variables for sending email (RESEND_API_KEY, APP_BASE_URL, EMAIL_FROM_ADDRESS).";
                    console.error("CALLBACK: Email Send Error -", emailErrorMsg);
                } else {
                    try {
                        // Fetch User Email (using existing Admin client)
                        console.log(`CALLBACK: Fetching email for user ID: ${currentRequest.user_id}`);
                        const { data: userData, error: userError } = await supabaseAdmin
                            .from('requests')
                            .select('user_email')
                            .eq('user_id', currentRequest.user_id)
                            .eq('id', requestId)
                            .single();

                        if (userError) throw new Error(`Error fetching user data: ${userError.message}`);
                        if (!userData?.user_email) throw new Error(`User ${currentRequest.user_id} not found or has no email.`);
                        const userEmail = userData.user_email;
                        console.log(`CALLBACK: Found email: ${userEmail}`);

                        // Initialize Resend Client
                        const resend = new Resend(resendApiKey);
                        console.log("CALLBACK: Resend Client initialized.");

                        // Construct Email
                        const resultsUrl = `${appBaseUrl}/requests/${requestId}`;
                        const subject = `Your Bank Statement Analysis is Ready!`;
                        const htmlBody = `
                          <h1>Analysis Complete!</h1>
                          <p>Hi there,</p>
                          <p>The analysis for your statement (${currentRequest.file_name || 'your file'}) is complete.</p>
                          <p>You can view the results here:</p>
                          <p><a href="${resultsUrl}">${resultsUrl}</a></p>
                          <br>
                          <p>Thanks for using our service!</p>
                        `;

                        // Send Email via Resend
                        console.log(`CALLBACK: Sending email to ${userEmail} via Resend...`);
                        const { data: emailData, error: resendErr } = await resend.emails.send({
                            from: emailFromAddress,
                            to: userEmail,
                            subject: subject,
                            html: htmlBody,
                        });

                        if (resendErr) {
                            throw new Error(`Resend API Error: ${resendErr.message}`);
                        }

                        console.log("CALLBACK: Email sent successfully via Resend:", emailData?.id);
                        emailSent = true;

                    } catch (emailErr) {
                        emailErrorMsg = emailErr.message;
                        console.error("CALLBACK: Failed to send completion email:", emailErr);
                        // Log the error, but don't fail the overall callback response
                    }
                }
            } else if (finalStatus === 'success') {
                console.log(`CALLBACK: Parsing successful for ${requestId}, but no user_id found. Skipping email.`);
            }
        }

        // 8. Respond 200 OK to the Parsing Service
        // Include email status in the response (optional, for logging/debugging)
        const responseBody = {
            message: "Callback processed.",
            dbUpdateStatus: dbError ? `Failed: ${dbError.message}` : "Success",
            emailSent: emailSent,
            emailError: emailErrorMsg,
        };
        return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("CALLBACK: Unhandled error processing callback:", error);
        return new Response("Internal Server Error processing callback", { status: 500 });
    }
});