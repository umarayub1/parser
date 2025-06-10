# Build stage
FROM node:20-alpine AS build

# Set environment variables
# ENV NODE_ENV=production # Commented out to ensure devDependencies are installed for the build
ENV VITE_SUPABASE_URL=https://zxetedcvnlqapnpqnrid.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZXRlZGN2bmxxYXBucHFucmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjkyNjcsImV4cCI6MjA1OTY0NTI2N30.E4BtILMqZYvOOl3X0qOEXIGbq_9JaJfJAAgssEsxu0o
ENV VITE_APP_BASE_URL=https://parser-470443043814.us-central1.run.app
ENV VITE_API_BASE_URL=https://parser-470443043814.us-central1.run.app/api

# LemonSqueezy Configuration
ENV VITE_LEMONSQUEEZY_ENABLED=true
ENV VITE_LEMONSQUEEZY_STORE_ID=173435
ENV VITE_LEMONSQUEEZY_BASIC_VARIANT_ID=806828
ENV VITE_LEMONSQUEEZY_PRO_VARIANT_ID=806858
ENV VITE_LEMONSQUEEZY_PREMIUM_VARIANT_ID=806863

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Nginx
RUN apk update && apk add --no-cache nginx

# Install concurrently using npm (Node.js is already available from the base image)
RUN npm install -g concurrently

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# --- Backend Setup ---
# Copy backend package files
COPY backend/package*.json ./backend/

# Set workdir for backend, install dependencies, and copy code
WORKDIR /app/backend
RUN npm install --omit=dev
COPY backend/ .
# Create uploads directory if your backend needs it
RUN mkdir -p uploads

# --- Frontend Setup ---
# Go back to the main app directory for frontend assets
WORKDIR /app
# Copy the build output from the build stage (where Nginx will serve it from)
COPY --from=build /app/dist ./dist

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose Nginx port
# Nginx will listen on port 80 internally
EXPOSE 80

# Set entrypoint to our script instead of running nginx and concurrently directly
ENTRYPOINT ["/app/docker-entrypoint.sh"]
# No need for CMD as the entrypoint script handles starting all services