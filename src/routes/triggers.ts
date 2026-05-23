import { Hono } from 'hono';
import type { OnModActionRequest, TriggerResponse } from '@devvit/web/shared';
import { ClaimsService } from '../server/services/claims.js';
import { ShiftsService } from '../server/services/shifts.js';

export const triggers = new Hono();

triggers.post('/on-mod-action', async (c) => {
  const request = await c.req.json<OnModActionRequest>();
  const postId = request.targetPost?.id ?? request.targetComment?.id;
  const subreddit = request.subreddit?.name;
  const actor = request.moderator?.name;

  if (postId && subreddit) {
    const claims = new ClaimsService(subreddit);
    await claims.releaseClaim(postId);
    console.log(`Auto-released claim for ${postId} due to mod action.`);
  }

  if (actor && subreddit) {
    const shifts = new ShiftsService(subreddit);
    await shifts.recordModHeartbeat(actor);
    console.log(`Recorded heartbeat for u/${actor} on r/${subreddit} due to mod action.`);
  }

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});
