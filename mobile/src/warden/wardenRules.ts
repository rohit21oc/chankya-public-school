/**
 * Pure rules for the hostel warden screens (no React, no network), so they can be tested alone.
 * The server enforces access and validation again; these only shape what the screens show.
 */

export type NightStatus = 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'OUTSIDE';
export const NIGHT_STATUSES: NightStatus[] = ['PRESENT', 'ABSENT', 'ON_LEAVE', 'OUTSIDE'];
export type MealKind = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export const MEALS: MealKind[] = ['BREAKFAST', 'LUNCH', 'DINNER'];

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export const STATUS_META: Record<NightStatus, { label: string; short: string; tone: Tone }> = {
  PRESENT: { label: 'Present', short: 'P', tone: 'success' },
  ABSENT: { label: 'Absent', short: 'A', tone: 'danger' },
  ON_LEAVE: { label: 'On Leave', short: 'L', tone: 'info' },
  OUTSIDE: { label: 'Outside', short: 'O', tone: 'warning' },
};

export const MEAL_LABEL: Record<MealKind, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' };

export const statusLabel = (s?: string | null) => (s && s in STATUS_META ? STATUS_META[s as NightStatus].label : 'Not marked');

/** India date (YYYY-MM-DD) offset by whole days. */
export function indiaDate(offsetDays = 0, now = Date.now()): string {
  return new Date(now + 5.5 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Wed, 28 Oct" style label; "Tonight" / "Last night" for today and yesterday. */
export function nightLabel(iso: string, today = indiaDate()): string {
  if (iso === today) return 'Tonight';
  if (iso === shiftDate(today, -1)) return 'Last night';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * The roll-call draft: a status per student the warden has tapped. Students with a saved record are
 * not part of the draft (they are changed through a correction), so a submit never repeats them.
 */
export type Draft = Record<string, NightStatus>;

export function pendingEntries(rows: Array<{ id: string; record: unknown | null }>, draft: Draft): Array<{ studentId: string; status: NightStatus }> {
  return rows.filter((r) => !r.record && draft[r.id]).map((r) => ({ studentId: r.id, status: draft[r.id] }));
}

/** Students still without a status (neither saved nor in the draft). */
export function unmarkedCount(rows: Array<{ id: string; record: unknown | null }>, draft: Draft): number {
  return rows.filter((r) => !r.record && !draft[r.id]).length;
}

/** "Mark all present" fills only the students who have nothing yet; an approved leave pre-fills On Leave. */
export function fillRemaining(rows: Array<{ id: string; record: unknown | null; suggested?: NightStatus | null }>, draft: Draft, status: NightStatus = 'PRESENT'): Draft {
  const next: Draft = { ...draft };
  for (const r of rows) if (!r.record && !next[r.id]) next[r.id] = r.suggested || status;
  return next;
}

/** Counts across saved records and the draft, for the summary strip. */
export function liveCounts(rows: Array<{ id: string; record: { status: NightStatus } | null }>, draft: Draft) {
  const c = { present: 0, absent: 0, onLeave: 0, outside: 0, unmarked: 0, total: rows.length };
  for (const r of rows) {
    const s = r.record?.status || draft[r.id];
    if (s === 'PRESENT') c.present++;
    else if (s === 'ABSENT') c.absent++;
    else if (s === 'ON_LEAVE') c.onLeave++;
    else if (s === 'OUTSIDE') c.outside++;
    else c.unmarked++;
  }
  return c;
}

/** Search + class filter used by My Hostel Students (the server filters too; this keeps typing instant). */
export function filterStudents<T extends { name?: string; admissionNumber?: string; rollNumber?: string | null; roomNumber?: string; classId?: string; className?: string }>(
  list: T[],
  search: string,
  classId: string
): T[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(
    (s) =>
      (!classId || classId === 'ALL' || s.classId === classId || s.className === classId) &&
      words.every((w) => [s.name, s.admissionNumber, s.rollNumber, s.roomNumber ? `room ${s.roomNumber}` : ''].some((v) => String(v || '').toLowerCase().includes(w)))
  );
}

/** Meal items typed one per line or comma separated → clean list. */
export function parseItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** A phone number that can be dialled (digits and a leading +), or null. */
export function dialable(phone?: string | null): string | null {
  const raw = String(phone || '').trim();
  const clean = raw.replace(/[^\d+]/g, '');
  return clean.replace(/\D/g, '').length >= 6 ? clean : null;
}

export const LEAVE_TONE: Record<string, Tone> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'neutral' };
