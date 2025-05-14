FROM node:20-alpine

# Set the main working directory
WORKDIR /app

# --- Backend Setup ---
# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev 

# Copy backend application code
# This assumes the Docker build context is the workspace root
COPY backend/ ./backend/

# Create uploads directory for backend
RUN mkdir -p uploads

# --- Frontend Setup ---
# Copy frontend package files (assuming they are at the root of the build context)
COPY package*.json ./frontend/
COPY vite.config.js ./frontend/
COPY index.html ./frontend/
# If there are other root-level config files for the frontend, they should be copied too.

# Copy frontend application code (src, public, etc.)
COPY src ./frontend/src/
COPY public ./frontend/public/
# Add other frontend directories if necessary e.g. assets, styles

WORKDIR /app/frontend
RUN npm install # Install all dependencies, including devDependencies for the build
RUN npm run build # Build the frontend for production

# --- Final Setup ---
# Go back to the backend's directory, as the main start script is there.
# The backend's package.json "start" script will handle running both.
WORKDIR /app/backend

# Expose ports
# Backend
EXPOSE 4000
# Frontend (Vite's dev server or preview server)
EXPOSE 8080

# Start both applications using the script modified in backend/package.json
CMD ["npm", "start"] 