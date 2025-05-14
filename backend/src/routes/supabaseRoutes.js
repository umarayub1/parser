import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import {
  getRequests,
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
  uploadToStorage,
  invokeFunction
} from '../controllers/supabaseController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

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

// Request CRUD routes
router.get('/requests', authenticateUser, getRequests);
router.get('/requests/:id', authenticateUser, getRequestById);
router.post('/requests', authenticateUser, createRequest);
router.put('/requests/:id', authenticateUser, updateRequest);
router.delete('/requests/:id', authenticateUser, deleteRequest);

// Storage and Function routes
router.post('/upload', authenticateUser, upload.single('file'), uploadToStorage);
router.post('/functions/:functionName', authenticateUser, invokeFunction);

export default router; 