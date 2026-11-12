/**
 * Teacher access from "Classes Qualified to Teach" + "Subject Expertise", against a running local server
 * (default http://localhost:3000). Creates throw-away teachers, so it refuses anything but localhost.
 * Checks: old Additional Subjects fold into Subject Expertise; a teacher sees only students of the classes
 * they are qualified for; marks are allowed only for their own subjects; a teacher with no classes gets nothing;
 * editing the classes changes access immediately.
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Refusing to run: BASE_URL must be localhost.'); process.exit(2); }
const S = process.env.JWT_SECRET || 'residential_pds_sheohar_jwt_production_secret_key_2026';
const admin = JSON.parse(fs.readFileSync(new URL('../data/adminAccounts.json', import.meta.url), 'utf8')).find((a) => a.role === 'SUPER_ADMIN');
const sign = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '10m' });
const A = sign(admin.id, admin.role);

let fail = 0;
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };
const call = async (method, path, token, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j };
};
const arr = (j) => (Array.isArray(j) ? j : j?.data || j?.students || j?.marks || []);

const classes = arr((await call('GET', '/api/classes', A)).j).filter((c) => (c.status || 'ACTIVE') === 'ACTIVE');
const c2 = classes.find((c) => c.id === 'c-2'); const c3 = classes.find((c) => c.id === 'c-3');
const subs2 = arr((await call('GET', '/api/classes/c-2/subjects', A)).j);
// Three subjects of Class 2: one the teacher chooses, one that arrives through the old Additional Subjects field, one they do not have.
const [math, hindi, english] = subs2;
if (!c2 || !c3 || !math || !hindi || !english) { console.error('Need Class 2, Class 3 and three Class 2 subjects in the dev data.'); process.exit(2); }
const exj = arr((await call('GET', '/api/exams', A)).j);
const exam = exj.find((e) => !Array.isArray(e.classIds) || e.classIds.length === 0 || (e.classIds.includes('c-2')));
const stamp = Date.now() % 1000000;
const mk = (label, extra) => call('POST', '/api/teachers', A, { name: `Access ${label} ${stamp}`, phone: `91${String(stamp).padStart(6, '0')}${label === 'One' ? '11' : '22'}`, portalRole: 'TEACHER', designation: 'Teacher', department: 'ACADEMICS', initialPassword: 'AccessTest@2026x', joiningDate: '2026-04-01', monthlySalary: 1, ...extra });

// ---- create a teacher with the OLD form's extra field
let r = await mk('One', { qualifiedClasses: [c2.name], classesQualifiedToTeach: c2.name, subjectExpertise: [math.name], additionalSubjects: [hindi.name] });
check('Teacher with qualified class is created', r.s === 200 || r.s === 201, `${r.s} ${r.j?.error || ''}`);
const t1 = r.j?.staff;
const stored = arr((await call('GET', '/api/teachers', A)).j).find((x) => x.id === t1?.id) || t1;
check('Old Additional Subjects are merged into Subject Expertise', stored && stored.subjectExpertise?.includes(math.name) && stored.subjectExpertise?.includes(hindi.name), JSON.stringify(stored?.subjectExpertise));
check('No separate Additional Subjects list is stored', stored && !('additionalSubjects' in stored) && !('additionalSubjects' in (stored.teachingProfile || {})));
const T1 = sign(t1.id, 'TEACHER');

// ---- what the teacher is allowed
r = await call('GET', '/api/teacher/authorized-assignments', T1);
const cls = r.j?.classes || [];
check('Qualified class appears with its sections', r.s === 200 && cls.some((c) => c.classId === 'c-2' && c.sections.length > 0), JSON.stringify(cls));
check('A class the teacher is not qualified for is absent', !cls.some((c) => c.classId === 'c-3'));
const subNames = (r.j?.subjects || []).map((x) => x.name.toLowerCase());
check('Allowed subjects are exactly the teacher\'s own', subNames.includes(math.name.toLowerCase()) && subNames.includes(hindi.name.toLowerCase()) && !subNames.includes(english.name.toLowerCase()), subNames.join());

// ---- My Classes: qualified-only classes are listed apart from assigned ones
check('Qualified class is listed under "qualified only" with a student count', (r.j?.qualifiedOnlyClasses || []).some((c) => c.classId === 'c-2' && typeof c.studentCount === 'number' && c.subjects.length > 0), JSON.stringify(r.j?.qualifiedOnlyClasses));
check('It is not listed as assigned', !(r.j?.assignedClasses || []).some((c) => c.classId === 'c-2'));

// ---- students
r = await call('GET', '/api/students?limit=500', T1);
const myStudents = arr(r.j);
check('My Students lists students of the qualified class', r.s === 200 && myStudents.length > 0 && myStudents.every((s) => s.classId === 'c-2'), `${r.s} n=${myStudents.length}`);
const other = arr((await call('GET', '/api/students?limit=500', A)).j).find((s) => s.classId === 'c-3');
if (other) {
  r = await call('GET', `/api/students/${other.id}`, T1);
  check('A student of another class cannot be opened', r.s === 403 || r.s === 404, `${r.s}`);
}

// ---- marks
const row = (st, sub) => ({ examId: exam.id, studentId: st.id, studentName: st.name, classId: 'c-2', section: st.section || 'A', subjectId: sub.id, subjectName: sub.name, maxMarks: 100, marksObtained: 50, isAbsent: false });
const save = (token, st, sub) => call('POST', '/api/marks', token, { examId: exam.id, classId: 'c-2', subjectId: sub.id, marksList: [row(st, sub)], submissionStatus: 'DRAFT' });
const st2 = myStudents[0];
r = await save(T1, st2, math);
check('Teacher can enter marks for their own subject', r.s === 200, `${r.s} ${r.j?.error || ''}`);
r = await save(T1, st2, english);
check('Teacher cannot enter marks for a subject outside Subject Expertise', r.s === 403, `${r.s} ${r.j?.error || ''}`);

// ---- a teacher with no classes
r = await mk('Two', { subjectExpertise: [math.name] });
const t2 = r.j?.staff; const T2 = sign(t2.id, 'TEACHER');
r = await call('GET', '/api/teacher/authorized-assignments', T2);
check('Teacher with no classes has no class access', r.s === 200 && (r.j?.classes || []).length === 0, JSON.stringify(r.j?.classes));
r = await call('GET', '/api/students?limit=500', T2);
check('Teacher with no classes sees no students', arr(r.j).length === 0, `n=${arr(r.j).length}`);
r = await save(T2, st2, math);
check('Teacher with no classes cannot enter marks', r.s === 403, `${r.s}`);

// ---- qualified class with no matching subject
r = await call('PUT', `/api/teachers/${t2.id}`, A, { qualifiedClasses: [c2.name], classesQualifiedToTeach: c2.name, subjectExpertise: ['Subject Not In Class'] });
check('Admin saves the qualified class', r.s === 200, `${r.s} ${r.j?.error || ''}`);
r = await call('GET', '/api/teacher/authorized-assignments', T2);
check('A teacher qualified for no subject of the class gets no subjects (not all of them)', (r.j?.subjects || []).length === 0, JSON.stringify(r.j?.subjects));
r = await save(T2, st2, math);
check('…and cannot enter marks', r.s === 403, `${r.s}`);

// ---- changing classes changes access straight away
r = await call('PUT', `/api/teachers/${t1.id}`, A, { qualifiedClasses: [c2.name, c3.name], classesQualifiedToTeach: `${c2.name}, ${c3.name}`, subjectExpertise: [math.name, hindi.name] });
check('Admin adds a second qualified class', r.s === 200, `${r.s} ${r.j?.error || ''}`);
r = await call('GET', '/api/teacher/authorized-assignments', T1);
check('Both classes are now available', (r.j?.classes || []).some((c) => c.classId === 'c-2') && (r.j?.classes || []).some((c) => c.classId === 'c-3'));
r = await call('PUT', `/api/teachers/${t1.id}`, A, { qualifiedClasses: [c3.name], classesQualifiedToTeach: c3.name });
r = await call('GET', '/api/teacher/authorized-assignments', T1);
check('Removing a class removes access to it', !(r.j?.classes || []).some((c) => c.classId === 'c-2'), JSON.stringify(r.j?.classes));
r = await save(T1, st2, math);
check('…and marks for that class are refused', r.s === 403, `${r.s}`);

console.log(`\n${fail ? `${fail} failed` : 'All teacher access checks passed.'}`);
process.exit(fail ? 1 : 0);
