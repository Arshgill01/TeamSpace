import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { ClaimsService } from '../server/services/claims.js';

export const menu = new Hono();

menu.post('/claim-post', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const postId = request.targetId; // ID of post
  const username = request.username; // mod actor
  const subreddit = request.subreddit;

  if (!postId || !username || !subreddit) {
    return c.json<UiResponse>({
      status: 'failure',
      message: 'Invalid request data.',
    });
  }

  const claims = new ClaimsService(subreddit);
  const result = await claims.claimPost(postId, username);

  if (result.success) {
    return c.json<UiResponse>({
      status: 'success',
      message: `You successfully claimed this post for 15 minutes.`,
    });
  } else {
    return c.json<UiResponse>({
      status: 'failure',
      message: result.error ?? 'Failed to claim post.',
    });
  }
});

menu.post('/open-dashboard', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const subreddit = request.subreddit;
  const username = request.username;

  if (!subreddit || !username) {
    return c.json<UiResponse>({
      status: 'failure',
      message: 'Invalid request data.',
    });
  }

  return c.json<UiResponse>({
    showWebView: {
      url: `/dashboard?subreddit=${subreddit}&username=${username}`,
      title: 'TeamSpace Workspace',
    },
  });
});
