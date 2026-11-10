import express from 'express';
import type { Prisma } from '@prisma/client';
import { hostLimiter, createGameLimiter } from '../middleware/rate-limit';
import prisma from '../lib/prisma';
import { firstLine, parseChallenges, publicChallenges } from '../lib/checked-bingo';
import { canEditGame, lockGameForPlay, resultsVersion, validResultsVersion } from '../lib/game-management';
import { authenticateString, optionalAuth, AuthenticatedRequest, trustedOrigin } from '../middleware/auth';

const router = express.Router();
const validName=(v:unknown):v is string=>typeof v==='string' && v.trim().length>0 && v.length<=100;
const validSession=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
const boardInUse = 'This board has saved play or an open live session. Save a copy to keep its results.';
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

router.get('/:id/editor', hostLimiter, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { id } = req.params;
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    if (game.creatorId !== req.user!.id) return res.status(403).json({ error: 'Only the board owner can edit it.' });
    return res.json({ ...game, canEdit: await canEditGame(prisma, id) });
  } catch {
    return res.status(503).json({ error: 'Could not open the editor. Please retry.' });
  }
});

router.put('/:id/editor', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const { id } = req.params;
    const { name, gridSize, challenges, version } = req.body;
    if (!validName(name) || ![3, 5].includes(gridSize) || typeof version !== 'string' || !Array.isArray(challenges))
      return res.status(400).json({ error: 'Provide a game name, board size, tiles and editor version.' });
    const result = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM games WHERE id = ${id} FOR UPDATE`;
      const game = await db.game.findUnique({ where: { id } });
      if (!game) return { status: 404, error: 'Game not found.' };
      if (game.creatorId !== req.user!.id) return { status: 403, error: 'Only the board owner can edit it.' };
      if (game.updatedAt.toISOString() !== version)
        return { status: 409, error: 'This board changed. Reopen the editor before saving.' };
      if (!(await canEditGame(db, id))) return { status: 409, error: boardInUse, code: 'board_in_use' };
      const checked = game.checked || challenges.some((tile) => tile?.mode === 'typed' || tile?.mode === 'manual');
      const tiles = parseChallenges(challenges, gridSize, checked);
      if (!tiles) return { status: 400, error: 'Provide valid tiles and accepted answers for every typed tile.' };
      return { game: await db.game.update({ where: { id }, data: {
        name: name.trim(), gridSize, checked, challengesJson: tiles,
        updatedAt: new Date(Math.max(Date.now(), game.updatedAt.getTime() + 1)),
      } }) };
    });
    if (!result.game) return res.status(result.status).json({ error: result.error, code: result.code });
    return res.json(result.game);
  } catch {
    return res.status(503).json({ error: 'Could not save changes. Please retry.' });
  }
});

// PUT /api/games/:id - Update game (requires auth and ownership)
router.put('/:id', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const { id } = req.params;
    const { name, challenges, isPublic } = req.body;
    const result = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM games WHERE id = ${id} FOR UPDATE`;
      const game = await db.game.findUnique({ where: { id } });
      if (!game) return { status: 404, error: 'Game not found' };
      if (game.creatorId !== req.user!.id) return { status: 403, error: 'Not authorized to update this game' };
      const updateData: Prisma.GameUpdateInput = {};
      if (name !== undefined) {
        if (!validName(name)) return { status: 400, error: 'Invalid game name' };
        updateData.name = name.trim();
      }
      if (challenges !== undefined) {
        if (game.checked) return { status: 409, error: 'Open the board editor to change its tiles.' };
        const tiles = parseChallenges(challenges, game.gridSize, false);
        if (!tiles) return { status: 400, error: `${game.gridSize * game.gridSize} valid challenges are required` };
        if (!(await canEditGame(db, id))) return { status: 409, error: boardInUse };
        updateData.challengesJson = tiles;
      }
      if (isPublic !== undefined) {
        if (typeof isPublic !== 'boolean') return { status: 400, error: 'Invalid visibility' };
        updateData.isPublic = isPublic;
      }
      return { game: await db.game.update({ where: { id }, data: updateData }) };
    });
    if (!result.game) return res.status(result.status).json({ error: result.error });
    res.json(result.game);
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
  res.set('Cache-Control', 'no-store');
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
        updatedAt: true,
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
    const { sessionId, playerName, boardVersion } = req.body;

    if (!validSession(sessionId) || typeof playerName !== 'string' || !playerName.trim() || playerName.length > 80) {
      return res.status(400).json({ error: 'Session ID and Player Name are required' });
    }

    const result = await prisma.$transaction(async (db) => {
      await lockGameForPlay(db, id);
      const game = await db.game.findUnique({ where: { id } });
      if (!game) return { status: 404, error: 'Game not found' };
      if (!game.isPublic) return { status: 403, error: 'This game is private' };
      if (game.checked) return { status: 409, error: 'Open the game again to join.' };
      if (boardVersion !== undefined && boardVersion !== game.updatedAt.toISOString())
        return { status: 409, error: 'The board changed. Reload to join.' };
      return { session: await db.gameSession.upsert({
        where: { gameId_sessionId: { gameId: id, sessionId } },
        update: { playerName: playerName.trim() },
        create: { gameId: id, sessionId, playerName: playerName.trim(), progressJson: [] },
      }) };
    });
    if (!result.session) return res.status(result.status).json({ error: result.error });
    res.json(result.session);
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// POST /api/games/:id/progress - Update session progress
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, progressJson, entryId } = req.body;

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
    if (entryId !== undefined && existing.id !== entryId)
      return res.status(409).json({ error: 'Your results were cleared. Reload to play again.' });
    const session = await prisma.gameSession.update({
      where: {
        id: existing.id,
      },
      data: {
        progressJson,
        isCompleted: completed,
        completedAt: completed ? existing.completedAt || new Date() : null
      }
    });

    res.json(session);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025')
      return res.status(404).json({ error: 'Join this game before updating progress' });
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /api/games/:id/results - Get game results (Leaderboard) - Requires Auth
router.get('/:id/results', hostLimiter, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  res.set('Cache-Control', 'no-store');
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

    res.set('X-Bingo-Results-Version', resultsVersion(sessions)).json(sessions);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

router.post('/:id/results/clear', hostLimiter, trustedOrigin, authenticateString, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const { id } = req.params;
    const { version } = req.body;
    if (!validResultsVersion(version)) return res.status(400).json({ error: 'Open Results before clearing.' });
    const result = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM games WHERE id = ${id} FOR UPDATE`;
      const game = await db.game.findUnique({ where: { id } });
      if (!game) return { status: 404, error: 'Game not found.' };
      if (game.creatorId !== req.user!.id) return { status: 403, error: 'Only the board owner can clear results.' };
      if (game.checked) return { status: 409, error: 'Open this board’s current Results to clear them.' };
      const where = { gameId: id };
      const rows = await db.gameSession.findMany({ where, select: { id: true } });
      if (rows.length && resultsVersion(rows) !== version)
        return { status: 409, error: 'Results changed. Reopen Results before clearing.' };
      await db.gameSession.deleteMany({ where });
      return { status: 200 };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'Could not clear results. Please retry.' });
  }
});

module.exports = router;
