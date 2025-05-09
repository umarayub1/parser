FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose the port
EXPOSE 4000

# Start the application
CMD ["npm", "start"] 