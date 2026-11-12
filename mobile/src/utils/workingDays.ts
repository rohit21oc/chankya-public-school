/**
 * School working days and weekly offs (same rules as the website's src/utils/workingDays.ts).
 * Working days come from School Settings → School Working Days; other weekdays are weekly offs.
 */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DEFAULT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Staff salary is cut for an unmarked working day from this date on (same as the server). */
export const UNMARKED_SALARY_CUT_FROM = '2026-11-01';

export function workingDaySet(workingDays?: readonly string[] | null): Set<string> {
  const list = Array.isArray(workingDays) ? workingDays.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean) : [];
  const valid = list.filter((d) => DAY_NAMES.some((n) => n.toLowerCase() === d));
  return new Set(valid.length ? valid : DEFAULT_WORKING_DAYS.map((d) => d.toLowerCase()));
}

export function isWeekOff(iso: string, working: Set<string>): boolean {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return !working.has(DAY_NAMES[new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()].toLowerCase());
}
