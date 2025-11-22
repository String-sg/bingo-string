import express from 'express';
import prisma from '../lib/prisma';
import { authenticateGoogle, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();


// POST /api/auth/login - Validate Google token and create/update user
router.post('/login', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    // User is already validated by the authenticateGoogle middleware
    const userInfo = req.user!;

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { email: userInfo.email },
      update: {
        name: userInfo.name,
        picture: userInfo.picture
      },
      create: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        googleId: userInfo.googleId
      }
    });

    // Return user info (without sensitive data)
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: req.user!.email },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/logout - Logout (mainly for analytics/tracking)
router.post('/logout', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    // Since we're using Google JWT validation, logout is mainly client-side
    // This endpoint can be used for logging/analytics purposes

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;