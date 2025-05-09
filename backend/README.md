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