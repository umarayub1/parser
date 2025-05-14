import express from 'express';
import { authenticateUser, authenticateApiKey } from '../middleware/auth.js';
import { createApiKey, listApiKeys, updateApiKey, deleteApiKey, verifyApiKey } from '../controllers/apiKeyController.js';

const router = express.Router();

// Routes for API key management - protected by user session
router.post('/keys', authenticateUser, createApiKey);
router.get('/keys', authenticateUser, listApiKeys);
router.patch('/keys/:keyId', authenticateUser, updateApiKey);
router.delete('/keys/:keyId', authenticateUser, deleteApiKey);

// Route to verify an API key - this might use authenticateApiKey or be public depending on verifyApiKey controller logic
// For now, leaving as is, assuming verifyApiKey handles its own specific validation if needed, or is public.
router.get('/verify-key', verifyApiKey);

export default router; 