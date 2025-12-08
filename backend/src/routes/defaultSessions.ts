import express from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

// POST /api/default-sessions - Create new default game session
router.post('/', async (req, res) => {
  try {
    const { sessionId, challengeSet, gridSize = 5 } = req.body;

    if (!sessionId || !challengeSet) {
      return res.status(400).json({ error: 'Session ID and challenge set are required' });
    }

    // Check if session already exists
    const existingSession = await prisma.defaultGameSession.findUnique({
      where: { sessionId }
    });

    if (existingSession) {
      return res.json(existingSession);
    }

    const session = await prisma.defaultGameSession.create({
      data: {
        sessionId,
        challengeSet,
        gridSize,
        progressJson: []
      }
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating default session:', error);
    res.status(500).json({ error: 'Failed to create default session' });
  }
});

// POST /api/default-sessions/:sessionId/progress - Update session progress
router.post('/:sessionId/progress', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { progressJson, isCompleted } = req.body;

    if (!progressJson) {
      return res.status(400).json({ error: 'Progress data is required' });
    }

    const session = await prisma.defaultGameSession.update({
      where: { sessionId },
      data: {
        progressJson,
        isCompleted: isCompleted || false,
        completedAt: isCompleted ? new Date() : null
      }
    });

    res.json(session);
  } catch (error: any) {
    console.error('Error updating default session progress:', error);

    // Handle case where session doesn't exist
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /api/default-sessions/:sessionId - Get session (optional, for debugging)
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.defaultGameSession.findUnique({
      where: { sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching default session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

module.exports = router;