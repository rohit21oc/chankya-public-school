import type { TeacherAuthorizedAssignments, TeacherClassGroup } from '../types/teacher';

/**
 * Display model for the My Classes screen. Built only from the server's authorized-assignments response;
 * it never decides access, it only formats what the server already allows.
 */

export type MyClassesTab = 'ASSIGNED' | 'QUALIFIED';

export interface ClassCard {
  key: string;
  classId: string;
  title: string; // "Class 5 - A, B"
  subjectsText: string; // "Mathematics, Science" or "No subjects selected"
  studentsText: string; // "24 Students"
  isClassTeacher: boolean;
}

const naturalSections = (g: TeacherClassGroup) =>
  g.sections
    .map((s) => s.section)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

export function toClassCard(g: TeacherClassGroup): ClassCard {
  const secs = naturalSections(g);
  const subjects = (g.subjects || []).filter(Boolean);
  return {
    key: g.classId,
    classId: g.classId,
    title: secs.length > 0 ? `${g.className} - ${secs.join(', ')}` : g.className,
    subjectsText: subjects.length > 0 ? subjects.join(', ') : 'No subjects selected',
    studentsText: `${g.studentCount} ${g.studentCount === 1 ? 'Student' : 'Students'}`,
    isClassTeacher: !!g.isClassTeacher,
  };
}

export function buildMyClasses(a: TeacherAuthorizedAssignments | null | undefined, query = '') {
  const q = query.trim().toLowerCase();
  const match = (c: ClassCard) => !q || c.title.toLowerCase().includes(q) || c.subjectsText.toLowerCase().includes(q);
  const sort = (list: ClassCard[]) => list.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true }));
  const assignedAll = sort((a?.assignedClasses ?? []).map(toClassCard));
  const qualifiedAll = sort((a?.qualifiedOnlyClasses ?? []).map(toClassCard));
  return {
    assignedCount: assignedAll.length,
    qualifiedCount: qualifiedAll.length,
    assigned: assignedAll.filter(match),
    qualified: qualifiedAll.filter(match),
  };
}
