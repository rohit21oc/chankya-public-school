/** npx tsx scripts/verify-auth-match.ts — which account a sign-in / session resolves to. */
import assert from 'node:assert/strict';
import { pickByPriority } from '../server/services/authMatch.ts';

const staff = [
  { id: 't-vp', employeeId: 'CPS0002', name: 'Vice Principal', email: 'school@chanakyaschool.example', phone: '9000000002' },
  { id: 't-w', employeeId: 'CPS0019', name: 'Warden', email: 'school@chanakyaschool.example', phone: '9000000019' },
  { id: 't-x', employeeId: 'CPS0020', name: 'Teacher', email: 'teacher@chanakyaschool.example', phone: '9000000020' },
];
const forSession = (u: { id?: string; employeeId?: string; email?: string; phone?: string }) =>
  pickByPriority(staff, [(s) => s.id === u.id, (s) => !!u.employeeId && s.employeeId === u.employeeId], [(s) => !!u.email && s.email === u.email, (s) => !!u.phone && s.phone === u.phone]);

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };
t('the warden session finds the warden, even though the Vice Principal (listed first) has the same email', () => {
  assert.equal(forSession({ id: 't-w', email: 'school@chanakyaschool.example' })?.name, 'Warden');
});
t('employee ID beats a shared email', () => {
  assert.equal(forSession({ employeeId: 'CPS0019', email: 'school@chanakyaschool.example' })?.name, 'Warden');
});
t('a shared email alone matches nobody (never the first person on the list)', () => {
  assert.equal(forSession({ email: 'school@chanakyaschool.example' }), undefined);
});
t('a unique email or mobile still works', () => {
  assert.equal(forSession({ email: 'teacher@chanakyaschool.example' })?.name, 'Teacher');
  assert.equal(forSession({ phone: '9000000019' })?.name, 'Warden');
});
console.log(`\nAUTH MATCH: ${n} passed`);
