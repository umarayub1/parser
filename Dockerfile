# Build stage
FROM node:20-alpine AS build

ENV NODE_ENV=development
ENV VITE_SUPABASE_URL=https://zxetedcvnlqapnpqnrid.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZXRlZGN2bmxxYXBucHFucmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjkyNjcsImV4cCI6MjA1OTY0NTI2N30.E4BtILMqZYvOOl3X0qOEXIGbq_9JaJfJAAgssEsxu0o
ENV VITE_APP_BASE_URL=http://localhost:8080

WORKDIR /app
# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install a simple HTTP server for serving static content
RUN npm install -g serve

# Copy the build output from the build stage
COPY --from=build /app/dist /app/dist

# Set the environment variables
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the server
CMD ["serve", "-s", "dist", "-l", "8080"]