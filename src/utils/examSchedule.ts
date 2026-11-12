import type { ExamScheduleItem } from '../types';

/** Parses "10:00 AM", "1:30pm" or "13:00" into minutes after midnight (null if unreadable). */
export function parseExamTime(value?: string): number | null {
  const m = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const mer = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** Sorts papers by date, then start time, then subject. Returns a new array. */
export function sortExamSchedule<T extends Pick<ExamScheduleItem, 'date' | 'startTime' | 'subjectName'>>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      (parseExamTime(a.startTime) ?? 0) - (parseExamTime(b.startTime) ?? 0) ||
      String(a.subjectName || '').localeCompare(String(b.subjectName || ''))
  );
}

/** Papers a given student sits: their class, and either every section or their own section. */
export function papersForStudent(schedule: ExamScheduleItem[] | undefined, classId?: string, section?: string): ExamScheduleItem[] {
  return sortExamSchedule(
    (schedule || []).filter((p) => {
      if (p.classId && classId && p.classId !== classId) return false;
      const sec = String(p.section || 'ALL').toUpperCase();
      return sec === 'ALL' || !section || sec === String(section).toUpperCase();
    })
  );
}

/** "2026-03-05" → "05 Mar 2026"; anything unreadable is returned unchanged. */
export function formatExamDate(value?: string): string {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(value ?? '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Returns human-readable problems with an exam timetable (empty array = valid).
 * A paper is identified by class + section + subject; the same subject twice for one class/section
 * (or the ALL section overlapping a specific one) is rejected.
 */
export function validateExamSchedule(
  schedule: ExamScheduleItem[] | undefined,
  window?: { startDate?: string; endDate?: string }
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string[]>();
  (schedule || []).forEach((p, i) => {
    const label = `${p.className || 'Class'} – ${p.subjectName || `paper ${i + 1}`}`;
    if (!p.classId || !p.subjectId) errors.push(`${label}: class and subject are required.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || ''))) {
      errors.push(`${label}: exam date is required.`);
    } else {
      if (window?.startDate && p.date < window.startDate) errors.push(`${label}: date is before the exam start date.`);
      if (window?.endDate && p.date > window.endDate) errors.push(`${label}: date is after the exam end date.`);
    }
    const start = parseExamTime(p.startTime);
    const end = parseExamTime(p.endTime);
    if (start === null || end === null) errors.push(`${label}: enter start and end time like 10:00 AM.`);
    else if (end <= start) errors.push(`${label}: end time must be after the start time.`);
    const max = Number(p.maxMarks);
    const pass = Number(p.passMarks);
    if (!(max > 0)) errors.push(`${label}: maximum marks must be greater than 0.`);
    else if (!(pass >= 0) || pass > max) errors.push(`${label}: pass marks must be between 0 and maximum marks.`);

    const key = `${p.classId}|${p.subjectId}`;
    const sec = String(p.section || 'ALL').toUpperCase();
    const prior = seen.get(key) || [];
    if (prior.some((s) => s === sec || s === 'ALL' || sec === 'ALL')) errors.push(`${label}: scheduled more than once for the same section.`);
    seen.set(key, [...prior, sec]);
  });
  return errors;
}
