import { validateExamSchedule, papersForStudent, sortExamSchedule, parseExamTime, formatExamDate } from '../src/utils/examSchedule.ts';

let pass = 0, fail = 0;
const ok = (d: string, c: boolean) => { if (c) { pass++; console.log(`PASS  ${d}`); } else { fail++; console.error(`FAIL  ${d}`); } };
const paper = (o: any = {}) => ({ id: 'p', classId: 'c5', className: 'Class 5', subjectId: 's1', subjectName: 'Maths', section: 'ALL', date: '2026-03-05', startTime: '10:00 AM', endTime: '01:00 PM', maxMarks: 100, passMarks: 33, ...o });
const win = { startDate: '2026-03-01', endDate: '2026-03-20' };

ok('12h and 24h times parse', parseExamTime('10:00 AM') === 600 && parseExamTime('1:30 pm') === 810 && parseExamTime('13:00') === 780 && parseExamTime('12:00 AM') === 0);
ok('bad time is null', parseExamTime('soon') === null && parseExamTime('25:00') === null);
ok('valid paper has no errors', validateExamSchedule([paper()], win).length === 0);
ok('missing date rejected', validateExamSchedule([paper({ date: '' })], win).length === 1);
ok('date outside window rejected', validateExamSchedule([paper({ date: '2026-04-01' })], win).length === 1);
ok('end before start rejected', validateExamSchedule([paper({ startTime: '01:00 PM', endTime: '10:00 AM' })], win).length === 1);
ok('pass > max rejected', validateExamSchedule([paper({ passMarks: 150 })], win).length === 1);
ok('duplicate subject same class rejected', validateExamSchedule([paper(), paper({ id: 'q' })], win).length === 1);
ok('same subject in different sections allowed', validateExamSchedule([paper({ section: 'A' }), paper({ id: 'q', section: 'B' })], win).length === 0);
ok('ALL overlaps a specific section', validateExamSchedule([paper(), paper({ id: 'q', section: 'A' })], win).length === 1);
ok('empty schedule is valid', validateExamSchedule([], win).length === 0 && validateExamSchedule(undefined, win).length === 0);

const sched = [paper({ id: '1', date: '2026-03-09', subjectName: 'Z' }), paper({ id: '2', subjectId: 's2', date: '2026-03-05', startTime: '02:00 PM', endTime: '04:00 PM' }), paper({ id: '3', subjectId: 's3', date: '2026-03-05' })];
ok('sorted by date then start time', sortExamSchedule(sched).map((p) => p.id).join() === '3,2,1');
const mixed = [paper({ id: 'a', section: 'A' }), paper({ id: 'b', subjectId: 's2', section: 'B' }), paper({ id: 'c', subjectId: 's3', classId: 'c6' }), paper({ id: 'd', subjectId: 's4' })];
ok('student sees own class + own section + ALL only', papersForStudent(mixed as any, 'c5', 'A').map((p) => p.id).sort().join() === 'a,d');
ok('date formatting', formatExamDate('2026-03-05') === '05 Mar 2026' && formatExamDate('bad') === 'bad');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
