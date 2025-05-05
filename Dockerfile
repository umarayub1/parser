# Build stage
FROM node:20-alpine as build

# Define build arguments for Vite environment variables
ARG VITE_PARSING_API_URL
ARG VITE_APP_MODE=production # Default to production
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_URL
ARG VITE_PARSING_API_KEY
ARG VITE_APP_BASE_URL

WORKDIR /app

# Set environment variables from build arguments for the build process
ENV VITE_PARSING_API_URL=$VITE_PARSING_API_URL
ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
# SECURITY WARNING: Avoid embedding sensitive keys directly if possible.
ENV VITE_PARSING_API_KEY=$VITE_PARSING_API_KEY
ENV VITE_APP_BASE_URL=$VITE_APP_BASE_URL

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
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Start the server
CMD ["serve", "-s", "dist", "-l", "8080"] 