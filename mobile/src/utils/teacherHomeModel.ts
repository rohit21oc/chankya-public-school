import type {
  TeacherAssignedSectionSummary,
  TeacherPendingMarksTask,
  TeacherQuickStats,
  TeacherTodaySlot,
} from '../types/teacher';

/**
 * Pure mapping from the teacher dashboard API payload to what the Home Dashboard shows.
 * Nothing here invents data: every string is built from backend fields, and missing
 * fields simply drop out of the text.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const HONORIFIC = /^(mr|mrs|ms|miss|dr|prof|sri|shri|smt|er)\.?$/i;

/** Time-of-day greeting from a 0–23 hour. */
export const greetingForHour = (hour: number): string => {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

/** First given name, skipping titles such as "Mrs." or "Dr.". Falls back to the full name. */
export const firstNameOf = (fullName?: string): string => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const given = parts.find((p) => !HONORIFIC.test(p));
  return given || parts.join(' ');
};

export const initialsOf = (name?: string): string =>
  (name || '')
    .split(/\s+/)
    .filter((p) => p && !HONORIFIC.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || 'T';

const parseIsoDate = (iso?: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

/** "MONDAY, 19 OCTOBER 2026 · SESSION 2026–2027" from the server's date and session. */
export const formatHeaderDate = (isoDate?: string, session?: string): string => {
  const d = parseIsoDate(isoDate);
  const datePart = d ? `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
  const sessionPart = session ? `Session ${session.replace(/\s*-\s*/g, '\u2013')}` : '';
  return [datePart, sessionPart].filter(Boolean).join(' \u00B7 ').toUpperCase();
};

/** "18 Oct 2026" from an ISO timestamp; empty string if it cannot be parsed. */
export const formatNoticeDate = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

/** "VII A" from class name and section. */
export const classLabel = (className?: string, section?: string): string =>
  [className, section].filter(Boolean).join(' ');

const timeRange = (slot: TeacherTodaySlot): string =>
  slot.startTime && slot.endTime ? `${slot.startTime}\u2013${slot.endTime}` : slot.startTime || '';

const roomText = (slot: TeacherTodaySlot): string => (slot.roomNumber ? `Room ${slot.roomNumber}` : '');

export interface TimetableHeadline {
  kind: 'NOW' | 'NEXT' | 'DONE';
  timeLabel: string;
  title: string;
  meta: string;
}

export interface TimetableView {
  /** Number of periods scheduled today, for the "3 classes" badge. */
  count: number;
  badge: string;
  headline: TimetableHeadline | null;
  /** The line under the headline, e.g. "Next 10:20 · VII B · Room 205". */
  following: string;
  emptyText: string;
}

const periodsBadge = (count: number): string => `${count} ${count === 1 ? 'class' : 'classes'}`;

const slotHeadline = (slot: TeacherTodaySlot, kind: 'NOW' | 'NEXT'): TimetableHeadline => {
  const meta = [slot.section ? `Section ${slot.section}` : '', roomText(slot)].filter(Boolean).join(' \u00B7 ');
  const range = timeRange(slot);
  return {
    kind,
    timeLabel: [kind === 'NOW' ? 'NOW' : 'UP NEXT', range].filter(Boolean).join(' \u00B7 '),
    title: [slot.subjectName || 'Period', classLabel(slot.className, slot.section)].filter(Boolean).join(' \u00B7 '),
    meta: meta || `Period ${slot.periodNumber}`,
  };
};

const followingText = (slot: TeacherTodaySlot, lead: 'Next' | 'Then'): string =>
  [`${lead} ${slot.startTime || `P${slot.periodNumber}`}`, classLabel(slot.className, slot.section), roomText(slot)]
    .filter(Boolean)
    .join(' \u00B7 ');

/** Chooses what the navy timetable card shows from today's server-provided slots. */
export const buildTimetableView = (slots: TeacherTodaySlot[] | undefined | null): TimetableView => {
  const sorted = [...(slots ?? [])].sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));
  const base = { count: sorted.length, badge: periodsBadge(sorted.length) };

  if (sorted.length === 0) {
    return { ...base, headline: null, following: '', emptyText: 'No periods scheduled for today.' };
  }

  const active = sorted.find((s) => s.status === 'ACTIVE');
  const upcoming = sorted.filter((s) => s.status === 'UPCOMING');

  if (active) {
    return {
      ...base,
      headline: slotHeadline(active, 'NOW'),
      following: upcoming[0] ? followingText(upcoming[0], 'Next') : '',
      emptyText: '',
    };
  }

  if (upcoming.length > 0) {
    return {
      ...base,
      headline: slotHeadline(upcoming[0], 'NEXT'),
      following: upcoming[1] ? followingText(upcoming[1], 'Then') : '',
      emptyText: '',
    };
  }

  return {
    ...base,
    headline: {
      kind: 'DONE',
      timeLabel: 'TODAY',
      title: 'All periods completed',
      meta: `${sorted.length} of ${sorted.length} ${sorted.length === 1 ? 'period' : 'periods'} taught`,
    },
    following: '',
    emptyText: '',
  };
};

export interface PendingTaskRow {
  id: string;
  kind: 'ATTENDANCE' | 'MARKS';
  title: string;
  subtitle: string;
  badge: string;
  /** Mobile module id to open (see utils/rbac.ts). */
  moduleId: string;
}

/**
 * Pending academic work as rows: one per section whose attendance is not yet marked
 * today, plus one per pending marks-entry task. Both inputs are already server-scoped.
 */
export const buildPendingTasks = (
  sections: TeacherAssignedSectionSummary[] | undefined | null,
  marks: TeacherPendingMarksTask[] | undefined | null
): PendingTaskRow[] => {
  const rows: PendingTaskRow[] = [];

  for (const s of sections ?? []) {
    if (s.attendance?.isMarked) continue;
    const label = classLabel(s.className, s.section);
    const students = `${s.studentCount} ${s.studentCount === 1 ? 'student' : 'students'}`;
    rows.push({
      id: `attendance-${s.classId}-${s.section}`,
      kind: 'ATTENDANCE',
      title: `Submit ${label} attendance`,
      subtitle: `${students} \u00B7 Pending today`,
      badge: 'Due',
      moduleId: 'student-attendance',
    });
  }

  for (const m of marks ?? []) {
    rows.push({
      id: `marks-${m.examId}-${m.classId}-${m.section}-${m.subjectId}`,
      kind: 'MARKS',
      title: `Complete ${m.examTitle || 'exam'} marks`,
      subtitle: [classLabel(m.className, m.section), m.subjectName, `${m.enteredCount} of ${m.totalStudents} entered`]
        .filter(Boolean)
        .join(' \u00B7 '),
      badge: m.status === 'IN_PROGRESS' ? 'In progress' : 'Pending',
      moduleId: 'marks-entry',
    });
  }

  return rows;
};

export interface SummaryCardData {
  id: string;
  value: number;
  label: string;
}

/** The four "work summary" cards, all taken from the server's quickStats. */
export const buildSummaryCards = (stats: TeacherQuickStats): SummaryCardData[] => [
  { id: 'classes', value: stats.assignedClassesCount, label: 'Assigned classes' },
  { id: 'students', value: stats.totalAssignedStudents, label: 'Students' },
  {
    id: 'attendance',
    value: stats.pendingAttendanceCount,
    label: stats.pendingAttendanceCount === 1 ? 'Attendance task' : 'Attendance tasks',
  },
  { id: 'marks', value: stats.pendingMarksCount, label: 'Marks pending' },
];
