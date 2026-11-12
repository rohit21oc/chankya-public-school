/**
 * Same rule as server/services/passwordPolicy.ts for passwords a person chooses
 * (change password, forgot-password reset). The server checks it again.
 */
export const PASSWORD_RULE_TEXT = 'Use at least 8 characters with at least one letter and one number.';

export function validateNewPassword(p: string): string | null {
  if (p.trim() !== p) return 'The password cannot start or end with a space.';
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) return PASSWORD_RULE_TEXT;
  if (p.length > 128) return 'The password is too long (max 128 characters).';
  return null;
}
