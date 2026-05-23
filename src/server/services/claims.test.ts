import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimsService } from './claims.js';
import type { RedisClient } from '@devvit/public-api';

describe('ClaimsService', () => {
  let mockRedis: any;
  let service: ClaimsService;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      sAdd: vi.fn(),
      sRem: vi.fn(),
      sMembers: vi.fn(),
    };
    service = new ClaimsService('testsub', mockRedis as unknown as RedisClient);
  });

  it('allows claiming a free post', async () => {
    mockRedis.get.mockResolvedValue(null);
    const res = await service.claimPost('post1', 'mod_a');
    expect(res.success).toBe(true);
    expect(res.claim?.claimedBy).toBe('mod_a');
    expect(mockRedis.set).toHaveBeenCalled();
    expect(mockRedis.sAdd).toHaveBeenCalledWith(expect.any(String), 'post1');
  });

  it('rejects claiming an already claimed post by another mod', async () => {
    const activeClaim = {
      postId: 'post1',
      claimedBy: 'mod_a',
      claimedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(activeClaim));
    const res = await service.claimPost('post1', 'mod_b');
    expect(res.success).toBe(false);
    expect(res.error).toContain('already claimed by u/mod_a');
  });

  it('allows claiming again if the previous claim is expired', async () => {
    const expiredClaim = {
      postId: 'post1',
      claimedBy: 'mod_a',
      claimedAt: Date.now() - 1000000,
      expiresAt: Date.now() - 100000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(expiredClaim));
    const res = await service.claimPost('post1', 'mod_b');
    expect(res.success).toBe(true);
    expect(res.claim?.claimedBy).toBe('mod_b');
  });

  it('releases a claim and updates the index', async () => {
    await service.releaseClaim('post1');
    expect(mockRedis.del).toHaveBeenCalled();
    expect(mockRedis.sRem).toHaveBeenCalledWith(expect.any(String), 'post1');
  });

  it('retrieves active claims correctly', async () => {
    const claimA = {
      postId: 'postA',
      claimedBy: 'mod_a',
      claimedAt: Date.now() - 50000,
      expiresAt: Date.now() + 500000,
    };
    const claimB = {
      postId: 'postB',
      claimedBy: 'mod_b',
      claimedAt: Date.now() - 10000,
      expiresAt: Date.now() + 600000,
    };
    
    mockRedis.sMembers.mockResolvedValue(['postA', 'postB']);
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('postA')) return Promise.resolve(JSON.stringify(claimA));
      if (key.includes('postB')) return Promise.resolve(JSON.stringify(claimB));
      return Promise.resolve(null);
    });

    const active = await service.getActiveClaims();
    expect(active.length).toBe(2);
    expect(active[0].postId).toBe('postB');
    expect(active[1].postId).toBe('postA');
  });
});
