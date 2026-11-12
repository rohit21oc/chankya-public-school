/**
 * Date-of-birth typing helper for the student / parent sign-in boxes.
 * The default password is the child's date of birth as DD-MM-YYYY, so while someone types only digits
 * the dashes are added for them: "20" -> "20-", "2004" -> "20-04-", "20042015" -> "20-04-2015".
 * Anything that is clearly a password instead of a date (letters, symbols, or a date typed year-first)
 * is left exactly as typed.
 */
export function formatDobAsTyped(raw: string, previous = ''): string {
  const value = raw ?? '';
  if (!/^[\d\-/]*$/.test(value)) return value; // letters or symbols: a password, not a date
  if (/^\d{4}[-/]/.test(value)) return value; // typed year-first (YYYY-MM-DD)
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const typingForward = value.length >= previous.length;
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '-' + digits.slice(2, 4);
  if (digits.length > 4) out += '-' + digits.slice(4, 8);
  if (typingForward && (digits.length === 2 || digits.length === 4)) out += '-';
  return out;
}

/** True when the text is a complete DD-MM-YYYY date. */
export function isCompleteDob(value: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(value);
}

/**
 * What to send as the secret. A purely numeric password also looks like a date while it is being typed,
 * so a half-typed date is sent without the dashes that were added for display.
 */
export function dobSecretForSubmit(value: string): { primary: string; alternate?: string } {
  const trimmed = (value || '').trim();
  if (/^\d{2}(-\d{0,2}){0,2}-?$/.test(trimmed) && !isCompleteDob(trimmed)) {
    return { primary: trimmed.replace(/-/g, '') };
  }
  if (isCompleteDob(trimmed)) return { primary: trimmed, alternate: trimmed.replace(/-/g, '') };
  return { primary: trimmed };
}
