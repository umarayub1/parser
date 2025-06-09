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

# Set production environment variables for LemonSqueezy
ENV LEMONSQUEEZY_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiJjZDA1OTNhODJiNGE4ODYwMTQ4ZTk1MDE1YmYxNzMyZjVmODNiNTJhOTE1N2JjNDA0M2RjMDE5MTk5NTlhMzExMDI0Mzg3MmVkOTI1NjBmMCIsImlhdCI6MTc0OTQ0MDA0NC42NzQ5OTYsIm5iZiI6MTc0OTQ0MDA0NC42NzQ5OTgsImV4cCI6MjA2NDk3Mjg0NC42Mzc2OTIsInN1YiI6IjQ3NzI0MjMiLCJzY29wZXMiOltdfQ.AlEOmcTjES7l8TlcQOLMFdfSW8EegtBvf6XihnsFW62i0tJ0l_s-8wWZ9ZZ9tdv-IsidA1YYfYRWS2aS1nrN14dWmtqtY5zLpMiZ6Bf2PTr4d6pln57MMDRnYAjECLAw2iVD0_V_OtDkf74WUQR9hmY9amEKcumL2Ber8J_kwPeGidZPJz46JDxtCMSusOULycFj1JirTk50Gm8TkbdPMq_0dctxG90r70B1zDYX_5bQavUGuvjvBWtHd1t3eMjlbCtlCVxy6QyUD5RP9BmOOXMLoh3P6Kc-FP1i892JCHI-OpeZOWfYAWb_xJZXILAfHEmpv5YpWAd8CxhWbonKM7nf-Oca6lDo2qdLV0FVvhlhHbDBDOxAdEv3z06OrMqSKX7QoQUiTbr_yRLpc7NPqiMNKhJ3zg5UTumHqmICABTaaq7fMM4mQRExbOrdrD-qmad4k8E4a_MK2rAHHIMlUW0cbp5m3ntcxNJxDCEwNHBKJN59NQAzMVftgCcP10fU
ENV LEMONSQUEEZY_STORE_ID=173435
ENV LEMONSQUEEZY_WEBHOOK_SECRET=D45EC2CF27A7C69F726E3EFA768B8
ENV LEMONSQUEEZY_BASIC_VARIANT_ID=806828
ENV LEMONSQUEEZY_PRO_VARIANT_ID=806858
ENV LEMONSQUEEZY_PREMIUM_VARIANT_ID=806863

# Frontend LemonSqueezy environment variables
ENV VITE_LEMONSQUEEZY_ENABLED=true
ENV VITE_LEMONSQUEEZY_STORE_ID=173435
ENV VITE_LEMONSQUEEZY_BASIC_VARIANT_ID=806828
ENV VITE_LEMONSQUEEZY_PRO_VARIANT_ID=806858
ENV VITE_LEMONSQUEEZY_PREMIUM_VARIANT_ID=806863

# Expose ports
# Backend
EXPOSE 4000
# Frontend (Vite's dev server or preview server)
EXPOSE 8080

# Start both applications using the script modified in backend/package.json
CMD ["npm", "start"] 