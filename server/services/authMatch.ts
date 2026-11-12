/**
 * Picks ONE record for a sign-in or session. Exact keys (id, employee ID, username) are tried first, in order.
 * Shared keys (email, mobile) count only when exactly one record has them: several staff often share the school
 * email, and "first record that matches anything" used to open another person's account and profile.
 */
export function pickByPriority<T>(list: T[], exact: Array<(x: T) => boolean>, shared: Array<(x: T) => boolean> = []): T | undefined {
  for (const test of exact) {
    const hit = list.find(test);
    if (hit) return hit;
  }
  for (const test of shared) {
    const hits = list.filter(test);
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}
