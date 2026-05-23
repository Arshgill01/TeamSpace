import { Hono } from 'hono';
import { ClaimsService } from '../server/services/claims.js';
import { ShiftsService } from '../server/services/shifts.js';

export const api = new Hono();

// Status/Health endpoint
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    app: 'teamspace',
    timestamp: Date.now()
  });
});

// Get active queue claims
api.get('/claims', async (c) => {
  const subreddit = c.req.query('subreddit');
  if (!subreddit) return c.json({ error: 'Subreddit name is required.' }, 400);

  const claims = new ClaimsService(subreddit);
  const active = await claims.getActiveClaims();
  return c.json(active);
});

// Delete (release) a claim manually
api.delete('/claims/:postId', async (c) => {
  const subreddit = c.req.query('subreddit');
  const postId = c.req.param('postId');
  if (!subreddit) return c.json({ error: 'Subreddit name is required.' }, 400);

  const claims = new ClaimsService(subreddit);
  await claims.releaseClaim(postId);
  return c.json({ success: true });
});

// Get shift logs
api.get('/shifts', async (c) => {
  const subreddit = c.req.query('subreddit');
  if (!subreddit) return c.json({ error: 'Subreddit name is required.' }, 400);

  const shifts = new ShiftsService(subreddit);
  const logs = await shifts.getShiftLogs();
  return c.json(logs);
});

// Post shift note
api.post('/shifts', async (c) => {
  const { subreddit, message, category } = await c.req.json<{
    subreddit: string;
    message: string;
    category: 'handover' | 'alert' | 'general';
  }>();

  if (!subreddit || !message) {
    return c.json({ error: 'Subreddit and message are required.' }, 400);
  }

  const username = c.req.header('x-user-name') ?? 'unknown_mod';

  const shifts = new ShiftsService(subreddit);
  const log = await shifts.logShiftNote(username, message, category);

  // Update mod roster heartbeat
  await shifts.recordModHeartbeat(username);

  return c.json({ success: true, log });
});

// Get active mod roster
api.get('/roster', async (c) => {
  const subreddit = c.req.query('subreddit');
  if (!subreddit) return c.json({ error: 'Subreddit name is required.' }, 400);

  const shifts = new ShiftsService(subreddit);
  const roster = await shifts.getActiveRoster();
  return c.json(roster);
});
