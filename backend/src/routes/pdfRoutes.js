import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateApiKey } from '../middleware/auth.js';
import { parsePdf, getParseStatus } from '../controllers/pdfController.js';
import config from '../config/index.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = config.uploads.directory;
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
    fileSize: config.uploads.fileSize // 10MB max
  }
});

// Routes for PDF parsing
router.post('/parse-pdf', authenticateApiKey, upload.single('file'), parsePdf);
router.get('/parse-status/:requestId', authenticateApiKey, getParseStatus);

export default router; 