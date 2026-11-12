/**
 * Rules for the hostel warden portal. Pure functions only: no server state, no network, so they can be tested alone.
 */

export type NightStatus = 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'OUTSIDE';
export const NIGHT_STATUSES: NightStatus[] = ['PRESENT', 'ABSENT', 'ON_LEAVE', 'OUTSIDE'];

export type MealKind = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export const MEALS: MealKind[] = ['BREAKFAST', 'LUNCH', 'DINNER'];

/** Roles that open the warden portal. Admin tier may also read it (all hostels), but is checked separately. */
export const WARDEN_ROLE = 'HOSTEL_WARDEN';

/** A warden may correct a night up to this many days back; older nights need the Principal / admins. */
export const WARDEN_CORRECTION_DAYS = 2;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export interface NightEntry {
  studentId: string;
  status: NightStatus;
  remarks?: string;
}

/**
 * Checks one roll-call submission. Every student must be in the warden's own hostel list, appear once,
 * and have one of the four statuses. Returns the cleaned entries or an error message.
 */
export function cleanNightEntries(raw: unknown, allowedStudentIds: Set<string>): { ok: true; entries: NightEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Mark at least one student.' };
  if (raw.length > 2000) return { ok: false, error: 'Too many students in one submission.' };
  const seen = new Set<string>();
  const entries: NightEntry[] = [];
  for (const r of raw as any[]) {
    const studentId = String(r?.studentId || '').trim();
    const status = String(r?.status || '').toUpperCase() as NightStatus;
    if (!studentId) return { ok: false, error: 'A student is missing from the list.' };
    if (!allowedStudentIds.has(studentId)) return { ok: false, error: 'You can mark only students of your own hostel.' };
    if (seen.has(studentId)) return { ok: false, error: 'A student appears twice in the list.' };
    if (!NIGHT_STATUSES.includes(status)) return { ok: false, error: 'Status must be Present, Absent, On Leave or Outside.' };
    seen.add(studentId);
    const remarks = typeof r?.remarks === 'string' ? r.remarks.trim().slice(0, 200) : '';
    entries.push({ studentId, status, ...(remarks ? { remarks } : {}) });
  }
  return { ok: true, entries };
}

/** Who may correct a saved night: admin tier any date; the warden only recent nights and never a future one. */
export function canCorrectNight(role: string, isAdminTier: boolean, nightDate: string, today: string): { ok: boolean; reason?: string } {
  if (isAdminTier) return { ok: true };
  if (role !== WARDEN_ROLE) return { ok: false, reason: 'Only the hostel warden or the Principal can correct night attendance.' };
  const age = daysBetween(nightDate, today);
  if (age < 0) return { ok: false, reason: 'A future night cannot be marked.' };
  if (age > WARDEN_CORRECTION_DAYS) return { ok: false, reason: `Nights older than ${WARDEN_CORRECTION_DAYS} days can be corrected only by the Principal or the office.` };
  return { ok: true };
}

export interface NightCounts {
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  outside: number;
  unmarked: number;
}

/** Counts for one night over the given students (students without a record are "unmarked"). */
export function countNight(records: Array<{ studentId: string; status: string }>, studentIds: string[]): NightCounts {
  const byStudent = new Map(records.map((r) => [r.studentId, r.status]));
  const c: NightCounts = { total: studentIds.length, present: 0, absent: 0, onLeave: 0, outside: 0, unmarked: 0 };
  for (const id of studentIds) {
    const s = byStudent.get(id);
    if (s === 'PRESENT') c.present++;
    else if (s === 'ABSENT') c.absent++;
    else if (s === 'ON_LEAVE') c.onLeave++;
    else if (s === 'OUTSIDE') c.outside++;
    else c.unmarked++;
  }
  return c;
}

/** Every date of a month (YYYY-MM), up to `until` when given (no future nights in a report). */
export function monthDates(month: string, until?: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    if (until && iso > until) break;
    out.push(iso);
  }
  return out;
}

/**
 * Monthly report: per night counts and per student totals. Only nights that were actually taken
 * (at least one record) count towards a student's totals, so a holiday with no roll-call is not "unmarked".
 */
