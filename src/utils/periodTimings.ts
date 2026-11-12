/**
 * Period timings for the timetable (one setting for every class and section).
 * Times are stored as "hh:mm AM/PM" (what the timetable, attendance and payroll read);
 * the time pickers use "HH:mm". Pure functions, tested in scripts/verify-period-timings.ts.
 */

export interface PeriodRow {
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
  breakType?: string;
  [key: string]: unknown;
}

/** "08:05 AM", "8:05 am", "14:30" → minutes after midnight; null when not a time. */
export function toMinutes(v: unknown): number | null {
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  const mer = m[3]?.toLowerCase();
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** Minutes → "hh:mm AM/PM" (wraps at midnight). */
export function fromMinutes(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  const h24 = Math.floor(t / 60);
  const m = t % 60;
  const mer = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${mer}`;
}

/** Stored value → value for <input type="time"> ("HH:mm"), '' when unknown. */
export function toPickerValue(v: unknown): string {
  const m = toMinutes(v);
  return m === null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** <input type="time"> value → stored "hh:mm AM/PM" ('' stays ''). */
export function fromPickerValue(v: string): string {
  const m = toMinutes(v);
  return m === null ? '' : fromMinutes(m);
}

export function durationMinutes(p: Pick<PeriodRow, 'startTime' | 'endTime'>): number | null {
  const s = toMinutes(p.startTime);
  const e = toMinutes(p.endTime);
  return s === null || e === null ? null : e - s;
}

/** Numbers periods 1..n and names unnamed ones ("Period 3", break → "Break"). */
export function renumber(periods: PeriodRow[]): PeriodRow[] {
  let teaching = 0;
  return periods.map((p, i) => {
    if (!p.isBreak) teaching++;
    const name = String(p.name || '').trim() || (p.isBreak ? 'Break' : `Period ${teaching}`);
    return { ...p, periodNumber: i + 1, name };
  });
}

/**
 * Builds a full day: `count` teaching periods of `periodMinutes` from `firstStart`, with a break of
 * `breakMinutes` after teaching period `breakAfter` (0 = no break).
 */
export function generatePeriods(opts: { firstStart: string; periodMinutes: number; count: number; breakAfter: number; breakMinutes: number; breakName?: string }): PeriodRow[] {
  const start = toMinutes(opts.firstStart);
  if (start === null) return [];
  const len = Math.max(5, Math.round(opts.periodMinutes) || 0);
  const count = Math.min(16, Math.max(1, Math.round(opts.count) || 0));
  const brk = Math.max(0, Math.round(opts.breakMinutes) || 0);
  const out: PeriodRow[] = [];
  let t = start;
  for (let i = 1; i <= count; i++) {
    out.push({ periodNumber: 0, name: `Period ${i}`, startTime: fromMinutes(t), endTime: fromMinutes(t + len) });
    t += len;
    if (opts.breakAfter === i && brk > 0 && i < count) {
      out.push({ periodNumber: 0, name: opts.breakName || 'Recess / Break', startTime: fromMinutes(t), endTime: fromMinutes(t + brk), isBreak: true, breakType: 'RECESS' });
      t += brk;
    }
  }
  return renumber(out);
}

/**
 * Keeps the day back to back after period `idx` changed: every later period starts when the one
 * before ends and keeps its own length.
 */
export function chainAfter(periods: PeriodRow[], idx: number): PeriodRow[] {
  const next = periods.map((p) => ({ ...p }));
  for (let i = idx + 1; i < next.length; i++) {
    const prevEnd = toMinutes(next[i - 1].endTime);
    const len = durationMinutes(next[i]);
    if (prevEnd === null) break;
    const keep = len !== null && len > 0 ? len : 40;
    next[i].startTime = fromMinutes(prevEnd);
    next[i].endTime = fromMinutes(prevEnd + keep);
  }
  return next;
}

/** A new period after the last one, same length as the last teaching period (default 40 min). */
export function nextPeriod(periods: PeriodRow[]): PeriodRow {
  const last = periods[periods.length - 1];
  const lastEnd = last ? toMinutes(last.endTime) : null;
  const ref = [...periods].reverse().find((p) => !p.isBreak);
  const len = (ref && durationMinutes(ref)) || 40;
  const start = lastEnd ?? 8 * 60;
  const teaching = periods.filter((p) => !p.isBreak).length + 1;
  return { periodNumber: periods.length + 1, name: `Period ${teaching}`, startTime: fromMinutes(start), endTime: fromMinutes(start + len) };
}

/** Problems that block saving (same rules as the server) and warnings that do not. */
export function checkPeriods(periods: PeriodRow[], school?: { startTime?: string; endTime?: string }): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!periods.length) errors.push('Add at least one period.');
  const spans: { name: string; s: number; e: number }[] = [];
  periods.forEach((p, i) => {
    const name = p.name || `Period ${i + 1}`;
    const s = toMinutes(p.startTime);
    const e = toMinutes(p.endTime);
    if (s === null || e === null) return void errors.push(`${name}: choose a start and an end time.`);
    if (e <= s) return void errors.push(`${name}: the end time must be after the start time.`);
    spans.push({ name, s, e });
  });
  const sorted = [...spans].sort((a, b) => a.s - b.s);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].s < sorted[i - 1].e) errors.push(`${sorted[i].name} overlaps ${sorted[i - 1].name}.`);
  }
  const open = toMinutes(school?.startTime);
  const close = toMinutes(school?.endTime);
  if (open !== null && close !== null && close <= open) errors.push('Dispersal time must be after the opening time.');
  if (open !== null && sorted.length && sorted[0].s < open) warnings.push(`${sorted[0].name} starts before the school opens.`);
  if (close !== null && sorted.length && sorted[sorted.length - 1].e > close) warnings.push(`${sorted[sorted.length - 1].name} ends after dispersal time.`);
  return { errors, warnings };
}
