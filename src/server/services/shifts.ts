import { redis as devvitRedis } from '@devvit/web/server';
import type { RedisClient } from '@devvit/redis';
import { keys } from './redis.js';
import type { ShiftLog, ActiveMod } from '../../shared/schema.js';

export class ShiftsService {
  private readonly redis: RedisClient;
  private readonly subreddit: string;

  constructor(subreddit: string, redis: RedisClient = devvitRedis) {
    this.redis = redis;
    this.subreddit = subreddit;
  }

  public async logShiftNote(
    mod: string,
    message: string,
    category: 'handover' | 'alert' | 'general' = 'general'
  ): Promise<ShiftLog> {
    const logsKey = keys.logs(this.subreddit);
    const log: ShiftLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      mod,
      message,
      category,
    };

    // Store in a Sorted Set as a circular buffer (score = timestamp)
    await this.redis.zAdd(logsKey, { member: JSON.stringify(log), score: log.timestamp });
    // Keep only the 50 newest items: delete oldest from rank 0 to rank -51
    await this.redis.zRemRangeByRank(logsKey, 0, -51);

    return log;
  }

  public async getShiftLogs(): Promise<ShiftLog[]> {
    const logsKey = keys.logs(this.subreddit);
    const members = await this.redis.zRange(logsKey, 0, -1);
    
    // Parse and reverse to return newest first
    return members.map((m) => {
      try {
        return JSON.parse(m.member) as ShiftLog;
      } catch (e) {
        return {
          id: 'corrupted',
          timestamp: Date.now(),
          mod: 'system',
          message: 'Failed to parse shift note.',
          category: 'general' as const,
        };
      }
    }).reverse();
  }

  public async recordModHeartbeat(username: string): Promise<void> {
    const rosterKey = keys.roster(this.subreddit);
    await this.redis.hSet(rosterKey, {
      [username]: Date.now().toString(),
    });
  }

  public async getActiveRoster(maxAgeMs: number = 86400000): Promise<ActiveMod[]> {
    const rosterKey = keys.roster(this.subreddit);
    const allEntries = await this.redis.hGetAll(rosterKey);
    const now = Date.now();
    const roster: ActiveMod[] = [];

    for (const [username, timestampStr] of Object.entries(allEntries)) {
      const lastActiveAt = parseInt(timestampStr, 10);
      if (now - lastActiveAt <= maxAgeMs) {
        roster.push({ username, lastActiveAt });
      } else {
        // Stale entry, cleanup
        await this.redis.hDel(rosterKey, [username]);
      }
    }

    return roster.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }
}
