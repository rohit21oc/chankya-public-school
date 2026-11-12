/**
 * Regression checks for the teacher portal audit. Fully offline.
 * Run: npx tsx test/verify-teacher-portal-audit.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { sanitizeMarksInput, validateMarksForSave, toggleAbsentRow } from '../src/utils/marksRules';
import { resolveBackAction } from '../src/utils/backNavigation';
import { createSubmitGuard } from '../src/utils/submitGuard';

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};

console.log('--- Source integrity: no merge-conflict residue ---');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p);
  }
  return out;
};
const dirty = walk(join(__dirname, '..', 'src')).filter((f) =>
  /^(<<<<<<<|=======$|>>>>>>>)/m.test(readFileSync(f, 'utf8'))
);
check('no conflict markers in mobile/src', dirty.length === 0, dirty.join(', '));
const dash = readFileSync(join(__dirname, '..', 'src/screens/TeacherDashboardScreen.tsx'), 'utf8');
check('TeacherDashboardScreen has exactly one export', (dash.match(/export const TeacherDashboardScreen/g) || []).length === 1);
check('TeacherDashboardScreen has a single react import', (dash.match(/from 'react';/g) || []).length === 1);

console.log('--- Marks input sanitising ---');
check('strips letters', sanitizeMarksInput('4a5', 100).value === '45');
check('collapses extra decimal points', sanitizeMarksInput('1.2.3', 100).value === '1.23');
check('"1.2.3" never keeps two dots', (sanitizeMarksInput('1.2.3', 100).value.match(/\./g) || []).length === 1);
check('above max is rejected and keeps previous value', (() => {
  const r = sanitizeMarksInput('101', 100, '99');
  return r.exceeded && r.value === '99';
})());
check('exactly max is accepted', !sanitizeMarksInput('100', 100).exceeded);
check('empty input is accepted', sanitizeMarksInput('', 100).value === '');

console.log('--- Marks validation before save ---');
const rows = (...r: Array<[string, string, boolean]>) =>
  r.map(([studentId, marksObtained, isAbsent]) => ({ studentId, studentName: studentId, marksObtained, isAbsent }));
check('blank rows are skipped, not saved as 0', validateMarksForSave(rows(['a', '', false], ['b', '40', false]), 50).valid.length === 1);
check('absent saves 0 with isAbsent', (() => {
  const v = validateMarksForSave(rows(['a', '0', true]), 50).valid[0];
  return v.marksObtained === 0 && v.isAbsent === true;
})());
check('over max is an error', validateMarksForSave(rows(['a', '51', false]), 50).errors.length === 1);
check('negative is an error', validateMarksForSave(rows(['a', '-1', false]), 50).errors.length === 1);
check('lone "." is an error', validateMarksForSave(rows(['a', '.', false]), 50).errors.length === 1);
check('non-numeric is an error', validateMarksForSave(rows(['a', '12abc', false]), 50).errors.length === 1);
check('duplicate student rows are an error', validateMarksForSave(rows(['a', '1', false], ['a', '2', false]), 50).errors.length === 1);
check('missing max marks blocks save', validateMarksForSave(rows(['a', '1', false]), 0).errors.length === 1);
check('decimal marks are kept', validateMarksForSave(rows(['a', '12.5', false]), 50).valid[0].marksObtained === 12.5);

console.log('--- Absent toggle ---');
const base = { studentId: 'a', marksObtained: '', isAbsent: false };
const on = toggleAbsentRow(base);
check('toggle on sets absent and 0', on.isAbsent && on.marksObtained === '0');
const off = toggleAbsentRow(on);
check('toggle off clears the placeholder 0 (regression)', !off.isAbsent && off.marksObtained === '');
check('un-absented row is not saved as a fake 0', validateMarksForSave([{ ...off, studentName: 'a' }], 50).valid.length === 0);

console.log('--- Android back button ---');
check('drawer open -> close drawer', resolveBackAction({ isAuthenticated: true, isDrawerOpen: true, currentScreenId: 'marks-entry' }) === 'close-drawer');
check('sub-screen -> dashboard', resolveBackAction({ isAuthenticated: true, isDrawerOpen: false, currentScreenId: 'timetable' }) === 'go-dashboard');
check('dashboard -> exit', resolveBackAction({ isAuthenticated: true, isDrawerOpen: false, currentScreenId: 'dashboard' }) === 'exit-app');
check('login screen -> exit', resolveBackAction({ isAuthenticated: false, isDrawerOpen: false, currentScreenId: 'dashboard' }) === 'exit-app');

console.log('--- Double-submit guard ---');
const g = createSubmitGuard();
check('first tap enters', g.tryEnter() === true);
check('second tap before completion is blocked', g.tryEnter() === false);
g.leave();
check('can submit again after completion', g.tryEnter() === true);

console.log(`\nTEACHER PORTAL AUDIT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
