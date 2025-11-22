import express from 'express';
import prisma from '../lib/prisma';
import { authenticateGoogle, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();


// GET /api/games - Get user's games (requires auth)
router.get('/', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        creatorEmail: req.user!.email
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// POST /api/games - Create new game (requires auth)
router.post('/', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, challenges, isPublic = true } = req.body;

    if (!name || !challenges || !Array.isArray(challenges) || challenges.length !== 25) {
      return res.status(400).json({
        error: 'Name and 25 challenges are required'
      });
    }

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { email: req.user!.email },
      update: {
        name: req.user!.name,
        picture: req.user!.picture
      },
      create: {
        email: req.user!.email,
        name: req.user!.name,
        picture: req.user!.picture,
        googleId: req.user!.googleId
      }
    });

    const game = await prisma.game.create({
      data: {
        name,
        creatorEmail: req.user!.email,
        challengesJson: challenges,
        isPublic
      }
    });

    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// GET /api/games/:id - Get specific game (public or owner)
router.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user can access this game
    const isOwner = req.user?.email === game.creatorEmail;
    const isPublic = game.isPublic;

    if (!isPublic && !isOwner) {
      return res.status(403).json({ error: 'Access denied to private game' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// PUT /api/games/:id - Update game (requires auth and ownership)
router.put('/:id', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, challenges, isPublic } = req.body;

    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.creatorEmail !== req.user!.email) {
      return res.status(403).json({ error: 'Not authorized to update this game' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (challenges !== undefined) {
      if (!Array.isArray(challenges) || challenges.length !== 25) {
        return res.status(400).json({ error: '25 challenges are required' });
      }
      updateData.challengesJson = challenges;
    }
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updatedGame = await prisma.game.update({
      where: { id },
      data: updateData
    });

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// DELETE /api/games/:id - Delete game (requires auth and ownership)
router.delete('/:id', authenticateGoogle, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.creatorEmail !== req.user!.email) {
      return res.status(403).json({ error: 'Not authorized to delete this game' });
    }

    await prisma.game.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// GET /api/games/:id/play - Get game for playing (public endpoint)
router.get('/:id/play', async (req, res) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        challengesJson: true,
        isPublic: true,
        creator: {
          select: {
            name: true
          }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (!game.isPublic) {
      return res.status(403).json({ error: 'This game is private' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game for play:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

module.exports = router;