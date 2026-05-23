export function getSubredditNamespace(subredditName: string): string {
  return subredditName.trim().toLowerCase().replace(/^r\//i, '');
}

export const keys = {
  claim: (sub: string, postId: string) => `teamspace:${getSubredditNamespace(sub)}:post:${postId}`,
  claimsIndex: (sub: string) => `teamspace:${getSubredditNamespace(sub)}:claims_index`,
  roster: (sub: string) => `teamspace:${getSubredditNamespace(sub)}:active_mods`,
  logs: (sub: string) => `teamspace:${getSubredditNamespace(sub)}:shift_logs`,
};
