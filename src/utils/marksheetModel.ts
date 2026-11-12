import type { ExamMark, Subject } from '../types';
import { calculateEvaluation } from './grading';

/**
 * One model behind the on-screen marksheet and the downloaded/printed PDF, so both always show the same
 * subjects, marks and result. Every subject that applies to the class is listed; a subject without saved
 * marks is "Pending" and is not counted in the totals. Orphan or duplicate mark rows never add up.
 */

export type SubjectResult = 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING';

export interface MarksheetRow {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  obtained: number | null;
  isAbsent: boolean;
  grade: string;
  result: SubjectResult;
}

export interface Marksheet {
  rows: MarksheetRow[];
  totalMax: number;
  totalObtained: number;
  percentage: number;
  grade: string;
  pendingCount: number;
  /** true when every applicable subject has marks (or an absence) recorded */
  complete: boolean;
  /** PASS / FAIL once complete, otherwise INCOMPLETE (or NO MARKS when nothing is recorded) */
  result: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NO MARKS';
}

export function buildMarksheet(subjects: Subject[], marks: ExamMark[]): Marksheet {
  const latestBySubject = new Map<string, ExamMark>();
  for (const m of marks) {
    if (m && m.subjectId) latestBySubject.set(m.subjectId, m);
  }

  const rows: MarksheetRow[] = subjects.map((sub) => {
    const entry = latestBySubject.get(sub.id);
    const maxMarks = Number(entry?.maxMarks) || Number(sub.maxMarks) || 100;
    if (!entry) {
      return { subjectId: sub.id, subjectName: sub.name, maxMarks, obtained: null, isAbsent: false, grade: '—', result: 'PENDING' };
    }
    if (entry.isAbsent) {
      return { subjectId: sub.id, subjectName: sub.name, maxMarks, obtained: 0, isAbsent: true, grade: '—', result: 'ABSENT' };
    }
    const obtained = Number(entry.marksObtained) || 0;
    const ev = calculateEvaluation(obtained, maxMarks);
    return { subjectId: sub.id, subjectName: sub.name, maxMarks, obtained, isAbsent: false, grade: ev.grade, result: ev.status === 'PASS' ? 'PASS' : 'FAIL' };
  });

  const recorded = rows.filter((r) => r.result !== 'PENDING');
  const totalMax = recorded.reduce((a, r) => a + r.maxMarks, 0);
  const totalObtained = recorded.reduce((a, r) => a + (r.obtained || 0), 0);
  const overall = totalMax > 0 ? calculateEvaluation(totalObtained, totalMax) : null;
  const pendingCount = rows.length - recorded.length;
  const complete = rows.length > 0 && pendingCount === 0;

  return {
    rows,
    totalMax,
    totalObtained,
    percentage: overall ? overall.percentage : 0,
    grade: overall ? overall.grade : '—',
    pendingCount,
    complete,
    result: totalMax === 0 ? 'NO MARKS' : !complete ? 'INCOMPLETE' : overall && overall.status === 'PASS' ? 'PASS' : 'FAIL',
  };
}
