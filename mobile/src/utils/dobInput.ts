/**
 * Date-of-birth typing helper for the Student and Parent login fields.
 * Digits are turned into DD-MM-YYYY while typing ("27122003" -> "27-12-2003").
 * The same field also accepts a portal password, so anything containing a
 * letter or another symbol is left exactly as typed.
 */
export function formatDobInput(raw: string): string {
  const text = String(raw ?? '');
  if (/[^0-9\-\/.\s]/.test(text)) return text; // looks like a password
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}
