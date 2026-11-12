import type { TeacherAuthorizedAssignments } from '../types/teacher';

/**
 * UI-only helper built from the server's /api/teacher/authorized-assignments response.
 *
 * IMPORTANT: this never grants access. The backend is authoritative for every
 * attendance, marks and student read/write. Use this helper only to decide what
 * to *display* (for example, which sections to list) and never to skip a server check.
 */
export interface AssignmentIndex {
  isSectionAssigned: (classIdOrName: string, section: string) => boolean;
  assignedSectionsFor: (classIdOrName: string) => string[];
}

const norm = (v?: string) => (v || '').trim().toLowerCase();

export function buildAssignmentIndex(assignments: TeacherAuthorizedAssignments | null | undefined): AssignmentIndex {
  const classes = assignments?.classes ?? [];

  const findClass = (classIdOrName: string) => {
    const key = norm(classIdOrName);
    return classes.find((c) => norm(c.classId) === key || norm(c.className) === key);
  };

  return {
    isSectionAssigned: (classIdOrName, section) => {
      const cls = findClass(classIdOrName);
      if (!cls) return false;
      return (cls.sections || []).some((s) => norm(s) === norm(section));
    },
    assignedSectionsFor: (classIdOrName) => findClass(classIdOrName)?.sections ?? [],
  };
}
