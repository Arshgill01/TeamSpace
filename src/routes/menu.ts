import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { ClaimsService } from '../server/services/claims.js';

export const menu = new Hono();

menu.post('/claim-post', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const postId = request.targetId;
  const username = context.username;
  const subreddit = context.subredditName;

  if (!postId || !username || !subreddit) {
    return c.json<UiResponse>({
      showToast: {
        text: 'Failed to claim post: Context or ID is missing.',
        appearance: 'neutral',
      },
    });
  }

  const claims = new ClaimsService(subreddit);
  const result = await claims.claimPost(postId, username);

  if (result.success) {
    return c.json<UiResponse>({
      showToast: {
        text: `You successfully claimed this post for 15 minutes.`,
        appearance: 'success',
      },
    });
  } else {
    return c.json<UiResponse>({
      showToast: {
        text: result.error ?? 'Failed to claim post.',
        appearance: 'neutral',
      },
    });
  }
});

menu.post('/open-dashboard', async (c) => {
  const subreddit = context.subredditName;

  if (!subreddit) {
    return c.json<UiResponse>({
      showToast: {
        text: 'Subreddit context is missing.',
        appearance: 'neutral',
      },
    });
  }

  // Create a Custom Post that renders the Hono HTML app inline
  const post = await reddit.submitCustomPost({
    subredditName: subreddit,
    title: 'TeamSpace Dashboard',
    entry: 'default',
    textFallback: {
      text: 'Open this post in Reddit to use the TeamSpace dashboard.',
    },
  });

  return c.json<UiResponse>({
    navigateTo: post.permalink,
    showToast: {
      text: 'Opening TeamSpace dashboard...',
      appearance: 'success',
    },
  });
});
