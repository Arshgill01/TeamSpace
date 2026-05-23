import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShiftsService } from './shifts.js';
import type { RedisClient } from '@devvit/public-api';

describe('ShiftsService', () => {
  let mockRedis: any;
  let service: ShiftsService;

  beforeEach(() => {
    mockRedis = {
      lPush: vi.fn(),
      lTrim: vi.fn(),
      lRange: vi.fn(),
      hSet: vi.fn(),
      hGetAll: vi.fn(),
      hDel: vi.fn(),
    };
    service = new ShiftsService('testsub', mockRedis as unknown as RedisClient);
  });

  it('pushes shift notes to circular buffer list', async () => {
    mockRedis.lPush.mockResolvedValue(1);
    mockRedis.lTrim.mockResolvedValue('OK');

    const log = await service.logShiftNote('mod_a', 'Spam attack on sticky post', 'alert');
    expect(log.mod).toBe('mod_a');
    expect(log.category).toBe('alert');
    expect(mockRedis.lPush).toHaveBeenCalled();
    expect(mockRedis.lTrim).toHaveBeenCalledWith(expect.any(String), 0, 49);
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
    expect(roster[0].username).toBe('mod_active');
    expect(mockRedis.hDel).toHaveBeenCalledWith(expect.any(String), ['mod_stale']);
  });
});
