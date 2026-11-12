/**
 * Password rules for passwords a person chooses themselves (change password and
 * forgot-password reset). Admin-issued temporary passwords keep their own rule.
 * Shared wording is mirrored in the web and mobile forms.
 */
export const PASSWORD_RULE_TEXT = 'Use at least 8 characters with at least one letter and one number.';

export function validateNewPassword(pw: unknown): string | null {
  const p = String(pw ?? '');
  if (p.trim() !== p) return 'The password cannot start or end with a space.';
  if (p.length < 8) return PASSWORD_RULE_TEXT;
  if (p.length > 128) return 'The password is too long (max 128 characters).';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return PASSWORD_RULE_TEXT;
  if (/^(.)\1+$/.test(p)) return 'Choose a password that is harder to guess.';
  const common = ['password1', 'password123', '12345678a', 'qwerty123', 'abc12345', 'cps12345', 'school123', 'welcome1'];
  if (common.includes(p.toLowerCase())) return 'That password is too common. Choose another.';
  return null;
}

/** Small fixed-window limiter (in memory, per server instance). */
export class AttemptLimiter {
  private hits = new Map<string, { count: number; first: number }>();
  constructor(private max: number, private windowMs: number) {}
  /** Returns seconds to wait if blocked, else 0. Does not count the attempt. */
  blockedFor(key: string, now = Date.now()): number {
    const h = this.hits.get(key);
    if (!h || now - h.first > this.windowMs) return 0;
    return h.count >= this.max ? Math.ceil((h.first + this.windowMs - now) / 1000) : 0;
  }
  hit(key: string, now = Date.now()): void {
    const h = this.hits.get(key);
    if (!h || now - h.first > this.windowMs) this.hits.set(key, { count: 1, first: now });
    else h.count++;
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (now - v.first > this.windowMs) this.hits.delete(k);
    }
  }
  reset(key: string): void {
    this.hits.delete(key);
  }
}
