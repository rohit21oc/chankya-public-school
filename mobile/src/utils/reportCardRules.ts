/**
 * Report Card Evaluation & Calculation Rules
 * RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
 *
 * Implements CBSE scholastic assessment 9-point evaluation grading scale,
 * subject-wise pass/fail criteria, and promotional result determination.
 */

export interface CbseSubjectEvaluation {
  percentage: number;
  grade: string;
  gradePoint: number;
  status: 'PASS' | 'FAIL';
  remark: string;
}

/**
 * Standard CBSE 9-Point Grading Scale:
 *   91% - 100% : A1 (Outstanding)
 *   81% - 90%  : A2 (Excellent)
 *   71% - 80%  : B1 (Very Good)
 *   61% - 70%  : B2 (Good)
 *   51% - 60%  : C1 (Above Average)
 *   41% - 50%  : C2 (Average)
 *   33% - 40%  : D  (Pass / Satisfactory)
 *   < 33%      : E  (Needs Improvement / Compartment)
 */
export function computeCbseEvaluation(obtained: number, max: number): CbseSubjectEvaluation {
  if (max <= 0) {
    return { percentage: 0, grade: 'E', gradePoint: 0, status: 'FAIL', remark: 'Needs Improvement' };
  }
  const pct = Math.round((obtained / max) * 1000) / 10;
  if (pct >= 91) return { percentage: pct, grade: 'A1', gradePoint: 10, status: 'PASS', remark: 'Outstanding Performance' };
  if (pct >= 81) return { percentage: pct, grade: 'A2', gradePoint: 9, status: 'PASS', remark: 'Excellent' };
  if (pct >= 71) return { percentage: pct, grade: 'B1', gradePoint: 8, status: 'PASS', remark: 'Very Good' };
  if (pct >= 61) return { percentage: pct, grade: 'B2', gradePoint: 7, status: 'PASS', remark: 'Good' };
  if (pct >= 51) return { percentage: pct, grade: 'C1', gradePoint: 6, status: 'PASS', remark: 'Above Average' };
  if (pct >= 41) return { percentage: pct, grade: 'C2', gradePoint: 5, status: 'PASS', remark: 'Average' };
  if (pct >= 33) return { percentage: pct, grade: 'D', gradePoint: 4, status: 'PASS', remark: 'Pass / Satisfactory' };
  return { percentage: pct, grade: 'E', gradePoint: 0, status: 'FAIL', remark: 'Needs Improvement / Compartment' };
}

/**
 * Filter examinations strictly by chosen academic session.
 */
export function filterExamsBySession<T extends { academicSession?: string }>(exams: T[], session: string): T[] {
  if (!session) return exams;
  return exams.filter((e) => !e.academicSession || e.academicSession === session);
}

// ---------------------------------------------------------------------------
// Marksheet model: every subject that applies to the class, one entry per subject
// ---------------------------------------------------------------------------

export interface MarksheetSubject {
  id: string;
  name: string;
  maxMarks?: number;
}

export interface MarksheetMark {
  subjectId: string;
  maxMarks?: number;
  marksObtained?: number;
  isAbsent?: boolean;
  status?: string;
}

export type MarksheetRowResult = 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING';

export interface MarksheetRow {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  obtained: number | null;
  isAbsent: boolean;
  grade: string;
  result: MarksheetRowResult;
}

export interface Marksheet {
  rows: MarksheetRow[];
  totalMax: number;
  totalObtained: number;
  percentage: number;
  grade: string;
  pendingCount: number;
  complete: boolean;
  /** PASS / FAIL once every subject has marks, INCOMPLETE while some are pending, NO MARKS when none. */
  result: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NO MARKS';
}

/**
 * Pending subjects are listed but never counted in the totals; duplicate mark rows collapse to the latest
 * one and marks for subjects that do not apply to the class are ignored.
 */
export function buildMarksheet(subjects: MarksheetSubject[], marks: MarksheetMark[], defaultMax = 100): Marksheet {
  const latest = new Map<string, MarksheetMark>();
  for (const m of marks) if (m && m.subjectId) latest.set(m.subjectId, m);

  const rows: MarksheetRow[] = subjects.map((sub) => {
    const entry = latest.get(sub.id);
    const maxMarks = Number(entry?.maxMarks) || Number(sub.maxMarks) || defaultMax;
    if (!entry) return { subjectId: sub.id, subjectName: sub.name, maxMarks, obtained: null, isAbsent: false, grade: '—', result: 'PENDING' };
    if (entry.isAbsent || entry.status === 'ABSENT') return { subjectId: sub.id, subjectName: sub.name, maxMarks, obtained: 0, isAbsent: true, grade: 'AB', result: 'ABSENT' };
    const obtained = Number(entry.marksObtained) || 0;
    const ev = computeCbseEvaluation(obtained, maxMarks);
    return { subjectId: sub.id, subjectName: sub.name, maxMarks, obtained, isAbsent: false, grade: ev.grade, result: ev.status };
  });

  const recorded = rows.filter((r) => r.result !== 'PENDING');
  const totalMax = recorded.reduce((a, r) => a + r.maxMarks, 0);
  const totalObtained = recorded.reduce((a, r) => a + (r.obtained || 0), 0);
  const overall = totalMax > 0 ? computeCbseEvaluation(totalObtained, totalMax) : null;
  const pendingCount = rows.length - recorded.length;
  const complete = rows.length > 0 && pendingCount === 0;
  const anyFail = recorded.some((r) => r.result === 'FAIL' || r.result === 'ABSENT');

  return {
    rows,
    totalMax,
    totalObtained,
    percentage: overall ? overall.percentage : 0,
    grade: overall ? overall.grade : '—',
    pendingCount,
    complete,
    result: totalMax === 0 ? 'NO MARKS' : !complete ? 'INCOMPLETE' : anyFail || (overall && overall.status === 'FAIL') ? 'FAIL' : 'PASS',
  };
}

/** Case-insensitive search over name, admission number and roll number. */
export function filterStudentsByQuery<T extends { name?: string; admissionNumber?: string; rollNumber?: string }>(students: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return students;
  return students.filter((s) =>
    [s.name, s.admissionNumber, s.rollNumber].some((v) => String(v ?? '').toLowerCase().includes(q))
  );
}
