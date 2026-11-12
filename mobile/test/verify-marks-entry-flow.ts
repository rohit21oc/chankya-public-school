import {
  examsForSessionAndClass, subjectsForClass, resolvePaperConfig, rosterForSelection, sectionNames, gradeForMarks, marksSnapshot,
} from '../src/utils/marksEntryRules';

let passed = 0, failed = 0;
const ok = (d: string, c: boolean) => { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.error(`  ❌ ${d}`); } };

const subjects: any[] = [
  { id: 'eng', name: 'English', classIds: ['c1', 'c2'], status: 'ACTIVE' },
  { id: 'evs', name: 'EVS', classIds: ['c1'], status: 'ACTIVE' },
  { id: 'sci', name: 'Science', classIds: ['c2'], status: 'ACTIVE' },
  { id: 'old', name: 'Retired', classIds: ['c1'], status: 'INACTIVE' },
  { id: 'nur', name: 'Rhymes', classIds: ['nursery'], status: 'ACTIVE' },
];
ok('Class 1 shows only Class 1 subjects', subjectsForClass(subjects, 'c1').map((s) => s.id).join() === 'eng,evs');
ok('Nursery shows only Nursery subjects', subjectsForClass(subjects, 'nursery').map((s) => s.id).join() === 'nur');
ok('inactive subject is never offered', !subjectsForClass(subjects, 'c1').some((s) => s.id === 'old'));
ok('no class → no subjects', subjectsForClass(subjects, '').length === 0);

const students: any[] = [
  { id: 's1', name: 'A', classId: 'c1', className: 'Class 1', section: 'A', status: 'ACTIVE', academicSession: '2026-2027' },
  { id: 's2', name: 'B', classId: 'c1', className: 'Class 1', section: 'B', status: 'ACTIVE', academicSession: '2026-2027' },
  { id: 's3', name: 'C', classId: 'c2', className: 'Class 2', section: 'A', status: 'ACTIVE', academicSession: '2026-2027' },
  { id: 's4', name: 'D', classId: 'c1', className: 'Class 1', section: 'A', status: 'INACTIVE', academicSession: '2026-2027' },
  { id: 's5', name: 'E', classId: 'c1', className: 'Class 1', section: 'A', status: 'ACTIVE', academicSession: '2025-2026' },
];
const sel = { classId: 'c1', className: 'Class 1', section: 'A', session: '2026-2027' };
ok('roster = active students of exactly that class+section+session', rosterForSelection(students, sel).map((s) => s.id).join() === 's1');
ok('section B shows only section B', rosterForSelection(students, { ...sel, section: 'B' }).map((s) => s.id).join() === 's2');
ok('empty section stays empty (no whole-class fallback)', rosterForSelection(students, { ...sel, section: 'C' }).length === 0);

const exams: any[] = [
  { id: 'e1', name: 'Mid', academicSession: '2026-2027', classIds: ['c1'] },
  { id: 'e2', name: 'All', academicSession: '2026-2027' },
  { id: 'e3', name: 'Old', academicSession: '2025-2026' },
  { id: 'e4', name: 'C2 only', academicSession: '2026-2027', classIds: ['c2'] },
];
ok('exams limited to session and class', examsForSessionAndClass(exams, '2026-2027', 'c1').map((e) => e.id).join() === 'e1,e2');
ok('session text format is tolerant', examsForSessionAndClass(exams, '2026 - 2027', 'c2').map((e) => e.id).join() === 'e2,e4');

const exam: any = { id: 'e1', maxMarks: 100, schedule: [
  { subjectId: 'eng', classId: 'c1', section: 'ALL', maxMarks: 50, passMarks: 17 },
  { subjectId: 'eng', classId: 'c1', section: 'B', maxMarks: 40, passMarks: 14 },
  { subjectId: 'eng', classId: 'c2', section: 'ALL', maxMarks: 80 },
] };
ok('max marks from the exam paper of that class', resolvePaperConfig(exam, subjects[0], 'c1', 'A').maxMarks === 50);
ok('section-specific paper wins', resolvePaperConfig(exam, subjects[0], 'c1', 'B').maxMarks === 40);
ok('other class paper is not used', resolvePaperConfig(exam, subjects[0], 'c2', 'A').maxMarks === 80);
ok('falls back to subject then exam', resolvePaperConfig({ maxMarks: 60 } as any, { id: 'x', name: 'X', maxMarks: 25 } as any, 'c1', 'A').maxMarks === 25
  && resolvePaperConfig({ maxMarks: 60 } as any, { id: 'x', name: 'X' } as any, 'c1', 'A').maxMarks === 60);

ok('sections default to A', sectionNames({ id: 'c', name: 'C', sections: [] } as any).join() === 'A');
ok('grades use the 8-tier scale', gradeForMarks(92, 100).grade === 'A1' && gradeForMarks(33, 100).grade === 'D' && gradeForMarks(32.9, 100).grade === 'E/F' && gradeForMarks(32.9, 100).status === 'FAIL');
ok('grade scales with max marks', gradeForMarks(46, 50).grade === 'A1' && gradeForMarks(45, 50).grade === 'A2');
const a = marksSnapshot([{ studentId: 's1', marksObtained: '', isAbsent: false }]);
ok('snapshot detects a change', a !== marksSnapshot([{ studentId: 's1', marksObtained: '0', isAbsent: false }]) && a === marksSnapshot([{ studentId: 's1', marksObtained: ' ', isAbsent: false }]));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
