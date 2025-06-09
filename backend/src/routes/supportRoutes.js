import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { submitSupportRequest, getUserSupportRequests } from '../controllers/supportController.js';

const router = express.Router();

// Support/Contact routes
// POST /api/support - Submit a support request (works for both authenticated and anonymous users)
router.post('/support', async (req, res, next) => {
  // Try to authenticate, but don't require it
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // If there's an auth header, try to authenticate
    try {
      const sessionToken = authHeader.replace('Bearer ', '');
      const { getUserFromSession } = await import('../middleware/auth.js');
      const { user, session } = await getUserFromSession(sessionToken);
      
      if (user) {
        req.user = user;
        req.session = session;
      }
    } catch (error) {
      console.log('Optional auth failed, continuing without user:', error.message);
    }
  }
  
  next();
}, submitSupportRequest);

// GET /api/support - Get user's support requests (requires authentication)
router.get('/support', authenticateUser, getUserSupportRequests);

export default router; 