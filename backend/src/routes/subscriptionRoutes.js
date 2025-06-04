import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import {
  createCheckout,
  getSubscriptionStatus,
  cancelSubscription,
  retryFailedWebhooks,
  validateSubscriptions
} from '../controllers/subscriptionController.js';

const router = express.Router();

// Subscription API Routes
router.post('/subscriptions/checkout', authenticateUser, createCheckout);
router.get('/subscriptions/status/:userId', authenticateUser, getSubscriptionStatus);
router.post('/subscriptions/cancel', authenticateUser, cancelSubscription);

// Admin/Recovery Routes (should be protected with admin authentication in production)
router.post('/subscriptions/retry-webhooks', authenticateUser, retryFailedWebhooks);
router.get('/subscriptions/validate', authenticateUser, validateSubscriptions);

export default router; 