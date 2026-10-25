import express from 'express';
import { hostLimiter, createGameLimiter } from '../middleware/rate-limit';
import prisma from '../lib/prisma';
import { authenticateString, optionalAuth, AuthenticatedRequest, trustedOrigin } from '../middleware/auth';

const router = express.Router();
const validName=(v:unknown):v is string=>typeof v==='string' && v.trim().length>0 && v.length<=100;
const validSession=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
function validChallenges(value:any,size:number) {
 return Array.isArray(value) && value.length===size*size && value.every((c:any)=>c && typeof c.text==='string' && c.text.trim().length>0 && c.text.length<=100 && typeof c.id==='string' && c.id.length<=100);
}
function hasBingo(progress:number[],size:number) {
 const cells=new Set(progress); if(size===5) cells.add(12);
 const lines:number[][]=[];
 for(let r=0;r<size;r++) lines.push(Array.from({length:size},(_,c)=>r*size+c));
 for(let c=0;c<size;c++) lines.push(Array.from({length:size},(_,r)=>r*size+c));
 lines.push(Array.from({length:size},(_,i)=>i*size+i),Array.from({length:size},(_,i)=>i*size+size-1-i));
 return lines.some(line=>line.every(i=>cells.has(i)));
}


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

    if (![3,5].includes(gridSize) || typeof isPublic !== 'boolean' || !validName(name)) return res.status(400).json({error:'Use a game name, a 3x3 or 5x5 board and valid visibility'});
    if (createKey !== undefined && !validSession(createKey)) return res.status(400).json({error:'Invalid creation key'});
    if (createKey) { const existing = await prisma.game.findUnique({where:{clientCreateKey:createKey}}); if(existing) return existing.creatorId===req.user!.id ? res.status(200).json(existing) : res.status(409).json({error:'Creation conflict'}); }
    const expectedChallenges = gridSize * gridSize;

    if (!name || !challenges || !validChallenges(challenges, gridSize)) {
      return res.status(400).json({
        error: `Name and ${expectedChallenges} challenges are required for a ${gridSize}x${gridSize} grid`
      });
    }

    const game = await prisma.game.create({
      data: {
        name,
        creatorId: req.user!.id,
        creatorEmail: req.user!.email,
        challengesJson: challenges,
        gridSize,
        clientCreateKey: createKey || null,
        isPublic
      }
    });

    res.status(201).json(game);
  } catch (error) {
    if (req.body.createKey && (error as any)?.code === 'P2002') { const existing=await prisma.game.findUnique({where:{clientCreateKey:req.body.createKey}}); if(existing?.creatorId===req.user!.id) return res.status(200).json(existing); }
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// GET /api/games/:id - Get specific game (public or owner)
router.get('/:id', hostLimiter, optionalAuth, async (req: AuthenticatedRequest, res) => {
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

    res.json(isOwner ? game : {id:game.id,name:game.name,challengesJson:game.challengesJson,gridSize:game.gridSize,isPublic:game.isPublic,creator:{name:game.creator.name}});
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// PUT /api/games/:id - Update game (requires auth and ownership)
router.put('/:id', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest, res) => {
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
      if (!validChallenges(challenges, game.gridSize)) {
        return res.status(400).json({ error: `${game.gridSize * game.gridSize} valid challenges are required` });
      }
      updateData.challengesJson = challenges;
    }
    if (isPublic !== undefined) { if (typeof isPublic !== 'boolean') return res.status(400).json({error:'Invalid visibility'}); updateData.isPublic = isPublic; }

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
router.delete('/:id', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest, res) => {
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

    res.json(game);
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
    if (progressJson.length > game.gridSize*game.gridSize || new Set(progressJson).size !== progressJson.length
      || progressJson.some((n:unknown)=>!Number.isInteger(n) || Number(n)<0 || Number(n)>=game.gridSize*game.gridSize)) return res.status(400).json({error:'Invalid progress'});
    const completed = hasBingo(progressJson, game.gridSize);
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
router.get('/:id/results', hostLimiter, authenticateString, async (req: AuthenticatedRequest, res) => {
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