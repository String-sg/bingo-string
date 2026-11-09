import express from 'express';
import { hostLimiter, createGameLimiter } from '../middleware/rate-limit';
import prisma from '../lib/prisma';
import { firstLine, parseChallenges, publicChallenges } from '../lib/checked-bingo';
import { authenticateString, optionalAuth, AuthenticatedRequest, trustedOrigin } from '../middleware/auth';

const router = express.Router();
const validName=(v:unknown):v is string=>typeof v==='string' && v.trim().length>0 && v.length<=100;
const validSession=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
// GET /api/games - Get user's games (requires auth)
router.get('/', hostLimiter, authenticateString, async (req: AuthenticatedRequest, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        creatorId: req.user!.id
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
router.post('/', createGameLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, challenges, isPublic = true, gridSize = 5, createKey } = req.body;
    const checked = req.body.checked === true;

    if (![3,5].includes(gridSize) || typeof isPublic !== 'boolean' || !validName(name)) return res.status(400).json({error:'Use a game name, a 3x3 or 5x5 board and valid visibility'});
    if (createKey !== undefined && !validSession(createKey)) return res.status(400).json({error:'Invalid creation key'});
    if (createKey) { const existing = await prisma.game.findUnique({where:{clientCreateKey:createKey}}); if(existing) return existing.creatorId===req.user!.id ? res.status(200).json(existing) : res.status(409).json({error:'Creation conflict'}); }
    const expectedChallenges = gridSize * gridSize;
    const tiles = parseChallenges(challenges, gridSize, checked);

    if (!tiles) {
      return res.status(400).json({
        error: `Provide ${expectedChallenges} valid challenges, including accepted answers for each typed tile.`
      });
    }

    const game = await prisma.game.create({
      data: {
        name,
        creatorId: req.user!.id,
        creatorEmail: req.user!.email,
        challengesJson: tiles,
        checked,
        gridSize,
        clientCreateKey: createKey || null,
        isPublic
      }
    });

    res.status(201).json(game);
  } catch (error) {
    if (req.body.createKey && (error as any)?.code === 'P2002') { const existing=await prisma.game.findUnique({where:{clientCreateKey:req.body.createKey}}); if(existing?.creatorId===req.user!.id) return res.status(200).json(existing); }
    console.error('Error creating game');
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// GET /api/games/:id - Get specific game (public or owner)
router.get('/:id', hostLimiter, optionalAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
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
    const isOwner = req.user?.id === game.creatorId;
    const isPublic = game.isPublic;

    if (!isPublic && !isOwner) {
      return res.status(403).json({ error: 'Access denied to private game' });
    }

    res.json(isOwner ? game : {id:game.id,name:game.name,challengesJson:publicChallenges(game.challengesJson),gridSize:game.gridSize,isPublic:game.isPublic,checked:game.checked,creator:{name:game.creator.name}});
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// PUT /api/games/:id - Update game (requires auth and ownership)
router.put('/:id', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const { id } = req.params;
    const { name, challenges, isPublic } = req.body;

    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to update this game' });
    }

    const updateData: any = {};
    if (name !== undefined) { if (!validName(name)) return res.status(400).json({error:'Invalid game name'}); updateData.name = name.trim(); }
    if (challenges !== undefined) {
      if (game.checked) return res.status(409).json({ error: "Create a new board to change its tiles." });
      const tiles = parseChallenges(challenges, game.gridSize, false);
      if (!tiles) {
        return res.status(400).json({ error: `${game.gridSize * game.gridSize} valid challenges are required` });
      }
      updateData.challengesJson = tiles;
    }
    if (isPublic !== undefined) { if (typeof isPublic !== 'boolean') return res.status(400).json({error:'Invalid visibility'}); updateData.isPublic = isPublic; }

    const updatedGame = await prisma.game.update({
      where: { id },
      data: updateData
    });

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game');
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// DELETE /api/games/:id - Delete game (requires auth and ownership)
router.delete('/:id', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.creatorId !== req.user!.id) {
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
        checked: true,
        gridSize: true,
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

    res.json({ ...game, challengesJson: publicChallenges(game.challengesJson) });
  } catch (error) {
    console.error('Error fetching game for play:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// POST /api/games/:id/join - Join a game session
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, playerName } = req.body;

    if (!validSession(sessionId) || typeof playerName !== 'string' || !playerName.trim() || playerName.length > 80) {
      return res.status(400).json({ error: 'Session ID and Player Name are required' });
    }

    // Check if game exists
    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (!game.isPublic) return res.status(403).json({error:'This game is private'});
    if (game.checked) return res.status(409).json({ error: 'Open the game again to join.' });
    // Find or create session
    const session = await prisma.gameSession.upsert({
      where: {
        gameId_sessionId: {
          gameId: id,
          sessionId
        }
      },
      update: {
        playerName: playerName.trim() // Update name if changed
      },
      create: {
        gameId: id,
        sessionId,
        playerName: playerName.trim(),
        progressJson: []
      }
    });

    res.json(session);
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// POST /api/games/:id/progress - Update session progress
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, progressJson, isCompleted } = req.body;

    if (!validSession(sessionId) || !Array.isArray(progressJson)) {
      return res.status(400).json({ error: 'Session ID and progress are required' });
    }

    const game = await prisma.game.findUnique({where:{id}});
    if (!game) return res.status(404).json({error:'Game not found'});
    if (!game.isPublic) return res.status(403).json({error:'This game is private'});
    if (game.checked) return res.status(409).json({ error: 'Open the game again to sync your tiles.' });
    if (progressJson.length > game.gridSize*game.gridSize || new Set(progressJson).size !== progressJson.length
      || progressJson.some((n:unknown)=>!Number.isInteger(n) || Number(n)<0 || Number(n)>=game.gridSize*game.gridSize)) return res.status(400).json({error:'Invalid progress'});
    const completed = Boolean(firstLine(game.gridSize, new Set(progressJson)));
    const existing = await prisma.gameSession.findUnique({where:{gameId_sessionId:{gameId:id,sessionId}}});
    if (!existing) return res.status(404).json({error:'Join this game before updating progress'});
    const session = await prisma.gameSession.update({
      where: {
        gameId_sessionId: {
          gameId: id,
          sessionId
        }
      },
      data: {
        progressJson,
        isCompleted: completed,
        completedAt: completed ? existing.completedAt || new Date() : null
      }
    });

    res.json(session);
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /api/games/:id/results - Get game results (Leaderboard) - Requires Auth
router.get('/:id/results', hostLimiter, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const sessions = await prisma.gameSession.findMany({
      where: { gameId: id },
      orderBy: [
        { isCompleted: 'desc' }, // Completed first
        { completedAt: 'asc' },  // Earliest completion first
        { updatedAt: 'desc' }    // Recently active
      ]
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

module.exports = router;
