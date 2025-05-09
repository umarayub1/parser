import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createApiKey, listApiKeys, updateApiKey, deleteApiKey, verifyApiKey } from '../controllers/apiKeyController.js';

const router = express.Router();

// Routes for API key management
router.post('/keys', authenticate, createApiKey);
router.get('/keys', authenticate, listApiKeys);
router.patch('/keys/:keyId', authenticate, updateApiKey);
router.delete('/keys/:keyId', authenticate, deleteApiKey);
router.get('/verify-key', verifyApiKey);

export default router; 