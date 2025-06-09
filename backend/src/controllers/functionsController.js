import supabase from '../services/supabase.js';
import { calculateCreditCost } from '../services/planService.js';
import config from '../config/index.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

// ------ Parse Bank Statement Function ------
export const parseBankStatement = async (req, res) => {
  try {
    const { requestId, storagePath } = req.body;
    if (!requestId || !storagePath) {
      return res.status(400).json({
        success: false,
        error: "Request ID and Storage Path required."
      });
    }

    const parsingApiKey = process.env.PARSING_API_KEY;
    const parsingSubmitUrl = process.env.PARSING_API_URL;
    const callbackSecret = process.env.PARSING_CALLBACK_SECRET;
    const callbackHandlerUrl = process.env.PARSING_CALLBACK_HANDLER_URL;

    if (!parsingApiKey || !parsingSubmitUrl || !callbackSecret || !callbackHandlerUrl) {
      return res.status(500).json({
        success: false,
        error: "Missing required environment variables for parsing submission."
      });
    }

    // 1. Get user ID and page count from the request record
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('user_id, page_count')
      .eq('id', requestId)
      .single();
    
    if (requestError || !requestData || !requestData.user_id) {
      return res.status(404).json({
        success: false,
        error: `Failed to retrieve user/request information: ${requestError?.message || 'No user ID associated with this request'}`
      });
    }

    if (requestData.page_count === null || requestData.page_count === undefined || requestData.page_count <= 0) {
      await supabase
        .from('requests')
        .update({ 
          parsing_status: 'error', 
          error_message: 'Invalid or missing page count for the document.' 
        })
        .eq('id', requestId);
      
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing page count for the document.'
      });
    }

    // Calculate credit cost based on user's plan
    const creditCalculation = await calculateCreditCost(requestData.user_id, requestData.page_count);
    const creditCost = creditCalculation.total_credits;
    
    // 2. Check if user has enough credits
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('credits_remaining')
      .eq('id', requestData.user_id)
      .single();
    
    if (profileError) {
      return res.status(500).json({
        success: false,
        error: `Failed to retrieve user profile: ${profileError.message}`
      });
    }
    
    if (!profileData || profileData.credits_remaining < creditCost) {
      const errorMessage = `Insufficient credits. This action requires ${creditCost} credits, but you only have ${profileData?.credits_remaining || 0}. Please purchase more credits.`;
      
      // Update request status to error due to insufficient credits
      await supabase
        .from('requests')
        .update({ 
          parsing_status: 'error', 
          error_message: errorMessage 
        })
        .eq('id', requestId);
      
      return res.status(402).json({
        success: false,
        error: errorMessage
      });
    }

    // 3. Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: requestData.user_id,
        amount: creditCost,
        status: 'completed',
        metadata: { 
          requestId: requestId, 
          type: 'parsing_fee', 
          pages: requestData.page_count,
          rate_per_page: creditCalculation.credit_cost_per_page,
          plan_name: creditCalculation.plan_name
        }
      });

    if (paymentError) {
      console.error(`Failed to create payment record for request ${requestId}: ${paymentError.message}`);
      await supabase
        .from('requests')
        .update({ 
          parsing_status: 'error', 
          error_message: `Internal error: Failed to record credit deduction (Code: P1). ${paymentError.message}` 
        })
        .eq('id', requestId);
      
      return res.status(500).json({
        success: false,
        error: `Internal error: Failed to record credit deduction (Code: P1). ${paymentError.message}`
      });
    }

    // 4. Deduct the calculated credits from the user's account
    const { error: creditDeductionError } = await supabase
      .from('profiles')
      .update({ 
        credits_remaining: profileData.credits_remaining - creditCost,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestData.user_id);

    if (creditDeductionError) {
      console.error(`Failed to deduct credits for user ${requestData.user_id}: ${creditDeductionError.message}`);
      await supabase
        .from('requests')
        .update({
          parsing_status: 'error',
          error_message: `Internal error: Failed to deduct credits after recording payment (Code: P2). ${creditDeductionError.message}`
        })
        .eq('id', requestId);
      
      return res.status(500).json({
        success: false,
        error: `Internal error: Failed to deduct credits (Code: P2). ${creditDeductionError.message}`
      });
    }

    // 5. Update DB Status: Submitting
    await supabase.from('requests').update({ parsing_status: 'submitting' }).eq('id', requestId);

    // 6. Download file from Storage
    console.log(`SUBMIT: Downloading ${storagePath} for request ${requestId}`);
    const { data: blobData, error: downloadError } = await supabase.storage.from('statement-uploads').download(storagePath);
    
    if (downloadError) {
      return res.status(500).json({
        success: false,
        error: `Storage download failed: ${downloadError.message}`
      });
    }
    
    if (!blobData) {
      return res.status(404).json({
        success: false,
        error: "Downloaded file data is empty."
      });
    }
    
    console.log(`SUBMIT: File downloaded successfully.`);

    // 7. Prepare form data
    const formData = new FormData();
    const originalFilename = storagePath.split('/').pop() || 'file.pdf'; // Extract filename from path
    formData.append('file', new Blob([blobData]), originalFilename);

    // 8. Construct Callback URL and Headers
    const callbackUrl = callbackHandlerUrl;
    const callbackHeaders = JSON.stringify({
      'Content-Type': 'application/json',
      'X-Callback-Signature': `Bearer ${callbackSecret}`,
      'X-Request-ID': requestId
    });

    // 9. Call the external parsing API with callback info
    console.log(`SUBMIT: Calling ${parsingSubmitUrl} with callback to ${callbackUrl}`);
    formData.append('callback_url', callbackUrl);
    formData.append('callback_headers', callbackHeaders);
    formData.append('retries', '1');

    const response = await fetch(parsingSubmitUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': parsingApiKey,
      },
      body: formData,
    });

    console.log(`SUBMIT: Parsing API response status: ${response.status}`);

    // 10. Handle IMMEDIATE response (Check if job was accepted)
    if (response.status < 200 || response.status >= 300) {
      const errorBody = await response.text();
      console.error(`SUBMIT: Parsing API submission error (${response.status}): ${errorBody}`);
      
      await supabase.from('requests').update({ 
        parsing_status: 'error', 
        error_message: `API submission failed: Status ${response.status}` 
      }).eq('id', requestId);
      
      return res.status(500).json({
        success: false,
        error: `API submission failed (${response.status})`
      });
    }

    // Optional: Log immediate success response body if available/useful
    try {
      const responseBody = await response.json();
      console.log("SUBMIT: API immediate response body:", responseBody);
    } catch(e) { 
      console.log("SUBMIT: API returned non-JSON success response."); 
    }

    // 11. Update DB: Mark as PROCESSING (waiting for callback) and store credits consumed
    console.log(`SUBMIT: Job submitted successfully for Request ID: ${requestId}. Waiting for callback.`);
    await supabase
      .from('requests')
      .update({
        parsing_status: 'processing',
        parsing_started_at: new Date().toISOString(),
        error_message: null,
        credits_consumed: creditCost
      })
      .eq('id', requestId);

    // 12. Return success to client
    return res.status(200).json({
      success: true, 
      message: 'Parsing job submitted, processing started.'
    });

  } catch (error) {
    console.error('Error in parse-bank-statement function:', error);
    
    // Try to update DB status to error if possible
    try {
      const { requestId } = req.body;
      if (requestId) {
        await supabase
          .from('requests')
          .update({ 
            parsing_status: 'error', 
            error_message: error.message || 'Unknown error during parsing'
          })
          .eq('id', requestId);
      }
    } catch (dbError) {
      console.error('Failed to update request error status:', dbError);
    }
    
    return res.status(500).json({
      success: false, 
      message: error.message || 'Unknown error occurred'
    });
  }
};

