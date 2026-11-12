import type { ClassItem, Exam, Student, SubjectItem } from '../types';
import { computeCbseEvaluation } from './reportCardRules';

/**
 * Pure rules for the Marks Entry selection flow:
 * Session -> Exam -> Class -> Section -> Subject -> Students.
 * No React Native / API imports so they can be unit-tested. The backend re-validates every rule.
 */
const norm = (v?: string | null) => String(v ?? '').trim().toLowerCase();
const normSession = (v?: string | null) => String(v ?? '').replace(/[\s-]/g, '').toLowerCase();

export const sectionNames = (cls?: ClassItem | null): string[] => {
  if (!cls || !Array.isArray(cls.sections) || cls.sections.length === 0) return ['A'];
  return (cls.sections as Array<string | { name: string }>).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);
};

export const findClass = (classes: ClassItem[], idOrName: string): ClassItem | undefined =>
  classes.find((c) => norm(c.id) === norm(idOrName) || norm(c.name) === norm(idOrName));

/** Exams of the selected session that apply to the selected class (an exam without classIds applies to all). */
export function examsForSessionAndClass(
  exams: Array<Exam & { classIds?: string[] }>,
  session: string,
  classId?: string
): Array<Exam & { classIds?: string[] }> {
  return exams.filter((e) => {
    if (e.academicSession && normSession(e.academicSession) !== normSession(session)) return false;
    if (classId && Array.isArray(e.classIds) && e.classIds.length > 0) {
      return e.classIds.some((id) => norm(id) === norm(classId));
    }
    return true;
  });
}

/** Subjects of exactly this class. Inactive subjects and subjects of other classes are never returned. */
export function subjectsForClass(subjects: SubjectItem[], classId: string, className?: string): SubjectItem[] {
  if (!classId) return [];
  return subjects.filter((s) => {
    if (norm(s.status || 'ACTIVE') === 'inactive') return false;
    const ids = Array.isArray(s.classIds) ? s.classIds : [];
    return ids.some((id) => norm(id) === norm(classId) || (!!className && norm(id) === norm(className)));
  });
}

export interface PaperConfig {
  maxMarks: number;
  passMarks: number;
  source: 'exam-schedule' | 'subject' | 'exam' | 'default';
}

/**
 * Max / pass marks come from the examination setup: the exam's paper for this class + subject first,
 * then the subject's own configuration, then the exam-wide value.
 */
export function resolvePaperConfig(
  exam: (Exam & { schedule?: any[] }) | undefined,
  subject: SubjectItem | undefined,
  classId: string,
  section: string
): PaperConfig {
  const papers = Array.isArray(exam?.schedule) ? exam!.schedule! : [];
  const paper = papers
    .filter(
      (p) =>
        (norm(p.subjectId) === norm(subject?.id) || norm(p.subjectName) === norm(subject?.name)) &&
        (!p.classId || norm(p.classId) === norm(classId) || norm(p.className) === norm(classId)) &&
        (!p.section || norm(p.section) === 'all' || norm(p.section) === norm(section))
    )
    // A paper made for this exact section wins over a class-wide one.
    .sort((a, b) => Number(norm(b.section) === norm(section)) - Number(norm(a.section) === norm(section)))[0];
  if (paper && Number(paper.maxMarks) > 0) {
    return { maxMarks: Number(paper.maxMarks), passMarks: Number(paper.passMarks) || 33, source: 'exam-schedule' };
  }
  if (subject && Number(subject.maxMarks) > 0) {
    return { maxMarks: Number(subject.maxMarks), passMarks: Number((subject as any).passMarks) || 33, source: 'subject' };
  }
  if (exam && Number(exam.maxMarks) > 0) return { maxMarks: Number(exam.maxMarks), passMarks: 33, source: 'exam' };
  return { maxMarks: 100, passMarks: 33, source: 'default' };
}

/**
 * Strict roster filter: only ACTIVE students of this exact class, section and academic session.
 * There is deliberately no fallback to "the whole class" when a section is empty.
 */
export function rosterForSelection(
  students: Student[],
  sel: { classId: string; className?: string; section: string; session: string }
): Student[] {
  return students.filter((s) => {
    if (norm(s.status || 'ACTIVE') !== 'active') return false;
    const inClass = norm(s.classId) === norm(sel.classId) || (!!sel.className && norm(s.className) === norm(sel.className));
    if (!inClass) return false;
    if (norm(s.section || 'A') !== norm(sel.section)) return false;
    if (s.academicSession && normSession(s.academicSession) !== normSession(sel.session)) return false;
    return true;
  });
}

export function gradeForMarks(obtained: number, max: number): { grade: string; status: 'PASS' | 'FAIL' } {
  const ev = computeCbseEvaluation(obtained, max);
  return { grade: ev.grade === 'E' ? 'E/F' : ev.grade, status: ev.status };
}

/** A stable text fingerprint of the entered marks, used to detect unsaved changes. */
export function marksSnapshot(rows: Array<{ studentId: string; marksObtained: string; isAbsent: boolean }>): string {
  return rows.map((r) => `${r.studentId}:${r.isAbsent ? 'AB' : (r.marksObtained ?? '').trim()}`).join('|');
}
