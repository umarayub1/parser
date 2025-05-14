import dotenv from 'dotenv';

const config = {
  port: process.env.BACKEND_PORT || 4000,
  supabaseUrl: process.env.VITE_SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'],
  uploads: process.env.FILE_SIZE_LIMIT || '10mb',
  environment: process.env.NODE_ENV || 'development',
};

export default config; 