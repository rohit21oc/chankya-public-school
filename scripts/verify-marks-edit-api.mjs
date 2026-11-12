/**
 * Marks entry rules against a running server (default http://localhost:3000, or BASE_URL):
 * an admin can enter, correct and flip Absent/Present repeatedly; a teacher can enter once but cannot
 * change submitted marks; a repeated student in one request is saved once (last row wins).
 * Uses the dev data in data/*.json and signs its own tokens, so run it against a local server only.
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Refusing to run: BASE_URL must be localhost.'); process.exit(2); }
const S = process.env.JWT_SECRET || 'residential_pds_sheohar_jwt_production_secret_key_2026';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const admin = read('adminAccounts.json').find((a) => a.role === 'SUPER_ADMIN');
const teacher = read('staff.json').find((s) => s.id === 't-3');
const tok = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '10m' });
const A = tok(admin.id, admin.role);
const T = tok(teacher.id, 'TEACHER');

let fail = 0;
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j };
};

const students = (await call('GET', '/api/students', A)).j;
const list = Array.isArray(students) ? students : students?.data || students?.students || [];
const stu = list.filter((x) => x.classId === 'c-2' && (x.section || 'A') === 'A');
const subjects = (await call('GET', '/api/classes/c-2/subjects', A)).j;
const subs = Array.isArray(subjects) ? subjects : subjects?.subjects || [];
const sub = subs.find((x) => /math/i.test(x.name)) || subs[0];
if (stu.length < 2 || !sub) { console.error('Need two Class 2-A students and a subject in the dev data.'); process.exit(2); }
const [s1, s2] = stu;
const exj = (await call('GET', '/api/exams', A)).j;
const exams = Array.isArray(exj) ? exj : exj?.data || exj?.exams || [];
const exam = exams.find((e) => !Array.isArray(e.classIds) || e.classIds.length === 0 || e.classIds.includes('c-2'));
if (!exam) { console.error('Need an exam that applies to Class 2 in the dev data.'); process.exit(2); }
const examId = exam.id;
const row = (st, over = {}) => ({ examId, studentId: st.id, studentName: st.name, classId: 'c-2', section: st.section || 'A', subjectId: sub.id, subjectName: sub.name, maxMarks: 100, marksObtained: 0, isAbsent: false, ...over });
const save = (token, rows, status = 'SUBMITTED') => call('POST', '/api/marks', token, { examId, classId: 'c-2', subjectId: sub.id, marksList: rows, submissionStatus: status });
const stored = async (st) => (await call('GET', `/api/marks?examId=${examId}`, A)).j?.marks?.find?.((m) => m.studentId === st.id && m.subjectId === sub.id)
  ?? ((await call('GET', `/api/marks?examId=${examId}`, A)).j || []).find?.((m) => m.studentId === st.id && m.subjectId === sub.id);

let r = await save(A, [row(s1, { isAbsent: true })]);
check('Admin saves a student as Absent', r.s === 200, `${r.s} ${r.j?.error || ''}`);
r = await save(A, [row(s1, { marksObtained: 90 })]);
check('Admin changes Absent to Present with marks', r.s === 200, `${r.s} ${r.j?.error || ''}`);
check('Stored as present with 90', (await stored(s1))?.isAbsent === false && Number((await stored(s1))?.marksObtained) === 90);
r = await save(A, [row(s1, { marksObtained: 75 })]);
check('Admin corrects the marks again', r.s === 200 && Number((await stored(s1))?.marksObtained) === 75, `${r.s} ${r.j?.error || ''}`);
r = await save(A, [row(s1, { isAbsent: true })]);
check('Admin can flip back to Absent', r.s === 200 && (await stored(s1))?.isAbsent === true, `${r.s} ${r.j?.error || ''}`);
r = await save(A, [row(s1, { marksObtained: 10 }), row(s1, { marksObtained: 88 })]);
check('Same student twice in one request is saved once, last row wins', r.s === 200 && Number((await stored(s1))?.marksObtained) === 88, `${r.s} ${r.j?.error || ''}`);

r = await save(T, [row(s2, { marksObtained: 40 })]);
check('Teacher enters marks the first time', r.s === 200, `${r.s} ${r.j?.error || ''}`);
r = await save(T, [row(s2, { marksObtained: 95 })]);
check('Teacher cannot change submitted marks', r.s === 403, `${r.s} ${r.j?.error || ''}`);
r = await save(T, [row(s2, { isAbsent: true })]);
check('Teacher cannot flip a submitted mark to Absent', r.s === 403, `${r.s}`);
r = await save(T, [row(s2, { marksObtained: 40 })]);
check('Teacher re-sending unchanged marks is accepted', r.s === 200, `${r.s} ${r.j?.error || ''}`);
check('Submitted mark is untouched by the refused edits', Number((await stored(s2))?.marksObtained) === 40);
r = await save(A, [row(s2, { marksObtained: 41 })]);
check('Admin can still edit what the teacher submitted', r.s === 200 && Number((await stored(s2))?.marksObtained) === 41, `${r.s} ${r.j?.error || ''}`);

console.log(`\n${fail ? `${fail} failed` : 'All marks edit checks passed.'}`);
process.exit(fail ? 1 : 0);
