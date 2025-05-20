import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/auth/signup', authController.signup);
router.post('/auth/login', authController.login);
router.post('/auth/google', authController.googleSignIn);
router.get('/auth/callback', authController.handleAuthCallback);

// Protected routes (require authentication)
router.get('/auth/user', authenticateUser, authController.getUser);
router.get('/auth/credits', authenticateUser, authController.getCredits);
router.post('/auth/logout', authenticateUser, authController.logout);
router.get('/auth/session', authenticateUser, authController.getSession);

export default router; 