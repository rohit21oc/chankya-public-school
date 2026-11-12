/**
 * Teacher sections per qualified class + subject-only marks + dynamic sections, against a RUNNING local server
 * (JSON dev data, no MongoDB needed):
 *   env -u MONGODB_URI NODE_ENV=production npx tsx server.ts      then      node scripts/verify-teacher-class-sections.mjs
 * It edits Class 6 (sections A–F) and creates test teachers. Restore the data afterwards:
 *   git checkout -- data; git clean -fdq data
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const B = process.env.BASE_URL || 'http://localhost:3000';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(B)) { console.error('Refusing to run: BASE_URL must be localhost.'); process.exit(2); }
const S = process.env.JWT_SECRET || 'residential_cps_sheohar_jwt_production_secret_key_2026';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const admin = read('adminAccounts.json').find((a) => a.role === 'SUPER_ADMIN');
const ADMIN = jwt.sign({ userId: admin.id, role: admin.role }, S, { expiresIn: '30m' });
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !d ? '' : `  → ${d}`}`); };
const call = async (method, p, tok, body) => {
  const r = await fetch(B + p, { method, headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j };
};
const stamp = String(Date.now()).slice(-5);
const PW = 'SecTest@2026x';
const mkTeacher = async (label, phoneTail, extra) => {
  const r = await call('POST', '/api/teachers', ADMIN, {
    name: `Section ${label} ${stamp}`, phone: `98${stamp}${phoneTail}`, portalRole: 'TEACHER', designation: 'TGT Teacher', department: 'ACADEMICS',
    initialPassword: PW, joiningDate: '2026-04-01', monthlySalary: 1, gender: 'FEMALE', dob: '1990-01-01', ...extra,
  });
  return r.j?.staff || r.j?.data || r.j;
};
// Signed like a real session for that staff member (password login needs MongoDB, which this local check skips).
const login = async (staff) => (staff?.id ? jwt.sign({ userId: staff.id, role: 'TEACHER' }, S, { expiresIn: '30m' }) : '');
const pairs = (d) => (d?.detailedAssignments || []).map((a) => `${a.className}-${a.section}`).sort();

// ---------- 1. Dynamic sections: Class 6 gets six sections ----------
const cls6 = (await call('GET', '/api/classes/c-6', ADMIN)).j;
const c6 = cls6?.data || cls6;
const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ ...(c6.detailedSections || []).find((d) => d.name === name), name, status: 'ACTIVE' }));
let r = await call('PUT', '/api/classes/c-6', ADMIN, { ...c6, detailedSections: six, sections: six.map((d) => d.name) });
check('Class 6 now has six sections (A–F)', r.s === 200, `${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);
r = await call('GET', '/api/attendance/assigned-classes', ADMIN);
const c6att = (r.j?.classes || []).find((c) => c.classId === 'c-6');
check('Super Admin attendance list shows all six sections of Class 6', JSON.stringify(c6att?.sections) === JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F']), JSON.stringify(c6att));

// ---------- 2. A teacher qualified for chosen sections only ----------
const t1 = await mkTeacher('Maths', '111', {
  subjectExpertise: ['Mathematics'],
  qualifiedClasses: ['Class 6', 'Class 7'],
  classesQualifiedToTeach: 'Class 6, Class 7',
  qualifiedClassSections: [
    { className: 'class 6', sections: ['b', ' D ', 'B'] },
    { className: 'Class 7', sections: ['A'] },
    { className: 'Class 9', sections: ['A'] }, // not qualified for it → dropped
  ],
});
check('Teacher created', !!t1?.id, JSON.stringify(t1).slice(0, 200));
const saved = (await call('GET', `/api/teachers/${t1.id}`, ADMIN)).j;
const savedStaff = saved?.data || saved?.staff || saved;
check('Saved sections are cleaned: upper-case, unique, only qualified classes', JSON.stringify(savedStaff.qualifiedClassSections) === JSON.stringify([{ className: 'Class 6', sections: ['B', 'D'] }, { className: 'Class 7', sections: ['A'] }]), JSON.stringify(savedStaff.qualifiedClassSections));
const tok1 = await login(t1);
check('Teacher signs in', !!tok1);
r = await call('GET', '/api/teacher/authorized-assignments', tok1);
check('Teacher sees only Class 6-B, 6-D and 7-A (not the other sections)', JSON.stringify(pairs(r.j)) === JSON.stringify(['Class 6-B', 'Class 6-D', 'Class 7-A']), JSON.stringify(pairs(r.j)));
check('…teaching only their own subject (Mathematics)', (r.j?.detailedAssignments || []).every((a) => a.subjects.length === 1 && a.subjects[0].name === 'Mathematics'), JSON.stringify(r.j?.detailedAssignments?.map((a) => a.subjects)));
r = await call('GET', '/api/teacher/dashboard-summary', tok1);
const dashPairs = (r.j?.assignedClasses || r.j?.data?.assignedClasses || []).map((a) => `${a.className}-${a.section}`).sort();
check('App/web teacher dashboard shows the same class sections', r.s === 200 && JSON.stringify(dashPairs) === JSON.stringify(['Class 6-B', 'Class 6-D', 'Class 7-A']), `${r.s} ${JSON.stringify(dashPairs)} ${JSON.stringify(r.j).slice(0, 200)}`);
r = await call('GET', '/api/students?classId=c-6&section=A', tok1);
check('Students of Class 6-A are refused to this teacher', r.s === 403, r.s);
r = await call('GET', '/api/students?classId=c-6&section=B', tok1);
check('Students of Class 6-B are allowed', r.s === 200, r.s);

// ---------- 3. Marks only for their subject in their sections ----------
const mark = (tok, section, subjectId, studentId) => call('POST', '/api/marks', tok, {
  examId: 'ex-2', classId: 'c-6', section, subjectId, submissionStatus: 'DRAFT',
  marksList: [{ studentId, examId: 'ex-2', classId: 'c-6', section, subjectId, marksObtained: 40, maxMarks: 100 }],
});
r = await mark(tok1, 'B', 's-1', 'st-8');
check('Mathematics marks for Class 6-B: allowed', r.s === 200 || r.s === 201, `${r.s} ${JSON.stringify(r.j).slice(0, 200)}`);
r = await mark(tok1, 'B', 's-3', 'st-8');
check('Science marks for Class 6-B: refused (not their subject)', r.s === 403, `${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);
r = await mark(tok1, 'A', 's-1', 'st-1790769784943');
check('Mathematics marks for Class 6-A: refused (not their section)', r.s === 403, `${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);

// ---------- 4. Class Incharge follows the class but enters marks only for their subject ----------
r = await call('PUT', `/api/teachers/${t1.id}`, ADMIN, { classTeacherOf: 'Class 6-B' });
check('Teacher made Class Incharge of 6-B', r.s === 200, `${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);
r = await call('GET', '/api/teacher/authorized-assignments', tok1);
const b6 = (r.j?.detailedAssignments || []).find((a) => a.className === 'Class 6' && a.section === 'B');
check('Incharge: subjects = Mathematics only; other class subjects listed separately to follow', b6?.isClassTeacher && b6.subjects.map((s) => s.name).join() === 'Mathematics' && b6.monitorSubjects?.some((s) => s.name === 'Science'), JSON.stringify(b6));
r = await mark(tok1, 'B', 's-3', 'st-8');
check('Incharge still cannot enter Science marks (only the Science teacher can)', r.s === 403, r.s);

// ---------- 5. Editing the sections changes access ----------
r = await call('PUT', `/api/teachers/${t1.id}`, ADMIN, { classTeacherOf: '', qualifiedClasses: ['Class 6'], classesQualifiedToTeach: 'Class 6', qualifiedClassSections: [{ className: 'Class 6', sections: ['E', 'F'] }, { className: 'Class 7', sections: ['A'] }] });
check('Sections edited to 6-E, 6-F and Class 7 removed', r.s === 200, `${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);
r = await call('GET', '/api/teacher/authorized-assignments', tok1);
check('Access follows the edit: Class 6-E and 6-F only', JSON.stringify(pairs(r.j)) === JSON.stringify(['Class 6-E', 'Class 6-F']), JSON.stringify(pairs(r.j)));

// ---------- 6. Older teacher records without a section choice keep all sections ----------
const t2 = await mkTeacher('Legacy', '112', { subjectExpertise: ['Science'], qualifiedClasses: ['Class 6'], classesQualifiedToTeach: 'Class 6' });
const tok2 = await login(t2);
r = await call('GET', '/api/teacher/authorized-assignments', tok2);
check('A teacher saved without section choices still covers every active section (as before)', JSON.stringify(pairs(r.j)) === JSON.stringify(['Class 6-A', 'Class 6-B', 'Class 6-C', 'Class 6-D', 'Class 6-E', 'Class 6-F']), JSON.stringify(pairs(r.j)));
r = await call('PUT', '/api/classes/c-6', ADMIN, { ...c6, detailedSections: six.map((d) => (d.name === 'C' ? { ...d, status: 'INACTIVE' } : d)), sections: six.map((d) => d.name) });
r = await call('GET', '/api/teacher/authorized-assignments', tok2);
check('An inactive section disappears from teachers automatically', !pairs(r.j).includes('Class 6-C') && pairs(r.j).length === 5, JSON.stringify(pairs(r.j)));
r = await call('GET', '/api/attendance/assigned-classes', ADMIN);
check('…and from the Super Admin attendance list', JSON.stringify((r.j?.classes || []).find((c) => c.classId === 'c-6')?.sections) === JSON.stringify(['A', 'B', 'D', 'E', 'F']));

console.log(fail ? `\n${fail} FAILED (${pass} passed)` : `\nAll ${pass} checks passed`);
process.exit(fail ? 1 : 0);
