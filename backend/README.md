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

# Supabase Backend Migration

This document explains the migration of Supabase CRUD operations from frontend to backend.

## Overview

We've moved all direct Supabase database operations from the frontend to the backend API. This provides several benefits:

1. **Security**: Sensitive database operations are now performed server-side, protecting your database
2. **Centralized Logic**: Business logic is encapsulated in the backend API
3. **Better Maintainability**: Changes to database schemas only require updates in one place
4. **Reduced Client Size**: Frontend code is simpler and more focused on UI

## Migrated Operations

The following Supabase operations have been migrated:

1. Request CRUD (Create, Read, Update, Delete)
2. File uploads to Supabase Storage
3. Supabase Edge Function invocation

## New API Endpoints

### Requests

- `GET /api/supabase/requests` - Get all requests for the authenticated user
- `GET /api/supabase/requests/:id` - Get a specific request by ID
- `POST /api/supabase/requests` - Create a new request
- `PUT /api/supabase/requests/:id` - Update an existing request
- `DELETE /api/supabase/requests/:id` - Delete a request (soft delete)

### Storage & Functions

- `POST /api/supabase/upload` - Upload a file to Supabase Storage
- `POST /api/supabase/functions/:functionName` - Invoke a Supabase Edge Function

## Frontend Updates

The frontend now uses a new API client (`src/services/api.js`) to interact with these endpoints instead of direct Supabase calls. This API client handles authentication and request formatting.

### Example Usage

```javascript
// Before (direct Supabase call):
const { data, error } = await supabase
  .from('requests')
  .select('id, created_at, file_name')
  .eq('user_id', user.id);

// After (using new API client):
const { success, data, error } = await apiClient.getRequests();
```

## Authentication

Authentication is still handled by Supabase Auth on the frontend. The backend verifies the Supabase JWT token and extracts user information. 

Each API request must include the Supabase session token in the Authorization header:

```
Authorization: Bearer <supabase_session_token>
```

## Realtime Operations

Supabase Realtime subscriptions are still managed on the frontend since they provide direct client notifications without requiring backend involvement. 