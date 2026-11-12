/**
 * Subject CRUD/protection, timetable conflict + permission + period-timing checks against a RUNNING LOCAL server.
 * Usage (repo root, .env loaded): set -a; . ./.env; set +a; node scripts/verify-academic-timetable-api.mjs
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BASE_URL || 'http://localhost:3000')) { console.error('Refusing to run: BASE_URL must be localhost.'); process.exit(2); }
import jwt from 'jsonwebtoken';
const B = process.env.BASE_URL || 'http://localhost:3000';
const sign = (p) => jwt.sign({ iat: Math.floor(Date.now() / 1000), ...p }, process.env.JWT_SECRET, { expiresIn: '1h' });
const admin = sign({ userId: 'ui-setup', role: 'SUPER_ADMIN' });
const teacher = sign({ userId: 'nobody', role: 'TEACHER' });
const H = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const call = async (m, p, t, body) => { const r = await fetch(B + p, { method: m, headers: H(t), body: body ? JSON.stringify(body) : undefined }); const x = await r.text(); let j; try { j = JSON.parse(x); } catch { j = { raw: x.slice(0, 80) }; } return [r.status, j]; };
const tag = String(Date.now() % 100000);

// ---------- Subjects
const sub = { name: `Zz Subject ${tag}`, code: `ZZ-${tag}`, type: 'CORE', maxMarks: 100, passMarks: 33, theoryMarks: 80, practicalMarks: 20, credits: 2, status: 'ACTIVE', classIds: [], academicSession: '2026-2027' };
let [s, b] = await call('POST', '/api/subjects', admin, sub);
check('create subject', s === 201 && b.id, `${s} ${b.error || ''}`);
const id = b.id;
[s, b] = await call('POST', '/api/subjects', admin, { ...sub, name: 'Dup' });
check('duplicate subject code rejected', s === 400, `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/subjects', admin, { ...sub, code: `ZY-${tag}`, theoryMarks: 50, practicalMarks: 20 });
check('theory+practical must equal max', s === 400, `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/subjects', teacher, { ...sub, code: `ZX-${tag}` });
check('teacher cannot create subjects', s === 403, String(s));
[s, b] = await call('PUT', `/api/subjects/${id}`, admin, { name: `Zz Edited ${tag}`, passMarks: 35 });
check('edit subject keeps other fields', s === 200 && b.name.includes('Edited') && b.passMarks === 35 && b.code === `ZZ-${tag}`, `${s} ${b.error || ''}`);
[s, b] = await call('PUT', `/api/subjects/${id}`, admin, { status: 'INACTIVE' });
check('deactivate subject', s === 200 && b.status === 'INACTIVE', `${s}`);
[s, b] = await call('PUT', `/api/subjects/${id}`, admin, { status: 'ACTIVE' });
check('reactivate subject', s === 200 && b.status === 'ACTIVE', `${s}`);

// ---------- Timetable
const [, classes] = await call('GET', '/api/classes', admin);
const cls = (Array.isArray(classes) ? classes : classes.classes || []).find((c) => c.id === 'c-1') || classes[0];
const classId = cls.id, className = cls.name;
const slotBase = { classId, className, section: 'A', subjectId: id, subjectName: `Zz Edited ${tag}`, teacherId: `t-zz-${tag}`, teacherName: 'Zz Teacher', dayOfWeek: 'Sunday', periodNumber: 7, startTime: '01:00 PM', endTime: '01:45 PM', roomNumber: '101', academicSession: '2026-2027' };
[s, b] = await call('POST', '/api/timetables', teacher, slotBase);
check('teacher cannot create timetable slots', s === 403, String(s));
[s, b] = await call('POST', '/api/timetables', admin, slotBase);
check('admin creates a slot', s === 201 && b.id, `${s} ${b.error || b.message || ''}`);
const slotId = b.id;
[s, b] = await call('POST', '/api/timetables', admin, { ...slotBase, teacherId: `t-zz2-${tag}`, subjectName: 'Other' });
check('second slot in same class-section cell is rejected', s === 409 && b.error === 'INTRA_CLASS_CONFLICT', `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/timetables', admin, { ...slotBase, section: 'B' });
check('same teacher in another section at that time is rejected', s === 409 && b.error === 'TIMETABLE_CONFLICT', `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/timetables', admin, { ...slotBase, section: 'B', teacherId: `t-zz3-${tag}`, periodNumber: 8 });
check('different teacher/period slot is accepted', s === 201, `${s} ${b.error || b.message || ''}`);
const slot2 = b.id;
[s, b] = await call('PUT', `/api/timetables/${slot2}`, admin, { periodNumber: 7, teacherId: slotBase.teacherId });
check('editing a slot into a teacher clash is rejected', s === 409, `${s} ${b.error || ''}`);
[s, b] = await call('PUT', `/api/timetables/${slot2}`, admin, { roomNumber: '202' });
check('editing a slot room works', s === 200 && b.roomNumber === '202', `${s}`);

// ---------- Subject protection
[s, b] = await call('DELETE', `/api/subjects/${id}`, admin);
check('subject used by timetable cannot be deleted', s === 409 && /timetable/i.test(b.error || ''), `${s} ${b.error || ''}`);
[s] = await call('DELETE', `/api/timetables/${slotId}`, teacher);
check('teacher cannot delete slots', s === 403, String(s));
[s] = await call('DELETE', `/api/timetables/${slotId}`, admin); const d1 = s;
[s] = await call('DELETE', `/api/timetables/${slot2}`, admin);
check('admin deletes slots', d1 === 200 && s === 200, `${d1}/${s}`);
[s, b] = await call('GET', `/api/timetables?classId=${classId}`, admin);
check('deleted slots do not come back on reload', Array.isArray(b) && !b.some((t) => t.id === slotId || t.id === slot2), `${s}`);
[s, b] = await call('DELETE', `/api/subjects/${id}`, admin);
check('unused subject can be deleted', s === 200, `${s} ${b.error || ''}`);
[s] = await call('GET', `/api/subjects/${id}`, admin);
check('deleted subject is gone', s === 404, String(s));

// ---------- Period timings
const [, cfg] = await call('GET', '/api/timetables/config', admin);
const periods = cfg.periods;
[s, b] = await call('POST', '/api/timetables/config', teacher, { periods });
check('teacher cannot change period timings', s === 403, String(s));
[s, b] = await call('POST', '/api/timetables/config', admin, { periods: [{ periodNumber: 1, name: 'P1', startTime: '09:00 AM', endTime: '08:00 AM' }] });
check('period ending before it starts is rejected', s === 400, `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/timetables/config', admin, { periods: [{ periodNumber: 1, name: 'P1', startTime: '08:00 AM', endTime: '09:00 AM' }, { periodNumber: 2, name: 'P2', startTime: '08:30 AM', endTime: '09:30 AM' }] });
check('overlapping periods are rejected', s === 400 && /overlap/i.test(b.error || ''), `${s} ${b.error || ''}`);
[s, b] = await call('POST', '/api/timetables/config', admin, { periods });
check('valid existing periods are accepted unchanged', s === 200, `${s} ${b.error || ''}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
