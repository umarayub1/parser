# Bank Parser Backend

Backend service for the Bank Statement Parser application. This service provides an API for parsing bank statements and other financial documents.

## Project Structure

The project follows a modular architecture for better maintainability and scalability:

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Service layer (database, external APIs)
│   ├── utils/          # Utility functions
│   └── server.js       # Main application entry point
├── uploads/            # Temporary storage for uploaded files
├── package.json
├── Dockerfile
└── README.md
```

## API Documentation

The API provides endpoints for:

- PDF document parsing
- API key management
- Parse status checking
- Payment processing
- Webhook handling

## Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
PORT=4000
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
PARSING_API_KEY=your_parsing_api_key
PARSING_API_URL=your_parsing_api_url
PARSING_CALLBACK_SECRET=your_callback_secret
PARSING_CALLBACK_HANDLER_URL=your_callback_handler_url
RESEND_API_KEY=your_resend_api_key
APP_BASE_URL=your_app_base_url
EMAIL_FROM_ADDRESS=your_sender_email
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
NOWPAYMENTS_IPN_KEY=your_nowpayments_ipn_key
NOWPAYMENTS_IPN_CALLBACK=your_nowpayments_ipn_callback_url
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

3. Start the development server:
```bash
npm run dev
```

## Production

Build and start the Docker container:

```bash
docker build -t bank-parser-backend .
docker run -p 4000:4000 bank-parser-backend
```

# Supabase Migration Guide

This document explains the migration of Supabase operations from frontend to backend.

## Overview

We've moved all direct Supabase database operations and Edge Functions from the frontend to the backend API. This provides several benefits:

1. **Security**: Sensitive database operations are now performed server-side, protecting your database
2. **Centralized Logic**: Business logic is encapsulated in the backend API
3. **Better Maintainability**: Changes to database schemas only require updates in one place
4. **Reduced Client Size**: Frontend code is simpler and more focused on UI

## Migrated Operations

The following Supabase operations have been migrated:

1. Request CRUD (Create, Read, Update, Delete)
2. File uploads to Supabase Storage
3. Supabase Edge Functions - now implemented as Express routes

## API Endpoints

### Supabase Route Endpoints

- `GET /api/supabase/requests` - Get all requests for the authenticated user
- `GET /api/supabase/requests/:id` - Get a specific request by ID
- `POST /api/supabase/requests` - Create a new request
- `PUT /api/supabase/requests/:id` - Update an existing request
- `DELETE /api/supabase/requests/:id` - Delete a request (soft delete)
- `POST /api/supabase/upload` - Upload a file to Supabase Storage
- `POST /api/supabase/functions/:functionName` - Legacy endpoint to invoke Edge Functions (now redirects to the Functions API)

### Migrated Function Endpoints

- `POST /api/functions/parse-bank-statement` - Parse a bank statement PDF
- `POST /api/functions/handle-parsing-result` - Webhook for parsing result callbacks
- `POST /api/functions/create-nowpayments-invoice` - Create a NOWPayments invoice
- `POST /api/functions/handle-nowpayments-ipn` - Webhook for NOWPayments IPN
- `POST /api/functions/create-stripe-checkout` - Create a Stripe checkout session
- `POST /api/functions/simulate-payment-success` - Simulate successful payment (development only)

## Frontend Updates

The frontend should now use the new API endpoints instead of direct Supabase Edge Function invocations.

### Example Usage

```javascript
// Before (using Supabase Edge Function):
const { data, error } = await supabase.functions.invoke('parse-bank-statement', {
  body: { requestId, storagePath }
});

// After (using new API client):
const { success, data, error } = await apiClient.post('/functions/parse-bank-statement', {
  requestId, 
  storagePath
});
```

## Authentication

Authentication is still handled by Supabase Auth on the frontend. The backend verifies the Supabase JWT token and extracts user information. 

Each API request must include the Supabase session token in the Authorization header:

```
Authorization: Bearer <supabase_session_token>
```

## Webhook Endpoints

The webhook endpoints for parsing results and payment notifications don't require authentication since they're called by external services:

- `POST /api/functions/handle-parsing-result` - Called by the parsing service
- `POST /api/functions/handle-nowpayments-ipn` - Called by NOWPayments

These endpoints validate requests using service-specific signature mechanisms.

## Realtime Operations

Supabase Realtime subscriptions are still managed on the frontend since they provide direct client notifications without requiring backend involvement. 