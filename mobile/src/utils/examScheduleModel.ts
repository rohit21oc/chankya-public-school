/**
 * Exam schedule for one class, shared by the parent, student and staff screens.
 * Pure functions over what /api/exams already returns: nothing is invented, so a paper without a
 * time or room simply shows without one.
 */
export interface ExamPaperLike {
  id?: string;
  subjectId?: string;
  subjectName?: string;
  classId?: string;
  className?: string;
  section?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  roomNumber?: string;
  instructions?: string;
}

export interface ExamLike {
  id: string;
  name?: string;
  title?: string;
  examType?: string;
  type?: string;
  academicSession?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  classIds?: string[];
  classId?: string;
  schedule?: ExamPaperLike[];
}

export type PaperPhase = 'today' | 'upcoming' | 'completed';

export interface SchedulePaper {
  key: string;
  examId: string;
  examName: string;
  examType: string;
  subject: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  startTime: string;
  endTime: string;
  durationLabel: string;
  room: string;
  instructions: string;
  phase: PaperPhase;
}

export interface ExamWithoutTimetable {
  examId: string;
  examName: string;
  examType: string;
  startDate: string;
  endDate: string;
  phase: PaperPhase;
}

export interface ScheduleFilter {
  classId?: string;
  section?: string;
  examType?: string; // '' or 'ALL' = every type
  month?: string; // '' or 'ALL' = every month
}

