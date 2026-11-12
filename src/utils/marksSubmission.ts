import type { ExamMark, Student } from '../types';

/**
 * Marks to send when saving one exam + subject for the students shown on screen.
 * The exam-wide mark list also holds other classes and older duplicate rows; sending those fails the
 * server's checks ("Unknown class", "appears more than once"), so only the shown students are sent,
 * one row each (the latest wins), tagged with the student's own class and section.
 */
export function marksForSubmission(
  allMarks: ExamMark[],
  students: Student[],
  examId: string,
  subjectId: string
): ExamMark[] {
  const byId = new Map<string, Student>(students.map((st) => [st.id, st] as [string, Student]));
  const latest = new Map<string, ExamMark>();
  for (const m of allMarks) {
    if (m.examId !== examId || m.subjectId !== subjectId) continue;
    if (!byId.has(m.studentId)) continue;
    latest.set(m.studentId, m);
  }
  return Array.from(latest.values()).map((m) => {
    const st = byId.get(m.studentId)!;
    return { ...m, classId: st.classId, section: st.section };
  });
}

/**
 * One row per exam + student + subject (the last one wins). Old saves could leave two rows for the same
 * student; the screen, the edit and the save must all use the same row, or an edit shows as saved but isn't.
 */
export function dedupeMarks(marks: ExamMark[]): ExamMark[] {
  const latest = new Map<string, ExamMark>();
  for (const m of marks) latest.set(`${m.examId}|${m.studentId}|${m.subjectId}`, m);
  return latest.size === marks.length ? marks : Array.from(latest.values());
}
