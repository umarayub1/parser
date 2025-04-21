// supabase/functions/submit-parsing-job/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2';

// Use Admin client
const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Secrets needed
const parsingApiKey = Deno.env.get('PARSING_API_KEY');
const parsingSubmitUrl = Deno.env.get('PARSING_API_URL'); // e.g., '.../upload-pdf/'
const callbackSecret = Deno.env.get('PARSING_CALLBACK_SECRET');
// Get the deployed URL of the handler function (set as secret)
const callbackHandlerUrl = Deno.env.get('PARSING_CALLBACK_HANDLER_URL');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    const { requestId, storagePath } = await req.json();
    if (!requestId || !storagePath) throw new Error("Request ID and Storage Path required.");

    if (!parsingApiKey || !parsingSubmitUrl || !callbackSecret || !callbackHandlerUrl) {
      throw new Error("Missing required environment variables for parsing submission.");
    }

    // 1. Update DB Status: Submitting
    await supabaseAdmin.from('requests').update({ parsing_status: 'submitting', parsing_started_at: new Date().toISOString() }).eq('id', requestId);

    // 2. Download file from Storage (same as before)
    console.log(`SUBMIT: Downloading ${storagePath} for request ${requestId}`);
    const { data: blobData, error: downloadError } = await supabaseAdmin.storage.from('statement-uploads').download(storagePath);
    if (downloadError) throw new Error(`Storage download failed: ${downloadError.message}`);
    if (!blobData) throw new Error("Downloaded file data is empty.");
    console.log(`SUBMIT: File downloaded successfully.`);

    // 3. Prepare form data (same as before)
    const formData = new FormData();
    const originalFilename = storagePath.split('/').pop() || 'file.pdf'; // Extract filename from path
    formData.append('file', blobData, originalFilename);

    // 4. Construct Callback URL and Headers
    // Option A: Simple callback URL (requestId needs to be in callback body)
    const callbackUrl = callbackHandlerUrl;
    // Option B: Embed requestId in URL (if handler can parse it)
    // const callbackUrl = `${callbackHandlerUrl}?requestId=${requestId}`;

    // Prepare headers for the callback (to be sent BY the parsing service TO your handler)
    // Example: Simple Bearer token signature
    const callbackHeaders = JSON.stringify({
        'Content-Type': 'application/json', // Tell service what format you expect back
        'X-Callback-Signature': `Bearer ${callbackSecret}`, // Verification header
        'X-Request-ID': requestId // Could also pass requestId this way if needed
    });

    // 5. Call the external parsing API with callback info
    console.log(`SUBMIT: Calling ${parsingSubmitUrl} with callback to ${callbackUrl}`);
    // Append callback params to FormData (API specific - check its docs)
    // Might need to be query params instead? Adjust as needed.
    formData.append('callback_url', callbackUrl);
    formData.append('callback_headers', callbackHeaders);

    const response = await fetch(parsingSubmitUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json', // Check if API returns immediate JSON response
        'api-key': parsingApiKey,
        // 'Content-Type': 'multipart/form-data' // Fetch sets this for FormData
      },
      body: formData,
    });

    console.log(`SUBMIT: Parsing API response status: ${response.status}`);

    // 6. Handle IMMEDIATE response (Check if job was accepted)
    if (response.status < 200 || response.status >= 300) { // Check for 2xx success status
        const errorBody = await response.text();
        console.error(`SUBMIT: Parsing API submission error (${response.status}): ${errorBody}`);
        await supabaseAdmin.from('requests').update({ parsing_status: 'error', error_message: `API submission failed: Status ${response.status}` }).eq('id', requestId);
        throw new Error(`API submission failed (${response.status})`);
    }

     // Optional: Log immediate success response body if available/useful
     try {
        const responseBody = await response.json(); // Or .text()
        console.log("SUBMIT: API immediate response body:", responseBody);
     } catch(e) { console.log("SUBMIT: API returned non-JSON success response."); }

    // 7. Update DB: Mark as PROCESSING (waiting for callback)
    console.log(`SUBMIT: Job submitted successfully for Request ID: ${requestId}. Waiting for callback.`);
    await supabaseAdmin
      .from('requests')
      .update({
          parsing_status: 'processing',
          parsing_completed_at: new Date().toISOString(), // Optional: Set to now or keep null
          error_message: null
       })
      .eq('id', requestId);

    // 8. Return success to frontend quickly
    return new Response(
      JSON.stringify({ success: true, message: 'Parsing job submitted, processing started.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 } // Use 200 OK
    );

  } catch (error) {
      // ... existing error handling ...
      console.error('Error in submit-parsing-job function:', error);
      // Try to update DB status to error if possible
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 } // Use 500 Internal Server Error
      );
  }
});