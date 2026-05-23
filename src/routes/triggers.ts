import { Hono } from 'hono';
import type { OnModActionRequest, TriggerResponse } from '@devvit/web/shared';
import { ClaimsService } from '../server/services/claims.js';

export const triggers = new Hono();

triggers.post('/on-mod-action', async (c) => {
  const request = await c.req.json<OnModActionRequest>();
  const postId = request.targetPost?.id ?? request.targetComment?.id;
  const subreddit = request.subreddit?.name;

  if (postId && subreddit) {
    const claims = new ClaimsService(subreddit);
    await claims.releaseClaim(postId);
    console.log(`Auto-released claim for ${postId} due to mod action.`);
  }

  return c.json<TriggerResponse>({}, 200);
});
