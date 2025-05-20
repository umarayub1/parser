import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import {
  createCheckout,
  getSubscriptionStatus,
  cancelSubscription,
} from '../controllers/subscriptionController.js';

const router = express.Router();

// Subscription API Routes
router.post('/subscriptions/checkout', authenticateUser, createCheckout);
router.get('/subscriptions/status/:userId', authenticateUser, getSubscriptionStatus);
router.post('/subscriptions/cancel', authenticateUser, cancelSubscription);

export default router; 