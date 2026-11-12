/**
 * School working days and weekly offs.
 *
 * The working days are the ones ticked in Timetable → "Period Timings & Schedule Settings" →
 * School Working Days (schoolSettings.workingDays). Every other weekday is a weekly off, for the
 * attendance calendars (students and staff, website and app) and for payroll.
 *
 * Also used by the server (payroll), so it must stay free of browser / React imports.
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Used only when the school has not saved its working days yet (old behaviour: Sunday off). */
export const DEFAULT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Staff salary is cut for a working day without any attendance mark from this date on. Earlier
 * days are not charged, so months that were never marked in the system are not cut afterwards.
 */
export const UNMARKED_SALARY_CUT_FROM = '2026-11-01';

/** Lower-case set of working weekday names; falls back to Monday–Saturday. */
export function workingDaySet(workingDays?: readonly string[] | null): Set<string> {
  const list = Array.isArray(workingDays) ? workingDays.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean) : [];
  const valid = list.filter((d) => DAY_NAMES.some((n) => n.toLowerCase() === d));
  return new Set(valid.length ? valid : DEFAULT_WORKING_DAYS.map((d) => d.toLowerCase()));
}

/** Weekday name of a YYYY-MM-DD date (calendar date, independent of the device's time zone). */
export function weekdayOf(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()];
}

/** True when the date's weekday is not a school working day. */
export function isWeekOff(iso: string, workingDays?: readonly string[] | null | Set<string>): boolean {
  const set = workingDays instanceof Set ? workingDays : workingDaySet(workingDays as readonly string[] | null | undefined);
  return !set.has(weekdayOf(iso).toLowerCase());
}

/** Weekly-off weekday names, e.g. ['Sunday'] or ['Monday']. */
export function weekOffNames(workingDays?: readonly string[] | null): string[] {
  const set = workingDaySet(workingDays);
  return DAY_NAMES.filter((n) => !set.has(n.toLowerCase()));
}
