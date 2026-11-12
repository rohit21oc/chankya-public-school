/** Small pure rules shared by the Messages screens (kept free of React Native so tests can import them). */

/** "Class 1-A", "Nursery-A": adds "Class" only to bare numbers (records store either "1" or "Class 1"). */
export function classLabel(s: { className?: string; section?: string }): string {
  const c = String(s?.className || '').trim();
  if (!c) return '';
  const name = /^(\d+|[ivx]+)$/i.test(c) ? `Class ${c}` : c;
  return `${name}${s.section ? `-${s.section}` : ''}`;
}

/** Principal / admins may send an emergency message (same list as EMERGENCY_MESSAGE_ROLES on the server). */
export const EMERGENCY_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
