import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import apiKeyRoutes from './routes/apiKeyRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import supabaseRoutes from './routes/supabaseRoutes.js';
import functionsRoutes from './routes/functionsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import { handleLemonSqueezyWebhook } from './controllers/subscriptionController.js';
import getRawBody from 'raw-body';
import { runHealthCheck } from './utils/subscriptionMonitoring.js';

// Initialize Express app
const app = express();
const PORT = config.port;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (config.allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', config.allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Handle Lemon Squeezy webhooks - Must be before JSON middleware for signature verification
app.post('/api/webhooks/lemonsqueezy', async (req, res) => {
  try {
    // Get raw body for webhook signature verification
    const rawBody = await getRawBody(req);
    req.rawBody = rawBody.toString('utf8');
    req.body = JSON.parse(req.rawBody);
    
    return handleLemonSqueezyWebhook(req, res);
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to process webhook' });
  }
});

// Standard JSON parsing for all other routes
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api', apiKeyRoutes);
app.use('/api', pdfRoutes);
app.use('/api', authRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', supportRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/functions', functionsRoutes);

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Set up subscription health monitoring
  // Run health check on startup
  runHealthCheck()
    .then(health => {
      if (health.healthy) {
        console.log('✅ Subscription system health check passed');
      } else {
        console.warn(`⚠️  Subscription system health issues detected: ${health.issues.length}`);
      }
    })
    .catch(err => console.error('❌ Failed to run initial health check:', err));
  
  // Schedule periodic health checks (every 30 minutes)
  setInterval(() => {
    runHealthCheck()
      .then(health => {
        if (!health.healthy) {
          console.error(`❌ Subscription health check failed: ${health.issues.length} issues found`);
        }
      })
      .catch(err => console.error('❌ Periodic health check failed:', err));
  }, 30 * 60 * 1000); // 30 minutes
});

export default app;