export function monthlyNightReport(
  records: Array<{ studentId: string; status: string; date: string }>,
  students: Array<{ id: string; name?: string; roomNumber?: string }>,
  month: string,
  until?: string
) {
  const dates = monthDates(month, until);
  const inMonth = records.filter((r) => r.date.startsWith(month) && (!until || r.date <= until));
  const ids = students.map((s) => s.id);
  const takenDates = dates.filter((d) => inMonth.some((r) => r.date === d));
  const nights = takenDates.map((date) => ({ date, ...countNight(inMonth.filter((r) => r.date === date), ids) }));
  const perStudent = students.map((s) => {
    const mine = inMonth.filter((r) => r.studentId === s.id);
    const t = { present: 0, absent: 0, onLeave: 0, outside: 0 };
    for (const r of mine) {
      if (r.status === 'PRESENT') t.present++;
      else if (r.status === 'ABSENT') t.absent++;
      else if (r.status === 'ON_LEAVE') t.onLeave++;
      else if (r.status === 'OUTSIDE') t.outside++;
    }
    return { studentId: s.id, name: s.name, roomNumber: s.roomNumber, nightsTaken: takenDates.length, ...t, unmarked: Math.max(0, takenDates.length - mine.length) };
  });
  return { month, nightsTaken: takenDates.length, nights, perStudent };
}

export interface MealInput {
  meal: MealKind;
  time?: string;
  items: string[];
}

/** Cleans a mess menu: the three meals in order, each with up to 20 short items and an optional time. */
export function cleanMessMenu(raw: unknown): { ok: true; meals: MealInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'Add the meals for the day.' };
  const byMeal = new Map<MealKind, MealInput>();
  for (const r of raw as any[]) {
    const meal = String(r?.meal || '').toUpperCase() as MealKind;
    if (!MEALS.includes(meal)) return { ok: false, error: 'Meal must be Breakfast, Lunch or Dinner.' };
    if (byMeal.has(meal)) return { ok: false, error: `${meal.charAt(0) + meal.slice(1).toLowerCase()} is listed twice.` };
    const items = (Array.isArray(r?.items) ? r.items : String(r?.items || '').split(/[,\n]/))
      .map((x: unknown) => String(x || '').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 20);
    const time = typeof r?.time === 'string' ? r.time.trim().slice(0, 40) : '';
    byMeal.set(meal, { meal, ...(time ? { time } : {}), items });
  }
  const meals = MEALS.filter((m) => byMeal.has(m)).map((m) => byMeal.get(m)!);
  if (!meals.some((m) => m.items.length > 0)) return { ok: false, error: 'Add at least one item to a meal.' };
  return { ok: true, meals };
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 1 = Monday … 7 = Sunday for a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const js = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/**
 * The menu shown for one day: a special menu saved for that date wins; otherwise the weekly menu of that
 * weekday; otherwise (older data, no weekly menu yet) the latest earlier special menu, labelled.
 */
export function resolveDayMenu<M extends { hostelId: string; date: string }, W extends { hostelId: string; weekday: number }>(
  hostelId: string,
  date: string,
  specials: M[],
  weekly: W[]
): { source: 'SPECIAL' | 'WEEKLY' | 'EARLIER' | null; menu: M | W | null; weekday: number; carriedFrom: string | null } {
  const weekday = weekdayOf(date);
  const special = specials.find((m) => m.hostelId === hostelId && m.date === date);
  if (special) return { source: 'SPECIAL', menu: special, weekday, carriedFrom: null };
  const week = weekly.find((w) => w.hostelId === hostelId && w.weekday === weekday);
  if (week) return { source: 'WEEKLY', menu: week, weekday, carriedFrom: null };
  if (weekly.some((w) => w.hostelId === hostelId)) return { source: null, menu: null, weekday, carriedFrom: null };
  const earlier = specials.filter((m) => m.hostelId === hostelId && m.date < date).sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
  return earlier ? { source: 'EARLIER', menu: earlier, weekday, carriedFrom: earlier.date } : { source: null, menu: null, weekday, carriedFrom: null };
}

/** True when an approved leave covers this date. */
export const leaveCovers = (l: { status?: string; startDate?: string; endDate?: string }, date: string) =>
  l?.status === 'APPROVED' && !!l.startDate && !!l.endDate && l.startDate <= date && l.endDate >= date;
