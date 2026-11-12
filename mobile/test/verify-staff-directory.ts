import assert from 'node:assert/strict';
import { filterStaff, summarizeStaff } from '../src/utils/staffDirectory';

const staff = [
  { id: '1', name: 'Anita Rao', employeeId: 'E1', designation: 'PGT Maths Teacher', department: 'Academics', status: 'ACTIVE' },
  { id: '2', name: 'Bipin Das', employeeId: 'E2', designation: 'Accountant', department: 'Accounts', status: 'ACTIVE' },
  { id: '3', name: 'Chitra Roy', employeeId: 'E3', designation: 'TGT Teacher', department: 'Academics', status: 'INACTIVE' },
  { id: '4', name: 'Dev Kumar', employeeId: 'E4', designation: 'Driver', department: '', status: undefined },
];
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

t('active filter excludes inactive', () => assert.deepEqual(filterStaff(staff, { status: 'ACTIVE' }).map((s) => s.id), ['1', '2', '4']));
t('inactive filter', () => assert.deepEqual(filterStaff(staff, { status: 'INACTIVE' }).map((s) => s.id), ['3']));
t('ALL returns everyone sorted by name', () => assert.equal(filterStaff(staff, { status: 'ALL' }).length, 4));
t('search by employee id', () => assert.deepEqual(filterStaff(staff, { status: 'ALL', query: 'e2' }).map((s) => s.id), ['2']));
t('search by designation', () => assert.deepEqual(filterStaff(staff, { status: 'ALL', query: 'driver' }).map((s) => s.id), ['4']));
t('department filter', () => assert.deepEqual(filterStaff(staff, { status: 'ALL', department: 'Academics' }).map((s) => s.id), ['1', '3']));
t('summary counts only active in teaching split', () => {
  const s = summarizeStaff(staff);
  assert.equal(s.total, 4); assert.equal(s.active, 3); assert.equal(s.inactive, 1);
  assert.equal(s.teaching + s.nonTeaching, 3);
});
t('departments merge case-insensitively and filter matches', () => {
  const l = [
    { id: 'a', name: 'A', department: 'ACADEMICS', status: 'ACTIVE' },
    { id: 'b', name: 'B', department: 'Academics', status: 'ACTIVE' },
  ];
  assert.deepEqual(summarizeStaff(l).departments, [{ name: 'ACADEMICS', count: 2 }]);
  assert.equal(filterStaff(l, { status: 'ALL', department: 'ACADEMICS' }).length, 2);
});
console.log(`\n${n} passed`);
