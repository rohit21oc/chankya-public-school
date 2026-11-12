/**
 * Homework API checks against a RUNNING local server (default http://localhost:3000) and its MongoDB.
 * Signs in as real teacher / student / parent accounts and checks that homework is scoped by class,
 * section and subject, that edit/delete are limited to the owner (or an admin), that validation
 * rejects bad input, and that records persist in MongoDB.
 *
 * It CREATES two test teacher accounts (and removes the homework it creates), so it refuses to run
 * against anything but localhost. Never point it at production.
 *
 * Usage (repo root, .env loaded):  set -a; . ./.env; set +a; node scripts/verify-homework-api.mjs
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BASE_URL || 'http://localhost:3000')) {
  console.error('Refusing to run: BASE_URL must be localhost.');
  process.exit(2);
}
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
const B = process.env.BASE_URL || 'http://localhost:3000';
const adminTok = jwt.sign({ userId: 'ui-setup', role: 'SUPER_ADMIN', iat: Math.floor(Date.now()/1000) }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200) }; } };
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const call = async (method, path, tok, body) => { const r = await fetch(B + path, { method, headers: tok ? H(tok) : { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await j(r)]; };
const stamp = Date.now() % 100000;

// ---- teachers: T1 -> Class 1-A / Hindi Course-A (s-5), T2 -> Class 2-A / English (s-2)
async function mkTeacher(name, phone, cls, sec, clsName, subj) {
  const [st, b] = await call('POST', '/api/teachers', adminTok, { name, phone, portalRole: 'TEACHER', designation: 'Teacher', department: 'ACADEMICS', initialPassword: 'HwTest@2026x', joiningDate: '2026-04-01', monthlySalary: 1,
    assignedClasses: [`${clsName}-${sec}`], teachingProfile: { assignedClassId: cls, assignedSection: sec, assignedPrimarySubject: subj, isClassTeacher: false } });
  if (!b.staff) throw new Error(`teacher create failed ${st} ${JSON.stringify(b).slice(0, 200)}`);
  return b.staff;
}
const t1 = await mkTeacher(`HW Teacher One ${stamp}`, `91${String(stamp).padStart(5,'0')}101`, 'c-1', 'A', 'Class 1', 'Hindi Course-A');
const t2 = await mkTeacher(`HW Teacher Two ${stamp}`, `91${String(stamp).padStart(5,'0')}102`, 'c-2', 'A', 'Class 2', 'English Language & Literature');
const mongo = await MongoClient.connect(process.env.MONGODB_URI);
await mongo.db('pds_school_erp').collection('users').updateMany({ id: { $in: [t1.id, t2.id] } }, { $set: { mustChangePassword: false } });
const login = async (body) => { const [s, b] = await call('POST', '/api/auth/login', null, body); return [s, b, b.token || b.accessToken]; };
let [s1, b1, tok1] = await login({ identifier: t1.employeeId, password: 'HwTest@2026x', loginType: 'STAFF' });
let [s2, b2, tok2] = await login({ identifier: t2.employeeId, password: 'HwTest@2026x', loginType: 'STAFF' });
check('teacher 1 logs in', !!tok1, `${s1} ${b1.error || ''}`);
check('teacher 2 logs in', !!tok2, `${s2} ${b2.error || ''}`);
let [ss, bs, tokS] = await login({ identifier: '64010006', dob: '17-09-2011', loginType: 'STUDENT' });
check('student (Class 1-A) logs in', !!tokS, `${ss} ${bs.error || ''}`);
let [ss2, bs2, tokS2] = await login({ identifier: '64013069', dob: '15-05-2012', loginType: 'STUDENT' });
check('student (Class 2-A) logs in', !!tokS2, `${ss2} ${bs2.error || ''}`);
let [sp, bp, tokP] = await login({ identifier: '9855667788', password: '17-09-2011', loginType: 'PARENT' });
check('parent of Class 1-A student logs in', !!tokP, `${sp} ${bp.error || ''}`);

const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const plus = (n) => new Date(Date.parse(today) + n * 86400e3).toISOString().slice(0, 10);

// ---- auth required
check('GET /api/homework without token -> 401', (await call('GET', '/api/homework', null))[0] === 401);
check('POST /api/homework without token -> 401', (await call('POST', '/api/homework', null, { title: 'x' }))[0] === 401);

// ---- options
let [so, bo] = await call('GET', '/api/homework/options', tok1);
check('teacher options: only own class/section/subject', so === 200 && bo.classes.length === 1 && bo.classes[0].classId === 'c-1' && bo.classes[0].sections.length === 1 && bo.classes[0].sections[0].name === 'A' && bo.classes[0].sections[0].subjects.some((x) => x.id === 's-5'), JSON.stringify(bo).slice(0, 220));
[so, bo] = await call('GET', '/api/homework/options', adminTok);
check('admin options: all active classes', so === 200 && bo.classes.length >= 10 && bo.classes.find((c) => c.classId === 'c-8')?.sections.find((s) => s.name === 'A')?.subjects.some((x) => x.id === 's-3'));
check('student cannot read options', (await call('GET', '/api/homework/options', tokS))[0] === 403);
check('parent cannot read options', (await call('GET', '/api/homework/options', tokP))[0] === 403);

// ---- create
const good = { classId: 'c-1', section: 'A', subjectId: 's-5', title: `Hindi poem ${stamp}`, instructions: 'Learn the first four lines.', dueDate: plus(2) };
let [c, cb] = await call('POST', '/api/homework', tok1, good);
check('teacher creates homework for own class/section/subject', c === 201 && cb.id && cb.teacherName === t1.name && cb.className === 'Class 1' && cb.subjectName === 'Hindi Course-A' && cb.assignedDate === today && cb.canManage === true, `${c} ${cb.error || ''}`);
const hwId = cb.id;
check('teacher cannot create for another class', (await call('POST', '/api/homework', tok1, { ...good, classId: 'c-2' }))[0] === 403);
check('teacher cannot create for another section', (await call('POST', '/api/homework', tok1, { ...good, section: 'B' }))[0] === 403);
check('teacher cannot create for an unassigned subject', (await call('POST', '/api/homework', tok1, { ...good, subjectId: 's-2' }))[0] === 403);
check('student cannot create', (await call('POST', '/api/homework', tokS, good))[0] === 403);
check('parent cannot create', (await call('POST', '/api/homework', tokP, good))[0] === 403);
let r = await call('POST', '/api/homework', tok1, { ...good, title: 'ab' }); check('short title -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, instructions: '  ' }); check('blank instructions -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, dueDate: '' }); check('missing due date -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, dueDate: '2026-02-30' }); check('impossible date -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, assignedDate: plus(5), dueDate: plus(1) }); check('due before assigned -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, classId: 'nope' }); check('unknown class -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', adminTok, { ...good, classId: 'c-1', section: 'A', subjectId: 's-3' }); check('subject not taught in the class -> 400 (admin)', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, attachmentFileKey: '../etc/passwd', attachmentName: 'x' }); check('bad attachment key -> 400', r[0] === 400, r[1].error);
r = await call('POST', '/api/homework', tok1, { ...good, title: `With file ${stamp}`, attachmentFileKey: 'school/homework/test-file.pdf', attachmentName: 'worksheet.pdf', attachmentSize: 1234 });
check('attachment saved', r[0] === 201 && r[1].attachmentFileKey === 'school/homework/test-file.pdf' && r[1].attachmentName === 'worksheet.pdf', r[1].error);
const hwFileId = r[1].id;
// admin creates for Class 2-A for isolation checks
r = await call('POST', '/api/homework', adminTok, { classId: 'c-2', section: 'A', subjectId: 's-2', title: `English essay ${stamp}`, instructions: 'Write 100 words.', dueDate: plus(3) });
check('admin creates homework for any class', r[0] === 201, r[1].error);
const hwC2 = r[1].id;
// teacher 2 creates in own class
r = await call('POST', '/api/homework', tok2, { classId: 'c-2', section: 'A', subjectId: 's-2', title: `T2 homework ${stamp}`, instructions: 'Read page 10.', dueDate: plus(1) });
check('teacher 2 creates for own class', r[0] === 201, `${r[0]} ${r[1].error || ''}`);
const hwT2 = r[1].id;

// ---- visibility
const ids = async (tok) => { const [s, b] = await call('GET', '/api/homework', tok); return [s, Array.isArray(b) ? b.map((x) => x.id) : b]; };
let [sv, v] = await ids(tok1);
check('teacher 1 sees own class homework, not Class 2-A', sv === 200 && v.includes(hwId) && v.includes(hwFileId) && !v.includes(hwC2) && !v.includes(hwT2));
[sv, v] = await ids(tok2);
check('teacher 2 sees Class 2-A homework, not Class 1-A', v.includes(hwC2) && v.includes(hwT2) && !v.includes(hwId));
[sv, v] = await ids(tokS);
check('student (1-A) sees only Class 1-A homework', sv === 200 && v.includes(hwId) && !v.includes(hwC2) && !v.includes(hwT2));
[sv, v] = await ids(tokS2);
check('student (2-A) sees only Class 2-A homework', v.includes(hwC2) && v.includes(hwT2) && !v.includes(hwId));
[sv, v] = await ids(tokP);
check('parent sees only the child class homework', v.includes(hwId) && !v.includes(hwC2));
[sv, v] = await ids(adminTok);
check('admin sees all', v.includes(hwId) && v.includes(hwC2) && v.includes(hwT2));
const [, studentList] = await call('GET', '/api/homework', tokS);
check('student view carries no canManage flag', studentList.every((x) => x.canManage === undefined));
const [, tList] = await call('GET', '/api/homework', tok1);
check('teacher list marks own items manageable', tList.find((x) => x.id === hwId)?.canManage === true);
check('instructions field present on every item', tList.every((x) => typeof x.instructions === 'string'));
const [fs, fb] = await call('GET', `/api/homework?classId=c-1&section=A`, adminTok);
check('filters work (class+section)', fs === 200 && fb.every((x) => x.classId === 'c-1' && x.section === 'A') && fb.length >= 2);

// ---- edit
r = await call('PUT', `/api/homework/${hwId}`, tok1, { title: `Hindi poem EDITED ${stamp}`, dueDate: plus(4), instructions: 'Learn five lines.' });
check('teacher edits own homework', r[0] === 200 && r[1].title.includes('EDITED') && r[1].dueDate === plus(4) && r[1].instructions === 'Learn five lines.' && r[1].classId === 'c-1', `${r[0]} ${r[1].error || ''}`);
check('edit does not change the owner', r[1].teacherName === t1.name);
r = await call('PUT', `/api/homework/${hwId}`, tok2, { title: 'hijack' }); check('other teacher cannot edit it', r[0] === 403, `${r[0]}`);
r = await call('PUT', `/api/homework/${hwC2}`, tok2, { title: 'edit admin item' }); check('teacher cannot edit another person\'s homework even in own class', r[0] === 403, `${r[0]}`);
r = await call('PUT', `/api/homework/${hwId}`, tok1, { classId: 'c-2' }); check('teacher cannot move homework to an unassigned class', r[0] === 403, `${r[0]}`);
r = await call('PUT', `/api/homework/${hwId}`, tokS, { title: 'x' }); check('student cannot edit', r[0] === 403);
r = await call('PUT', `/api/homework/${hwId}`, tokP, { title: 'x' }); check('parent cannot edit', r[0] === 403);
r = await call('PUT', `/api/homework/${hwId}`, tok1, { dueDate: plus(-30) }); check('edit: due before assigned -> 400', r[0] === 400, r[1].error);
r = await call('PUT', `/api/homework/nope`, tok1, { title: 'abc' }); check('edit unknown id -> 404', r[0] === 404);
r = await call('PUT', `/api/homework/${hwFileId}`, tok1, { title: `With file EDITED ${stamp}` });
check('edit without attachment fields keeps the attachment (mobile edit)', r[0] === 200 && r[1].attachmentFileKey === 'school/homework/test-file.pdf' && r[1].attachmentName === 'worksheet.pdf', JSON.stringify(r[1]).slice(0, 160));
r = await call('PUT', `/api/homework/${hwFileId}`, tok1, { attachmentFileKey: '' });
check('empty attachmentFileKey removes the attachment', r[0] === 200 && !r[1].attachmentFileKey && !r[1].attachmentName);
r = await call('PUT', `/api/homework/${hwC2}`, adminTok, { title: `English essay EDITED ${stamp}` }); check('admin can edit any homework', r[0] === 200);

// ---- persistence (survives a reload from storage)
const [, afterEdit] = await call('GET', '/api/homework', tokS);
check('student sees the edited title and date', afterEdit.find((x) => x.id === hwId)?.title.includes('EDITED') && afterEdit.find((x) => x.id === hwId)?.dueDate === plus(4));

// ---- delete
r = await call('DELETE', `/api/homework/${hwId}`, tok2); check('other teacher cannot delete', r[0] === 403);
r = await call('DELETE', `/api/homework/${hwId}`, tokS); check('student cannot delete', r[0] === 403);
r = await call('DELETE', `/api/homework/${hwId}`, null); check('no token cannot delete', r[0] === 401);
r = await call('DELETE', `/api/homework/${hwId}`, tok1); check('owner deletes', r[0] === 200);
r = await call('DELETE', `/api/homework/${hwId}`, tok1); check('second delete -> 404', r[0] === 404);
for (const id of [hwFileId, hwC2, hwT2]) await call('DELETE', `/api/homework/${id}`, adminTok);
[sv, v] = await ids(tokS);
check('student no longer sees deleted homework', !v.includes(hwId));


// ---- persistence in MongoDB
const pr = await fetch(`${B}/api/homework`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ classId: 'c-8', section: 'A', subjectId: 's-3', title: 'Persist check', instructions: 'Read chapter 2.', dueDate: today, attachmentFileKey: 'school/homework/p.pdf', attachmentName: 'p.pdf', attachmentSize: 10 }) });
const hwp = await pr.json();
const col = mongo.db('pds_school_erp').collection('homework');
await new Promise((x) => setTimeout(x, 800));
let doc = await col.findOne({ id: hwp.id });
check('created homework is stored in MongoDB', !!doc);
check('Mongo doc keeps instructions, subjectId, teacher, attachment', doc?.instructions === 'Read chapter 2.' && doc?.subjectId === 's-3' && !!doc?.teacherId && doc?.attachmentFileKey === 'school/homework/p.pdf' && doc?.attachmentSize === 10, JSON.stringify(doc).slice(0, 300));
await fetch(`${B}/api/homework/${hwp.id}`, { method: 'PUT', headers: H(adminTok), body: JSON.stringify({ attachmentFileKey: '' }) });
await new Promise((x) => setTimeout(x, 800));
doc = await col.findOne({ id: hwp.id });
check('removing the attachment also clears it in MongoDB', doc && !doc.attachmentFileKey && !doc.attachmentName, JSON.stringify(doc).slice(0, 200));
await fetch(`${B}/api/homework/${hwp.id}`, { method: 'DELETE', headers: H(adminTok) });
doc = await col.findOne({ id: hwp.id });
check('deleted homework is removed from MongoDB', !doc);


await mongo.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
