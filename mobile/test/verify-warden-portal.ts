/** npx tsx mobile/test/verify-warden-portal.ts */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  dialable,
  fillRemaining,
  filterStudents,
  liveCounts,
  monthLabel,
  nightLabel,
  parseItems,
  pendingEntries,
  shiftDate,
  shiftMonth,
  statusLabel,
  unmarkedCount,
} from '../src/warden/wardenRules';
import { isWardenTab, usesWardenPortal, wardenBackAction } from '../src/warden/routes';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

t('only HOSTEL_WARDEN opens the warden portal; other roles keep their screens', () => {
  assert.equal(usesWardenPortal('HOSTEL_WARDEN'), true);
  for (const r of ['TEACHER', 'PRINCIPAL', 'SUPER_ADMIN', 'PARENT', 'STUDENT', 'TRANSPORT_MANAGER', 'SUPPORT_STAFF', undefined]) assert.equal(usesWardenPortal(r), false, String(r));
});

t('bottom nav is Home / Students / Attendance / More', () => {
  assert.deepEqual(['home', 'students', 'attendance', 'more'].map((x) => isWardenTab(x as any)), [true, true, true, true]);
  assert.equal(isWardenTab('leaves'), false);
  assert.equal(isWardenTab('profile'), false);
});

t('Android back: close screen, then Home, then exit', () => {
  assert.equal(wardenBackAction(2, 'students'), 'pop');
  assert.equal(wardenBackAction(0, 'attendance'), 'home');
  assert.equal(wardenBackAction(0, 'home'), 'exit');
});

const rows = [
  { id: 'a', record: null, suggested: null },
  { id: 'b', record: { status: 'PRESENT' as const }, suggested: null },
  { id: 'c', record: null, suggested: 'ON_LEAVE' as const },
  { id: 'd', record: null, suggested: null },
];

t('a submit never repeats a student who is already saved (no duplicate night records)', () => {
  const draft = { a: 'ABSENT' as const, b: 'ABSENT' as const };
  assert.deepEqual(pendingEntries(rows, draft), [{ studentId: 'a', status: 'ABSENT' }]);
});

t('"mark remaining" fills only empty rows and uses an approved leave as On Leave', () => {
  const next = fillRemaining(rows, { a: 'OUTSIDE' });
  assert.deepEqual(next, { a: 'OUTSIDE', c: 'ON_LEAVE', d: 'PRESENT' });
  assert.equal(unmarkedCount(rows, next), 0);
  assert.equal(unmarkedCount(rows, {}), 3);
});

t('live counts combine saved records and the draft', () => {
  const c = liveCounts(rows as any, { a: 'ABSENT', c: 'ON_LEAVE' });
  assert.deepEqual(c, { present: 1, absent: 1, onLeave: 1, outside: 0, unmarked: 1, total: 4 });
});

t('student search: name, admission no., roll and room; class filter', () => {
  const list = [
    { name: 'Ravi Raj', admissionNumber: '64010001', rollNumber: '3', roomNumber: '101', classId: 'c-6', className: 'Class 6' },
    { name: 'Ankush Kumar', admissionNumber: '64010002', rollNumber: '7', roomNumber: '204', classId: 'c-8', className: 'Class 8' },
  ];
  assert.deepEqual(filterStudents(list, 'ravi', 'ALL').map((s) => s.name), ['Ravi Raj']);
  assert.deepEqual(filterStudents(list, '64010002', 'ALL').map((s) => s.name), ['Ankush Kumar']);
  assert.deepEqual(filterStudents(list, 'room 204', 'ALL').map((s) => s.name), ['Ankush Kumar']);
  assert.deepEqual(filterStudents(list, '', 'c-6').map((s) => s.name), ['Ravi Raj']);
  assert.equal(filterStudents(list, 'nobody', 'ALL').length, 0);
});

t('dates: tonight / last night labels, day and month stepping', () => {
  assert.equal(nightLabel('2026-10-31', '2026-10-31'), 'Tonight');
  assert.equal(nightLabel('2026-10-30', '2026-10-31'), 'Last night');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.match(monthLabel('2026-10'), /October 2026/);
});

t('mess items: commas or new lines, trimmed, max 20', () => {
  assert.deepEqual(parseItems(' Poha, Milk\nBanana ,, '), ['Poha', 'Milk', 'Banana']);
  assert.equal(parseItems(Array.from({ length: 30 }, (_, i) => `x${i}`).join(',')).length, 20);
});

t('call: only a real number is dialled', () => {
  assert.equal(dialable('+91 98765-43210'), '+919876543210');
  assert.equal(dialable(''), null);
  assert.equal(dialable('n/a'), null);
  assert.equal(statusLabel(null), 'Not marked');
  assert.equal(statusLabel('OUTSIDE'), 'Outside');
});

t('no mock data: warden screens fetch only through wardenApi / apiService', () => {
  const dir = path.join(__dirname, '../src/warden');
  const files = [...fs.readdirSync(dir), ...fs.readdirSync(path.join(dir, 'screens')).map((f) => `screens/${f}`)].filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/mock|faker|dummy|sampleData|lorem/i.test(src), `${f} contains mock data`);
    assert.ok(!/\bfetch\(/.test(src), `${f} calls fetch directly`);
  }
});

t('the warden portal uses the brand colours (navy, royal, gold, page background)', () => {
  const theme = fs.readFileSync(path.join(__dirname, '../src/theme/teacherHome.ts'), 'utf8') + fs.readFileSync(path.join(__dirname, '../src/utils/branding.ts'), 'utf8');
  for (const hex of ['#0B1F4B', '#123B8C', '#D9A441', '#F7F9FC']) assert.ok(theme.toUpperCase().includes(hex), hex);
});

console.log(`\nWARDEN PORTAL: ${n} passed`);
