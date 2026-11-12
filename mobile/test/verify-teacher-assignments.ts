/**
 * Offline unit checks for the UI-only assignment index.
 * Fixtures mirror the shape of GET /api/teacher/authorized-assignments.
 * These tests do not touch the network and do not grant access; they only
 * verify the display helper's matching rules.
 *
 * Run: npx tsx test/verify-teacher-assignments.ts
 */
import { buildAssignmentIndex } from '../src/utils/teacherAssignments';
import type { TeacherAuthorizedAssignments } from '../src/types/teacher';

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.log(`  FAIL: ${name} ${detail}`);
  }
};

const fixture: TeacherAuthorizedAssignments = {
  success: true,
  allAccess: false,
  classes: [
    { classId: 'c-2', className: 'Class 2', sections: ['B', 'A'] },
    { classId: 'c-nur', className: 'Nursery', sections: ['A'] },
  ],
  subjects: [{ id: 's-2', name: 'English' }],
};

console.log('\n--- Assignment index: matching ---');
const idx = buildAssignmentIndex(fixture);
check('assigned section by classId', idx.isSectionAssigned('c-2', 'B'));
check('assigned section by className (case-insensitive)', idx.isSectionAssigned('class 2', 'a'));
check('unassigned section of an assigned class is rejected', !idx.isSectionAssigned('c-2', 'C'));
check('unassigned class is rejected', !idx.isSectionAssigned('c-unknown', 'A'));
check('empty section never matches', !idx.isSectionAssigned('c-2', ''));
check('assignedSectionsFor returns the server sections', idx.assignedSectionsFor('Nursery').join(',') === 'A');
check('assignedSectionsFor unknown class returns []', idx.assignedSectionsFor('LKG').length === 0);

console.log('\n--- Assignment index: missing response fails closed ---');
const none = buildAssignmentIndex(null);
check('null assignments reject every section', !none.isSectionAssigned('c-2', 'B'));
check('null assignments return empty sections', none.assignedSectionsFor('c-2').length === 0);


// ---- Picker scoping rules (class/section/subject) ----
import { scopeClassesForTeacher, scopeSubjectsForTeacher } from '../src/utils/teacherScopeRules';

console.log('\n--- Picker scoping: classes & sections ---');
const allClasses = [
  { id: 'c-2', name: 'Class 2', sections: ['A', 'B', 'C'] },
  { id: 'c-nur', name: 'Nursery', sections: [{ id: 'x', name: 'A' }, { id: 'y', name: 'B' }] },
  { id: 'c-lkg', name: 'LKG', sections: ['A'] },
] as any[];
const scopedCls = scopeClassesForTeacher(allClasses, fixture);
check('unassigned class LKG is removed', !scopedCls.some((c) => c.id === 'c-lkg'));
const c2 = scopedCls.find((c) => c.id === 'c-2');
check('assigned class keeps only assigned sections (A,B; not C)', !!c2 && (c2.sections as string[]).join(',') === 'A,B');
const nur = scopedCls.find((c) => c.id === 'c-nur');
check('object-form sections are filtered by name', !!nur && (nur.sections as any[]).map((s) => s.name).join(',') === 'A');
check('all-access teacher sees every class unchanged', scopeClassesForTeacher(allClasses, { ...fixture, allAccess: true }).length === 3);

console.log('\n--- Picker scoping: subjects ---');
const allSubjects = [{ id: 's-2', name: 'English' }, { id: 's-99', name: 'Chemistry' }] as any[];
const scopedSubs = scopeSubjectsForTeacher(allSubjects, { ...fixture, subjects: [{ id: 's-2', name: 'English' }] });
check('only assigned subjects are offered', scopedSubs.length === 1 && scopedSubs[0].id === 's-2');

console.log(`\nTEACHER ASSIGNMENT HELPER: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
