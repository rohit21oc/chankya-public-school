/**
 * Offline checks for teacher profile, ID card and own-attendance rules.
 * No network. Fixtures are inline test data, not app data.
 * Run: npx tsx test/verify-teacher-profile.ts
 */
import { ownStaffIdentifier, buildIdCardView, summarizeOwnAttendance } from '../src/utils/teacherProfileRules';
import { getAuthorizedModulesForUser } from '../src/utils/rbac';
import type { User, Staff, StaffAttendanceRecord } from '../src/types';

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};

const teacher: User = {
  id: 't-1789975305012',
  name: 'Test Teacher',
  username: 'tt01',
  role: 'TEACHER',
  employeeId: 'PDS0010',
  phone: '9000000001',
} as User;

console.log('\n--- Own identifier ---');
check('identifier is the signed-in employee ID', ownStaffIdentifier(teacher) === 'PDS0010');
check('falls back to user id, never username', ownStaffIdentifier({ ...teacher, employeeId: undefined } as User) === 't-1789975305012');

console.log('\n--- ID card view: no invented values ---');
const noRecord = buildIdCardView(null, teacher);
check('no server record => not available', noRecord.available === false);
check('no server record => no employee ID invented', noRecord.employeeId === undefined);
check('no server record => no department invented', noRecord.department === undefined);
check('no server record => no school phone substituted', noRecord.phone === undefined || noRecord.phone === teacher.phone);

const partial = { id: 't-1', name: 'Anil', employeeId: 'PDS0010', role: 'TEACHER', department: '', phone: '' } as unknown as Staff;
const v = buildIdCardView(partial, teacher);
check('record present => available', v.available === true);
check('empty department stays undefined (not a default)', v.department === undefined);
check('empty record phone falls back to the signed-in user phone only', v.phone === teacher.phone);
check('designation is not the raw role enum', v.designation === undefined);

console.log('\n--- Own attendance summary ---');
const recs: StaffAttendanceRecord[] = [
  { staffId: 't-1789975305012', staffName: 'Me', date: '2026-10-01', status: 'PRESENT' },
  { staffId: 't-1789975305012', staffName: 'Me', date: '2026-10-02', status: 'ABSENT' },
  { staffId: 't-1789975305012', staffName: 'Me', date: '2026-10-05', status: 'LEAVE' },
  { staffId: 't-1789975305012', staffName: 'Me', date: '2026-09-30', status: 'PRESENT' },
  { staffId: 't-2', employeeId: 'PDS0002', staffName: 'Other', date: '2026-10-01', status: 'ABSENT' },
  { staffId: 'x', employeeId: 'PDS0010', staffName: 'Me by emp', date: '2026-10-03', status: 'LATE' },
];
const s = summarizeOwnAttendance(recs, teacher, '2026-10');
check('excludes other staff records even if returned', s.records.every((r) => r.staffId !== 't-2'));
check('excludes other months', s.records.every((r) => r.date.startsWith('2026-10')));
check('counts only own October records (4 total)', s.total === 4, `got ${s.total}`);
check('present count', s.present === 1);
check('absent count', s.absent === 1);
check('leave count', s.leave === 1);
check('late matched via employee ID', s.late === 1);
check('records are newest first', s.records[0].date === '2026-10-05');

const empty = summarizeOwnAttendance([], teacher, '2026-10');
check('no records => total 0 (truthful, not fabricated)', empty.total === 0 && empty.records.length === 0);

console.log('\n--- Role isolation (mobile RBAC) ---');
const modIds = getAuthorizedModulesForUser(teacher).map((m) => m.id);
check('teacher cannot open staff-attendance module', !modIds.includes('staff-attendance'));
check('teacher can open own ID card module', modIds.includes('my-id-card'));

console.log(`\nTEACHER PROFILE RULES: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
