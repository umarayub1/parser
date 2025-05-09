# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Bank Statement Parser

An application to parse bank statements and extract transaction data.

## Features

- Parse PDF bank statements
- Extract transaction details
- API access for programmatic parsing
- Callback support for asynchronous processing
- User authentication and management
- Credit-based usage system

## Architecture

The application consists of two main components:

1. **Frontend**: React-based web application
2. **Backend**: Express server for API functionality

## Setup and Installation

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Environment Variables

You need to create a `.env` file in the root directory with the following variables:

```
# Supabase Service Role Key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Parsing API Configuration
PARSING_API_KEY=your_parsing_api_key
PARSING_API_URL=your_parsing_api_url
PARSING_CALLBACK_SECRET=your_callback_secret
PARSING_CALLBACK_HANDLER_URL=http://backend:4000/callback
```

### Running with Docker Compose

1. Set up environment variables as described above
2. Run the application:

```bash
docker-compose up -d
```

This will start both the frontend and backend services.

- Frontend: http://localhost:8080
- Backend API: http://localhost:4000

### Running for Development

#### Backend

```bash
cd backend
npm install
npm run dev
```

#### Frontend

```bash
npm install
npm run dev
```

## API Usage

The API supports two main endpoints:

1. **Parse PDF Endpoint**: `POST /api/parse-pdf`
   - Upload a PDF bank statement for parsing
   - Supports multipart/form-data with a `file` field
   - Optional `callback_url` for asynchronous notifications

2. **Status Check Endpoint**: `POST /api/parse-pdf` with JSON body
   - Check the status of a parsing request
   - Requires `requestId` in the request body

For more detailed API documentation, see the API Docs page in the application.
