import { buildMarksheet, filterStudentsByQuery } from '../src/utils/reportCardRules';

let passed = 0, failed = 0;
const ok = (d: string, c: boolean) => { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.error(`  ❌ ${d}`); } };

const subjects = [{ id: 'm', name: 'Maths' }, { id: 'e', name: 'English' }, { id: 's', name: 'Science' }];

const partial = buildMarksheet(subjects, [{ subjectId: 'm', marksObtained: 80, maxMarks: 100 }, { subjectId: 'e', marksObtained: 70, maxMarks: 100 }]);
ok('lists every class subject', partial.rows.length === 3);
ok('missing subject is PENDING and excluded from totals', partial.rows[2].result === 'PENDING' && partial.totalMax === 200 && partial.totalObtained === 150);
ok('incomplete sheet has INCOMPLETE result', partial.result === 'INCOMPLETE' && partial.pendingCount === 1);

const full = buildMarksheet(subjects, [
  { subjectId: 'm', marksObtained: 80, maxMarks: 100 }, { subjectId: 'e', marksObtained: 70, maxMarks: 100 }, { subjectId: 's', marksObtained: 90, maxMarks: 100 },
]);
ok('complete passing sheet totals 240/300 PASS', full.totalObtained === 240 && full.totalMax === 300 && full.result === 'PASS' && full.percentage === 80);

const fail = buildMarksheet(subjects, [
  { subjectId: 'm', marksObtained: 80, maxMarks: 100 }, { subjectId: 'e', marksObtained: 10, maxMarks: 100 }, { subjectId: 's', marksObtained: 90, maxMarks: 100 },
]);
ok('one failed subject fails the result', fail.result === 'FAIL');

const absent = buildMarksheet(subjects, [
  { subjectId: 'm', marksObtained: 80, maxMarks: 100 }, { subjectId: 'e', isAbsent: true, maxMarks: 100 }, { subjectId: 's', marksObtained: 90, maxMarks: 100 },
]);
ok('absent subject shows AB, scores 0 and fails', absent.rows[1].grade === 'AB' && absent.rows[1].obtained === 0 && absent.result === 'FAIL');

ok('marks for unrelated subjects are ignored', buildMarksheet(subjects, [{ subjectId: 'zzz', marksObtained: 50, maxMarks: 100 }]).result === 'NO MARKS');
ok('duplicate rows keep latest', buildMarksheet(subjects, [{ subjectId: 'm', marksObtained: 10, maxMarks: 100 }, { subjectId: 'm', marksObtained: 95, maxMarks: 100 }]).rows[0].obtained === 95);
ok('no subjects → NO MARKS', buildMarksheet([], []).result === 'NO MARKS');

const students = [
  { name: 'Aarav Singh', admissionNumber: 'ADM001', rollNumber: '1' },
  { name: 'Riya Verma', admissionNumber: 'ADM002', rollNumber: '12' },
];
ok('search by name (case-insensitive)', filterStudentsByQuery(students, 'riya').length === 1);
ok('search by admission number', filterStudentsByQuery(students, 'adm001')[0].name === 'Aarav Singh');
ok('search by roll number', filterStudentsByQuery(students, '12')[0].name === 'Riya Verma');
ok('empty query returns all', filterStudentsByQuery(students, '  ').length === 2);
ok('no match returns empty', filterStudentsByQuery(students, 'xyz').length === 0);

console.log(`\nPassed ${passed}, failed ${failed}`);
process.exit(failed ? 1 : 0);
