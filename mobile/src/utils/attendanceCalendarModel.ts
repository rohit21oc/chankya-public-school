/**
 * Pure model for the monthly attendance calendar (staff and students).
 * Every day gets exactly one kind. A day with no attendance record is NO_RECORD — it is never
 * assumed to be present or absent.
 */
export type DayKind =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'NO_RECORD'
  | 'FUTURE';

import { isWeekOff, workingDaySet, UNMARKED_SALARY_CUT_FROM } from './workingDays';

export interface CalendarRecord { date: string; status?: string; checkInTime?: string; markedAt?: string; remarks?: string }

/** "09:12 AM" in India time from an ISO timestamp (older records only have when they were saved). */
export const istTime = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
};
export interface CalendarHoliday { name?: string; date: string; endDate?: string }
export interface CalendarLeave { startDate: string; endDate: string; status?: string; leaveType?: string }

export interface CalendarDay {
  iso: string;
  day: number;
  kind: DayKind;
  /** Short explanation shown in the day-details sheet. */
  detail: string;
  checkInTime?: string;
  remarks?: string;
  /** Staff: this day costs one day's salary (absent, or a past working day with no mark). */
  salaryCut?: boolean;
}

export interface MonthTotals {
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  leave: number;
  holiday: number;
  weekOff: number;
  noRecord: number;
  /** Staff only: days charged one day's salary (absent + unmarked working days). */
  salaryCut: number;
}

export interface MonthModel {
  year: number;
  month: number; // 0-11
  title: string;
  /** Rows of 7 (Sunday first). null = padding cell outside the month. */
  weeks: Array<Array<CalendarDay | null>>;
  totals: MonthTotals;
  hasAnyRecord: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const dateOnly = (v?: string) => String(v || '').substring(0, 10);

export function kindFromStatus(raw?: string): DayKind | null {
  const s = String(raw || '').trim().toUpperCase().replace(/[\s-]/g, '_');
  switch (s) {
    case 'PRESENT': return 'PRESENT';
    case 'LATE': return 'LATE';
    case 'HALF_DAY': return 'HALF_DAY';
    case 'ABSENT': case 'LWP': case 'UNPAID_LEAVE': return 'ABSENT';
    case 'LEAVE': case 'ON_LEAVE': return 'LEAVE';
    case 'HOLIDAY': return 'HOLIDAY';
    case 'WEEK_OFF': case 'WEEKLY_OFF': return 'WEEK_OFF';
    default: return null;
  }
}

export function buildMonthModel(input: {
  year: number;
  month: number;
  records: CalendarRecord[];
  holidays?: CalendarHoliday[];
  leaves?: CalendarLeave[];
  /** School working weekdays, e.g. ['Monday', ...]. Weekly offs are only shown when this is known. */
  workingDays?: string[];
  todayIso: string;
  /** Staff calendars: mark absent / unmarked working days as a one-day salary cut (payroll rule). */
  salaryCut?: boolean;
}): MonthModel {
  const { year, month, todayIso } = input;
  const recByDate = new Map<string, CalendarRecord>();
  for (const r of input.records || []) {
    const d = dateOnly(r.date);
    if (d && kindFromStatus(r.status) && !recByDate.has(d)) recByDate.set(d, r);
  }
  // School Working Days; Monday–Saturday when the school has not saved them (same default as the server).
  const workingSet = workingDaySet(input.workingDays);

  const holidayFor = (iso: string) =>
    (input.holidays || []).find((h) => {
      const start = dateOnly(h.date);
      const end = dateOnly(h.endDate) || start;
      return !!start && iso >= start && iso <= end;
    });
  const leaveFor = (iso: string) =>
    (input.leaves || []).find((l) => String(l.status || '').toUpperCase() === 'APPROVED' && iso >= dateOnly(l.startDate) && iso <= dateOnly(l.endDate));

  const totals: MonthTotals = { present: 0, late: 0, halfDay: 0, absent: 0, leave: 0, holiday: 0, weekOff: 0, noRecord: 0, salaryCut: 0 };
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: Array<CalendarDay | null> = Array(firstDow).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(year, month, d);
    const rec = recByDate.get(iso);
    const hol = holidayFor(iso);
    const lv = leaveFor(iso);
    let kind: DayKind;
    let detail: string;

    if (rec) {
      kind = kindFromStatus(rec.status)!;
      detail = ({
        PRESENT: 'Present', LATE: 'Present (late)', HALF_DAY: 'Half day', ABSENT: 'Absent', LEAVE: 'On leave',
        HOLIDAY: 'Holiday', WEEK_OFF: 'Weekly off',
      } as Record<string, string>)[kind] || kind;
      if (kind === 'HOLIDAY' && hol?.name) detail = hol.name;
    } else if (hol) {
      kind = 'HOLIDAY';
      detail = hol.name || 'Holiday';
    } else if (lv) {
      kind = 'LEAVE';
      detail = `Approved leave${lv.leaveType ? ` (${String(lv.leaveType).toLowerCase()})` : ''}`;
    } else if (isWeekOff(iso, workingSet)) {
      kind = 'WEEK_OFF';
      detail = 'Weekly off';
    } else if (iso > todayIso) {
      kind = 'FUTURE';
      detail = 'Upcoming';
    } else {
      kind = 'NO_RECORD';
      detail = 'No attendance recorded';
    }

    switch (kind) {
      case 'PRESENT': totals.present++; break;
      case 'LATE': totals.late++; break;
      case 'HALF_DAY': totals.halfDay++; break;
      case 'ABSENT': totals.absent++; break;
      case 'LEAVE': totals.leave++; break;
      case 'HOLIDAY': totals.holiday++; break;
      case 'WEEK_OFF': totals.weekOff++; break;
      case 'NO_RECORD': totals.noRecord++; break;
    }
    // Payroll rule: on a working day an absence costs one day's salary, and so does a past day with no
    // mark at all (from the rule's start date). Weekly offs, holidays and approved leave are not cut.
    const salaryCut =
      !!input.salaryCut &&
      !isWeekOff(iso, workingSet) &&
      (kind === 'ABSENT' || (kind === 'NO_RECORD' && iso < todayIso && iso >= UNMARKED_SALARY_CUT_FROM));
    if (salaryCut) {
      totals.salaryCut++;
      detail = `${kind === 'ABSENT' ? 'Absent' : 'Attendance not marked'} · 1 day salary cut`;
    }
    cells.push({ iso, day: d, kind, detail, salaryCut, checkInTime: rec?.checkInTime || (kind === 'PRESENT' || kind === 'LATE' ? istTime(rec?.markedAt) : undefined), remarks: rec?.remarks });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: MonthModel['weeks'] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    year,
    month,
    title: `${MONTHS[month]} ${year}`,
    weeks,
    totals,
    hasAnyRecord: Array.from(recByDate.keys()).some((k) => k.startsWith(`${year}-${pad(month + 1)}`)),
  };
}

export const shiftMonth = (year: number, month: number, delta: number) => {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};
