import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShiftsService } from './shifts.js';
import type { RedisClient } from '@devvit/redis';

describe('ShiftsService', () => {
  let mockRedis: any;
  let service: ShiftsService;

  beforeEach(() => {
    mockRedis = {
      zAdd: vi.fn(),
      zRange: vi.fn(),
      zRemRangeByRank: vi.fn(),
      hSet: vi.fn(),
      hGetAll: vi.fn(),
      hDel: vi.fn(),
    };
    service = new ShiftsService('testsub', mockRedis as unknown as RedisClient);
  });

  it('pushes shift notes to circular buffer list', async () => {
    mockRedis.zAdd.mockResolvedValue(1);
    mockRedis.zRemRangeByRank.mockResolvedValue(0);

    const log = await service.logShiftNote('mod_a', 'Spam attack on sticky post', 'alert');
    expect(log.mod).toBe('mod_a');
    expect(log.category).toBe('alert');
    expect(mockRedis.zAdd).toHaveBeenCalled();
    expect(mockRedis.zRemRangeByRank).toHaveBeenCalledWith(expect.any(String), 0, -51);
  });

  it('records heartbeat and filters active roster correctly', async () => {
    const activeTime = Date.now();
    const staleTime = Date.now() - 90000000; // >24h
    
    mockRedis.hGetAll.mockResolvedValue({
      mod_active: activeTime.toString(),
      mod_stale: staleTime.toString(),
    });
    mockRedis.hDel.mockResolvedValue(1);

    const roster = await service.getActiveRoster();
    expect(roster.length).toBe(1);
    expect(roster[0]?.username).toBe('mod_active');
    expect(mockRedis.hDel).toHaveBeenCalledWith(expect.any(String), ['mod_stale']);
  });
});
