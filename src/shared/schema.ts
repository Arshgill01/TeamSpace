export interface ClaimState {
  postId: string;
  claimedBy: string;
  claimedAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

export interface ShiftLog {
  id: string;
  timestamp: number;
  mod: string;
  message: string;
  category: 'handover' | 'alert' | 'general';
}

export interface ActiveMod {
  username: string;
  lastActiveAt: number;
}
