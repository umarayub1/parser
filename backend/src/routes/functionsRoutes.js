import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  parseBankStatement,
  handleParsingResult,
  createNowpaymentsInvoice,
  handleNowpaymentsIpn,
  simulatePaymentSuccess
} from '../controllers/functionsController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Migrated Supabase Function Routes
router.post('/parse-bank-statement', authenticateUser, parseBankStatement);
router.post('/handle-parsing-result', handleParsingResult); // No auth for webhooks
router.post('/create-nowpayments-invoice', authenticateUser, createNowpaymentsInvoice);
router.post('/handle-nowpayments-ipn', handleNowpaymentsIpn); // No auth for webhooks
router.post('/simulate-payment-success', authenticateUser, simulatePaymentSuccess);

export default router; 