// ------ Handle Parsing Result Function ------
export const handleParsingResult = async (req, res) => {
  try {
    // 1. Verification
    const callbackSecret = process.env.PARSING_CALLBACK_SECRET;
    if (!callbackSecret) {
      console.error("CALLBACK: FATAL - PARSING_CALLBACK_SECRET is not set.");
      return res.status(500).json({
        success: false,
        error: "Configuration Error"
      });
    }

    const receivedSignature = req.headers['x-callback-signature'];
    if (!receivedSignature || receivedSignature !== `Bearer ${callbackSecret}`) {
      console.warn("CALLBACK: Invalid or missing X-Callback-Signature.");
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid signature"
      });
    }
    
    console.log("CALLBACK: Signature verified.");

    // 2. Parse Callback Body
    const resultData = req.body;
    console.log("CALLBACK: Received data:", JSON.stringify(resultData).substring(0, 500) + "...");

    // 3. Extract Necessary Info
    const requestId = resultData.requestId || req.headers['x-request-id'];
    const jobStatus = resultData.status;
    const parsedJson = resultData.data || resultData.result;
    const errorMessage = resultData.error || resultData.message;

    if (!requestId) {
      console.error("CALLBACK: Could not determine Request ID from callback.");
      return res.status(400).json({
        success: false,
        error: "Bad Request: Missing Request ID" 
      });
    }
    
    console.log(`CALLBACK: Processing result for Request ID: ${requestId}`);

    // 4. Fetch the Request Record BEFORE updating
    console.log(`CALLBACK: Fetching current request data for ${requestId}...`);
    const { data: currentRequest, error: fetchError } = await supabase
      .from('requests')
      .select('id, user_id, file_name')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchError) {
      console.error(`CALLBACK: Failed to fetch request ${requestId}:`, fetchError);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error fetching request data"
      });
    }
    
    if (!currentRequest) {
      console.error(`CALLBACK: Request ${requestId} not found.`);
      return res.status(400).json({
        success: false,
        error: "Bad Request: Request ID not found"
      });
    }
    
    console.log(`CALLBACK: Found request data for ${requestId}:`, { 
      userId: currentRequest.user_id, 
      fileName: currentRequest.file_name 
    });

    // 5. Determine Update Data based on Job Status
    let dbUpdateData = {
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
      dbUpdateData.parsed_data = null;
      dbUpdateData.error_message = errorMessage || `Parsing failed with status: ${jobStatus}`;
    }

    // 6. Update Database
    console.log(`CALLBACK: Updating request ${requestId} to status '${finalStatus}'`);
    const { error: dbError } = await supabase
      .from('requests')
      .update(dbUpdateData)
      .eq('id', requestId);

    let emailSent = false;
    let emailErrorMsg = null;

    if (dbError) {
      console.error(`CALLBACK: DB update failed for request ${requestId}:`, dbError);
    } else {
      console.log(`CALLBACK: Successfully updated request ${requestId} in DB.`);

      // 7. Send Email Logic (only if DB update succeeded and status is success)
      if (finalStatus === 'success' && currentRequest.user_id) {
        console.log(`CALLBACK: Attempting to send completion email for user ${currentRequest.user_id}.`);

        const resendApiKey = process.env.RESEND_API_KEY;
        const appBaseUrl = process.env.APP_BASE_URL;
        const emailFromAddress = process.env.EMAIL_FROM_ADDRESS;

        if (!resendApiKey || !appBaseUrl || !emailFromAddress) {
          emailErrorMsg = "Missing required environment variables for sending email (RESEND_API_KEY, APP_BASE_URL, EMAIL_FROM_ADDRESS).";
          console.error("CALLBACK: Email Send Error -", emailErrorMsg);
        } else {
          try {
            // Fetch User Email
            console.log(`CALLBACK: Fetching email for user ID: ${currentRequest.user_id}`);
            const { data: userData, error: userError } = await supabase
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
          }
        }
      } else if (finalStatus === 'success') {
        console.log(`CALLBACK: Parsing successful for ${requestId}, but no user_id found. Skipping email.`);
      }
    }

    // 8. Respond 200 OK
    return res.status(200).json({
      success: true,
      message: "Callback processed.",
      dbUpdateStatus: dbError ? `Failed: ${dbError.message}` : "Success",
      emailSent: emailSent,
      emailError: emailErrorMsg,
    });

  } catch (error) {
    console.error("CALLBACK: Unhandled error processing callback:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error processing callback"
    });
  }
};

