import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}));

// Mock the devvit modules before importing the app
vi.mock('@devvit/web/server', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    zAdd: vi.fn(),
    zRem: vi.fn(),
    zRange: vi.fn(),
    zRemRangeByRank: vi.fn(),
    hSet: vi.fn(),
    hGetAll: vi.fn(),
    hDel: vi.fn(),
  };
  const mockReddit = {
    submitCustomPost: vi.fn().mockResolvedValue({ permalink: '/r/testsub/comments/xyz/dashboard' }),
  };
  const mockContext = {
    subredditName: 'playtestsub',
    username: 'SeniorMod',
  };
  return {
    redis: mockRedis,
    reddit: mockReddit,
    context: mockContext,
    createServer: vi.fn(),
    getServerPort: vi.fn().mockReturnValue(8000),
  };
});

// Now import redis and reddit from the mocked server module
import { redis as mockRedis } from '@devvit/web/server';
import { app } from '../index.js';

describe('Hono Route Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/health returns health status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('ok');
    expect(json.app).toBe('teamspace');
  });

  it('GET /api/claims returns list of active claims', async () => {
    const mockZSet = [{ member: 'postA', score: Date.now() + 600000 }];
    const claimA = {
      postId: 'postA',
      claimedBy: 'mod_a',
      claimedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    (mockRedis.zRange as any).mockResolvedValue(mockZSet);
    (mockRedis.get as any).mockResolvedValue(JSON.stringify(claimA));

    const res = await app.request('/api/claims?subreddit=playtestsub');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.length).toBe(1);
    expect(json[0].postId).toBe('postA');
  });

  it('POST /api/shifts logs a new shift note', async () => {
    (mockRedis.zAdd as any).mockResolvedValue(1);
    (mockRedis.zRemRangeByRank as any).mockResolvedValue(0);
    (mockRedis.hSet as any).mockResolvedValue(1);

    const res = await app.request('/api/shifts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-name': 'TestMod',
      },
      body: JSON.stringify({
        subreddit: 'playtestsub',
        message: 'Shift starting now.',
        category: 'handover',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(json.log.message).toBe('Shift starting now.');
    expect(json.log.mod).toBe('TestMod');
  });

  it('GET /api/shifts returns shift logs', async () => {
    const mockLog = {
      id: 'log1',
      timestamp: Date.now(),
      mod: 'mod_a',
      message: 'test log message',
      category: 'general',
    };
    (mockRedis.zRange as any).mockResolvedValue([{ member: JSON.stringify(mockLog) }]);

    const res = await app.request('/api/shifts?subreddit=playtestsub');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.length).toBe(1);
    expect(json[0].message).toBe('test log message');
  });

  it('GET /api/roster returns active mod roster', async () => {
    (mockRedis.hGetAll as any).mockResolvedValue({
      mod_a: Date.now().toString(),
    });

    const res = await app.request('/api/roster?subreddit=playtestsub');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.length).toBe(1);
    expect(json[0].username).toBe('mod_a');
  });

  it('POST /internal/menu/claim-post claims a post via menu action', async () => {
    (mockRedis.get as any).mockResolvedValue(null);
    (mockRedis.set as any).mockResolvedValue('OK');
    (mockRedis.zAdd as any).mockResolvedValue(1);

    const res = await app.request('/internal/menu/claim-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: 'post',
        targetId: 't3_post123',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.showToast?.text).toContain('claimed this post');
    expect(json.showToast?.appearance).toBe('success');
  });

  it('POST /internal/menu/open-dashboard opens the dashboard custom post', async () => {
    const res = await app.request('/internal/menu/open-dashboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: 'subreddit',
        targetId: 't5_sub123',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.navigateTo).toBe('/r/testsub/comments/xyz/dashboard');
    expect(json.showToast?.text).toContain('Opening TeamSpace dashboard');
  });

  it('POST /internal/triggers/on-mod-action clears claim and updates heartbeat', async () => {
    (mockRedis.del as any).mockResolvedValue(1);
    (mockRedis.zRem as any).mockResolvedValue(1);
    (mockRedis.hSet as any).mockResolvedValue(1);

    const res = await app.request('/internal/triggers/on-mod-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ModAction',
        subreddit: { id: 't5_123', name: 'playtestsub' },
        targetPost: { id: 't3_post123' },
        moderator: { id: 't2_456', name: 'SeniorMod' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('success');
    expect(mockRedis.del).toHaveBeenCalled();
    expect(mockRedis.hSet).toHaveBeenCalled();
  });
});
