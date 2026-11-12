/**
 * Pure rules for the mobile Homework module (no React, no network) so they can be tested directly.
 * The server is the authority: it re-checks every field, the teacher's class/section/subject
 * assignment and ownership. These rules only keep the form tidy and fail fast.
 */

export interface HomeworkItem {
  id: string;
  classId: string;
  className: string;
  section: string;
  subjectId?: string;
  subjectName: string;
  title: string;
  instructions?: string;
  assignedDate: string;
  dueDate: string;
  teacherName?: string;
  attachmentName?: string;
  attachmentFileKey?: string;
  canManage?: boolean;
}

export interface HomeworkClassOption {
  classId: string;
  className: string;
  sections: { name: string; subjects: { id: string; name: string }[] }[];
}

export interface HomeworkForm {
  classId: string;
  section: string;
  subjectId: string;
  title: string;
  instructions: string;
  assignedDate: string;
  dueDate: string;
}

export type DueStatus = 'DUE_TODAY' | 'UPCOMING' | 'PAST_DUE' | 'NO_DUE_DATE';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().substring(0, 10) === s;
}

/** Today's date in India (the school's calendar), as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().substring(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

export function dueStatus(dueDate: string | undefined, today: string): DueStatus {
  const d = String(dueDate || '').substring(0, 10);
  if (!DATE_RE.test(d)) return 'NO_DUE_DATE';
  if (d === today) return 'DUE_TODAY';
  return d > today ? 'UPCOMING' : 'PAST_DUE';
}

const RANK: Record<DueStatus, number> = { DUE_TODAY: 0, UPCOMING: 1, NO_DUE_DATE: 2, PAST_DUE: 3 };

/** Open work first (soonest due first), then past work (most recent first). */
export function sortAndFilterHomework(
  list: HomeworkItem[],
  today: string,
  opts: { includePast: boolean; classId?: string; section?: string } = { includePast: false }
): (HomeworkItem & { status: DueStatus })[] {
  return (list || [])
    .filter((h) => !opts.classId || h.classId === opts.classId)
    .filter((h) => !opts.section || h.section === opts.section)
    .map((h) => ({ ...h, status: dueStatus(h.dueDate, today) }))
    .filter((h) => opts.includePast || h.status !== 'PAST_DUE')
    .sort((a, b) => {
      const r = RANK[a.status] - RANK[b.status];
      if (r !== 0) return r;
      return a.status === 'PAST_DUE' ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate);
    });
}

export function sectionsFor(options: HomeworkClassOption[], classId: string) {
  return options.find((c) => c.classId === classId)?.sections || [];
}
export function subjectsFor(options: HomeworkClassOption[], classId: string, section: string) {
  return sectionsFor(options, classId).find((s) => s.name === section)?.subjects || [];
}

/** First problem found in the form, or null when it can be submitted. */
export function validateHomeworkForm(f: HomeworkForm, options: HomeworkClassOption[]): string | null {
  if (!f.classId) return 'Select a class.';
  if (!f.section) return 'Select a section.';
  if (!f.subjectId) return 'Select a subject.';
  if (!sectionsFor(options, f.classId).some((s) => s.name === f.section)) return 'Select a valid section.';
  if (!subjectsFor(options, f.classId, f.section).some((s) => s.id === f.subjectId)) return 'Select a valid subject.';
  const title = f.title.trim();
  if (title.length < 3) return 'Enter a title of at least 3 characters.';
  if (title.length > 150) return 'Title must be 150 characters or fewer.';
  const ins = f.instructions.trim();
  if (!ins) return 'Enter the instructions for students.';
  if (ins.length > 5000) return 'Instructions must be 5000 characters or fewer.';
  if (!isValidDate(f.assignedDate)) return 'Assigned date must be a valid date (YYYY-MM-DD).';
  if (!isValidDate(f.dueDate)) return 'Due date must be a valid date (YYYY-MM-DD).';
  if (f.dueDate < f.assignedDate) return 'Due date cannot be before the assigned date.';
  return null;
}

/**
 * Request body. Attachment fields are deliberately never sent from mobile, so editing a
 * homework that has an attachment (added on the web) keeps that attachment.
 */
export function buildHomeworkPayload(f: HomeworkForm) {
  return {
    classId: f.classId,
    section: f.section,
    subjectId: f.subjectId,
    title: f.title.trim(),
    instructions: f.instructions.trim(),
    assignedDate: f.assignedDate,
    dueDate: f.dueDate,
  };
}

export const WRITE_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'TEACHER'];
export const canAssignHomework = (role?: string) => WRITE_ROLES.includes(String(role || ''));

export function formatDisplayDate(d?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return String(d || '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}