// ------ Create NOWPayments Invoice Function ------
export const createNowpaymentsInvoice = async (req, res) => {
  try {
    const { amount, userId, redirectSuccessUrl, redirectFailureUrl } = req.body;
    
    if (!amount || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: amount and userId"
      });
    }
    
    const nowpaymentsApiKey = process.env.NOWPAYMENTS_API_KEY;
    const nowpaymentsIpnKey = process.env.NOWPAYMENTS_IPN_KEY;
    const nowpaymentsIpnCallback = process.env.NOWPAYMENTS_IPN_CALLBACK;
    
    if (!nowpaymentsApiKey || !nowpaymentsIpnKey || !nowpaymentsIpnCallback) {
      return res.status(500).json({
        success: false,
        error: "Missing required environment variables for NOWPayments"
      });
    }
    
    // Create invoice in NOWPayments
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': nowpaymentsApiKey
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'USD',
        order_id: `credit_purchase_${userId}_${Date.now()}`,
        order_description: 'Purchase credits for bank statement parsing',
        ipn_callback_url: nowpaymentsIpnCallback,
        success_url: redirectSuccessUrl,
        cancel_url: redirectFailureUrl
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating NOWPayments invoice:', errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.message || 'Failed to create payment invoice'
      });
    }
    
    const invoiceData = await response.json();
    
    // Create payment record in database
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: amount,
        status: 'pending',
        provider: 'nowpayments',
        provider_payment_id: invoiceData.id,
        metadata: {
          invoice_id: invoiceData.id,
          invoice_url: invoiceData.invoice_url
        }
      });
      
    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      return res.status(500).json({
        success: false,
        error: 'Failed to record payment in database'
      });
    }
    
    // Return invoice data to client
    return res.status(200).json({
      success: true,
      data: {
        invoice_id: invoiceData.id,
        invoice_url: invoiceData.invoice_url,
        payment_id: invoiceData.id
      }
    });
    
  } catch (error) {
    console.error('Error in create-nowpayments-invoice function:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment invoice'
    });
  }
};

