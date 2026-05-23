import { redis as devvitRedis } from '@devvit/web/server';
import type { RedisClient } from '@devvit/redis';
import { keys } from './redis.js';
import type { ClaimState } from '../../shared/schema.js';

export class ClaimsService {
  private readonly redis: RedisClient;
  private readonly subreddit: string;

  constructor(subreddit: string, redis: RedisClient = devvitRedis) {
    this.redis = redis;
    this.subreddit = subreddit;
  }

  public async claimPost(
    postId: string,
    username: string,
    durationSeconds: number = 900 // 15 minutes default
  ): Promise<{ success: boolean; claim?: ClaimState; error?: string }> {
    const key = keys.claim(this.subreddit, postId);
    const existing = await this.redis.get(key);

    if (existing) {
      try {
        const claim = JSON.parse(existing) as ClaimState;
        if (claim.claimedBy !== username && claim.expiresAt > Date.now()) {
          return {
            success: false,
            claim,
            error: `Post is already claimed by u/${claim.claimedBy}`,
          };
        }
      } catch (e) {
        // Overwrite corrupted JSON
      }
    }

    const claimedAt = Date.now();
    const expiresAt = claimedAt + durationSeconds * 1000;
    const claim: ClaimState = { postId, claimedBy: username, claimedAt, expiresAt };

    await this.redis.set(key, JSON.stringify(claim), {
      expiration: new Date(expiresAt),
    });

    // Add to active claims index (score = expiresAt)
    await this.redis.zAdd(keys.claimsIndex(this.subreddit), { member: postId, score: expiresAt });

    return { success: true, claim };
  }

  public async getClaim(postId: string): Promise<ClaimState | null> {
    const key = keys.claim(this.subreddit, postId);
    const data = await this.redis.get(key);
    if (!data) {
      // Clean up index if no claim details exist
      await this.redis.zRem(keys.claimsIndex(this.subreddit), [postId]);
      return null;
    }

    try {
      const claim = JSON.parse(data) as ClaimState;
      if (claim.expiresAt <= Date.now()) {
        await this.redis.del(key);
        await this.redis.zRem(keys.claimsIndex(this.subreddit), [postId]);
        return null;
      }
      return claim;
    } catch (e) {
      return null;
    }
  }

  public async releaseClaim(postId: string): Promise<void> {
    const key = keys.claim(this.subreddit, postId);
    await this.redis.del(key);
    await this.redis.zRem(keys.claimsIndex(this.subreddit), [postId]);
  }

  public async getActiveClaims(): Promise<ClaimState[]> {
    const indexKey = keys.claimsIndex(this.subreddit);
    const members = await this.redis.zRange(indexKey, 0, -1);
    const activeClaims: ClaimState[] = [];

    for (const m of members) {
      const claim = await this.getClaim(m.member);
      if (claim) {
        activeClaims.push(claim);
      }
    }

    return activeClaims.sort((a, b) => b.claimedAt - a.claimedAt);
  }
}
