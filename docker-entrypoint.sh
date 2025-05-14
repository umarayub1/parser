#!/bin/sh
set -e

# Create log dirs if they don't exist
mkdir -p /var/log/nginx

# Forward nginx logs to stdout/stderr
# Start nginx in background mode to enable capturing logs
nginx
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start nginx: $status"
  exit $status
fi

# Start the backend server using its regular start command
cd /app/backend
npm start &
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start backend: $status"
  exit $status
fi

# Start watching the nginx logs and forward them to stdout/stderr
# Store the PID so we can stop this process later
tail -f /var/log/nginx/access.log &
TAIL_ACCESS_PID=$!
tail -f /var/log/nginx/error.log >&2 &
TAIL_ERROR_PID=$!

# Trap SIGTERM to propagate it to children so container can exit gracefully
trap 'kill -TERM $TAIL_ACCESS_PID $TAIL_ERROR_PID; nginx -s quit; wait $TAIL_ACCESS_PID $TAIL_ERROR_PID' TERM

# Wait for all to finish (nginx and npm start are already background processes)
wait $TAIL_ACCESS_PID $TAIL_ERROR_PID 