// ------ Handle NOWPayments IPN Function ------
export const handleNowpaymentsIpn = async (req, res) => {
  try {
    // Verify the IPN request
    const nowpaymentsIpnKey = process.env.NOWPAYMENTS_IPN_KEY;
    if (!nowpaymentsIpnKey) {
      console.error('Missing NOWPAYMENTS_IPN_KEY');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    
    // Get the HMAC signature from the request headers
    const hmacHeader = req.headers['x-nowpayments-sig'];
    if (!hmacHeader) {
      console.error('Missing x-nowpayments-sig header');
      return res.status(401).json({ success: false, error: 'Missing signature header' });
    }
    
    // Verify the signature (in a production environment)
    // This would require crypto library to verify HMAC signature
    // For now, we'll skip verification in this example
    
    const { payment_status, order_id, payment_id, price_amount } = req.body;
    
    // Extract the user ID from the order_id (format: credit_purchase_USER_ID_TIMESTAMP)
    const orderIdParts = order_id.split('_');
    if (orderIdParts.length < 3 || orderIdParts[0] !== 'credit' || orderIdParts[1] !== 'purchase') {
      console.error('Invalid order_id format');
      return res.status(400).json({ success: false, error: 'Invalid order_id format' });
    }
    
    const userId = orderIdParts[2];
    
    // Update the payment status in the database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: payment_status === 'confirmed' ? 'completed' : payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('provider_payment_id', payment_id);
      
    if (updateError) {
      console.error('Error updating payment status:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to update payment status' });
    }
    
    // If payment is confirmed, add credits to the user's account
    if (payment_status === 'confirmed') {
      // Calculate credits based on the payment amount (e.g., $1 = 10 credits)
      const creditsToAdd = parseFloat(price_amount) * 10;
      
      // Get current user credits
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', userId)
        .single();
        
      if (userError) {
        console.error('Error fetching user data:', userError);
        return res.status(500).json({ success: false, error: 'Failed to fetch user data' });
      }
      
      // Add credits to user account
      const newCreditBalance = (userData.credits_remaining || 0) + creditsToAdd;
      const { error: creditError } = await supabase
        .from('profiles')
        .update({
          credits_remaining: newCreditBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (creditError) {
        console.error('Error adding credits to user account:', creditError);
        return res.status(500).json({ success: false, error: 'Failed to add credits to user account' });
      }
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'IPN processed successfully'
    });
    
  } catch (error) {
    console.error('Error in handle-nowpayments-ipn function:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process payment notification'
    });
  }
};

// ------ Simulate Payment Success Function (for testing) ------
export const simulatePaymentSuccess = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: userId and amount"
      });
    }
    
    // In development mode only
    if (config.environment !== 'development') {
      return res.status(403).json({
        success: false,
        error: "This endpoint is only available in development mode"
      });
    }
    
    // 1. Create a payment record
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: amount,
        status: 'completed',
        provider: 'simulation',
        metadata: { 
          is_simulation: true,
          simulation_time: new Date().toISOString()
        }
      })
      .select('id')
      .single();
      
    if (paymentError) {
      console.error('Error creating simulated payment:', paymentError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create simulated payment record'
      });
    }
    
    // 2. Calculate credits (e.g., $1 = 10 credits)
    const creditsToAdd = parseFloat(amount) * 10;
    
    // 3. Get current user credits
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('credits_remaining')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error('Error fetching user profile:', userError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user profile'
      });
    }
    
    const currentCredits = userData?.credits_remaining || 0;
    const newCreditBalance = currentCredits + creditsToAdd;
    
    // 4. Update user credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        credits_remaining: newCreditBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateError) {
      console.error('Error updating user credits:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update user credits'
      });
    }
    
    // 5. Return success response
    return res.status(200).json({
      success: true,
      data: {
        payment_id: paymentData.id,
        previous_credits: currentCredits,
        added_credits: creditsToAdd,
        new_balance: newCreditBalance
      },
      message: 'Payment simulation completed successfully'
    });
    
  } catch (error) {
    console.error('Error in simulate-payment-success function:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to simulate payment'
    });
  }
}; 