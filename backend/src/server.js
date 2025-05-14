import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import apiKeyRoutes from './routes/apiKeyRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import supabaseRoutes from './routes/supabaseRoutes.js';

console.log("--------------------------------------------------");
console.log("Attempting to start server...");
console.log("process.env.PORT as seen by Node.js:", process.env.PORT);
console.log("Port resolved by config.js (config.port):", config.port);
console.log("--------------------------------------------------");

// Initialize Express app
const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// API Routes
app.use('/api', apiKeyRoutes);
app.use('/api', pdfRoutes);
app.use('/api/supabase', supabaseRoutes);

// Add a simple test route
app.get('/api/test', (req, res) => {
  res.status(200).json({ success: true, message: 'Test API endpoint is working!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Handle multer errors
  if (err instanceof Error && err.message.includes('Only PDF files are allowed')) {
    return res.status(400).json({
      success: false,
      error: 'Only PDF files are allowed'
    });
  }
  
  // Default error response
  res.status(500).json({
      success: false,
    error: 'An unexpected error occurred'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