/** "9:00 AM", "09:00", "1:30pm" → minutes after midnight, or null when unreadable. */
export function minutesOf(t?: string): number | null {
  const m = String(t ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** "09:00" / "9:00 am" → "09:00 AM"; unreadable text is returned as typed. */
export function timeLabel(t?: string): string {
  const mins = minutesOf(t);
  if (mins === null) return String(t ?? '').trim();
  const h24 = Math.floor(mins / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "2 Hours", "1 Hour 30 Min", "45 Min"; empty when the times are missing or end before start. */
export function durationLabel(start?: string, end?: string): string {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (a === null || b === null || b <= a) return '';
  const total = b - a;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hp = h ? `${h} ${h === 1 ? 'Hour' : 'Hours'}` : '';
  const mp = m ? `${m} Min` : '';
  return [hp, mp].filter(Boolean).join(' ');
}

const ymd = (v?: string) => {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parts(date: string): { day: string; mon: string; year: string; weekday: string } {
  const d = ymd(date);
  if (!d) return { day: '--', mon: '', year: '', weekday: '' };
  const [y, m, dd] = d.split('-').map(Number);
  return { day: String(dd), mon: MONTHS[m - 1] || '', year: String(y), weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] };
}

/** "Monday, 15 Nov 2026" */
export function longDate(date: string): string {
  const p = parts(date);
  return p.mon ? `${p.weekday}, ${p.day.padStart(2, '0')} ${p.mon} ${p.year}` : 'Date not set';
}

/** "2026-11" → "Nov 2026" */
export function monthLabel(month: string): string {
  const [y, m] = String(month).split('-').map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : month;
}

const typeOf = (e: ExamLike) => String(e.examType || e.type || '').trim();
const nameOf = (e: ExamLike) => String(e.name || e.title || 'Examination').trim();

const examClassIds = (e: ExamLike) => (Array.isArray(e.classIds) && e.classIds.length > 0 ? e.classIds : e.classId ? [e.classId] : []);

/** Same exam saved twice (same name and dates) counts once. */
const examKey = (e: ExamLike) => `${nameOf(e).toLowerCase()}|${e.startDate || ''}|${e.endDate || ''}`;

function phaseOf(date: string, today: string): PaperPhase {
  return date === today ? 'today' : date > today ? 'upcoming' : 'completed';
}

/** Exams the class sits that have been released (drafts are never shown), without duplicates. */
function visibleExams(exams: ExamLike[] | null | undefined, classId?: string): ExamLike[] {
  return (exams || [])
    .filter((e) => e && e.id && e.status !== 'DRAFT')
    .filter((e) => {
      const ids = examClassIds(e);
      return ids.length === 0 || !classId || ids.includes(classId);
    })
    .filter((e, i, all) => all.findIndex((o) => examKey(o) === examKey(e)) === i);
}

/** One row per paper of this class (and section), in date and time order. */
export function buildSchedule(exams: ExamLike[] | null | undefined, filter: ScheduleFilter, today: string): { papers: SchedulePaper[]; noTimetable: ExamWithoutTimetable[] } {
  const wantType = filter.examType && filter.examType !== 'ALL' ? filter.examType : '';
  const wantMonth = filter.month && filter.month !== 'ALL' ? filter.month : '';
  const section = String(filter.section || '').toUpperCase();
  const papers: SchedulePaper[] = [];
  const noTimetable: ExamWithoutTimetable[] = [];

  for (const e of visibleExams(exams, filter.classId)) {
    if (wantType && typeOf(e) !== wantType) continue;
    const mine = (Array.isArray(e.schedule) ? e.schedule : []).filter((p) => {
      if (!ymd(p.date)) return false;
      if (p.classId && filter.classId && p.classId !== filter.classId) return false;
      const sec = String(p.section || 'ALL').toUpperCase();
      return sec === 'ALL' || !section || sec === section;
    });
    if (mine.length === 0) {
      const start = ymd(e.startDate);
      if (!start || (wantMonth && start.slice(0, 7) !== wantMonth)) continue;
      noTimetable.push({ examId: e.id, examName: nameOf(e), examType: typeOf(e), startDate: start, endDate: ymd(e.endDate) || start, phase: phaseOf(ymd(e.endDate) || start, today) });
      continue;
    }
    mine.forEach((p, i) => {
      const date = ymd(p.date);
      if (wantMonth && date.slice(0, 7) !== wantMonth) return;
      papers.push({
        key: `${e.id}|${p.id || p.subjectId || p.subjectName || i}|${date}|${p.startTime || ''}`,
        examId: e.id,
        examName: nameOf(e),
        examType: typeOf(e),
        subject: String(p.subjectName || 'Subject not recorded').trim(),
        date,
        month: date.slice(0, 7),
        startTime: p.startTime ? timeLabel(p.startTime) : '',
        endTime: p.endTime ? timeLabel(p.endTime) : '',
        durationLabel: durationLabel(p.startTime, p.endTime),
        room: String(p.roomNumber || '').trim(),
        instructions: String(p.instructions || '').trim(),
        phase: phaseOf(date, today),
      });
    });
  }

  papers.sort((a, b) => a.date.localeCompare(b.date) || (minutesOf(a.startTime) ?? 0) - (minutesOf(b.startTime) ?? 0) || a.subject.localeCompare(b.subject));
  noTimetable.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { papers, noTimetable };
}

/** Exam types and months that exist for this class, for the filter chips (months of unfinished papers first). */
export function filterOptions(exams: ExamLike[] | null | undefined, classId?: string): { types: string[]; months: string[] } {
  const types = new Set<string>();
  const months = new Set<string>();
  for (const e of visibleExams(exams, classId)) {
    if (typeOf(e)) types.add(typeOf(e));
    const dates = (Array.isArray(e.schedule) ? e.schedule : []).map((p) => ymd(p.date)).filter(Boolean);
    if (!dates.length && ymd(e.startDate)) dates.push(ymd(e.startDate));
    dates.forEach((d) => months.add(d.slice(0, 7)));
  }
  return { types: [...types].sort(), months: [...months].sort() };
}

export interface DayGroup {
  date: string;
  title: string;
  papers: SchedulePaper[];
}

export function groupByDate(papers: SchedulePaper[]): DayGroup[] {
  const out: DayGroup[] = [];
  for (const p of papers) {
    const last = out[out.length - 1];
    if (last && last.date === p.date) last.papers.push(p);
    else out.push({ date: p.date, title: longDate(p.date), papers: [p] });
  }
  return out;
}

export function scheduleSummary(papers: SchedulePaper[]): { total: number; next?: SchedulePaper; subjects: number } {
  return {
    total: papers.length,
    subjects: new Set(papers.map((p) => p.subject.toLowerCase())).size,
    next: papers.find((p) => p.phase !== 'completed'),
  };
}

export const phaseLabel = (p: PaperPhase) => (p === 'today' ? 'Today' : p === 'upcoming' ? 'Upcoming' : 'Completed');
