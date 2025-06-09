#!/bin/sh
set -e

# Create log dirs if they don't exist
mkdir -p /var/log/nginx

echo "Starting backend server..."
# Start the backend server in the background
cd /app/backend
npm start &
BACKEND_PID=$!

# Function to check if backend is ready
wait_for_backend() {
    echo "Waiting for backend to be ready..."
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:4000/health > /dev/null 2>&1; then
            echo "Backend is ready!"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: Backend not ready yet, waiting..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo "Backend failed to start within expected time"
    return 1
}

# Install curl if not available (needed for health checks)
if ! command -v curl > /dev/null 2>&1; then
    echo "Installing curl for health checks..."
    apk add --no-cache curl
fi

# Wait for backend to be ready
if ! wait_for_backend; then
    echo "Failed to start backend properly"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "Starting nginx..."
# Start nginx in background mode
nginx
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start nginx: $status"
  kill $BACKEND_PID 2>/dev/null || true
  exit $status
fi

echo "All services started successfully"

# Start watching the nginx logs and forward them to stdout/stderr
tail -f /var/log/nginx/access.log &
TAIL_ACCESS_PID=$!
tail -f /var/log/nginx/error.log >&2 &
TAIL_ERROR_PID=$!

# Trap SIGTERM to propagate it to children so container can exit gracefully
trap 'echo "Shutting down..."; kill -TERM $TAIL_ACCESS_PID $TAIL_ERROR_PID $BACKEND_PID 2>/dev/null || true; nginx -s quit; wait' TERM INT

# Wait for all processes
wait $TAIL_ACCESS_PID $TAIL_ERROR_PID 