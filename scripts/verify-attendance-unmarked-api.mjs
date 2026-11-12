/**
 * Attendance API checks against a RUNNING local server (default http://localhost:3000): staff and
 * student registers must never save an unmarked entry as Present, and a submission with nothing
 * marked is refused. Writes attendance rows for 16-17 Oct 2026 in the local database, so it refuses
 * to run against anything but localhost.
 *
 * Usage (repo root, .env loaded):  set -a; . ./.env; set +a; node scripts/verify-attendance-unmarked-api.mjs
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BASE_URL || 'http://localhost:3000')) {
  console.error('Refusing to run: BASE_URL must be localhost.');
  process.exit(2);
}
import jwt from 'jsonwebtoken';
const B = process.env.BASE_URL || 'http://localhost:3000';
const tok = jwt.sign({ userId: 'ui-setup', role: 'SUPER_ADMIN', iat: Math.floor(Date.now()/1000) }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200) }; } };
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: H, body: JSON.stringify(b) }); return [r.status, await j(r)]; };

// ---- staff attendance
const staff = (await j(await fetch(`${B}/api/teachers`, { headers: H }))); const list = (staff.staff || staff).filter((s) => s.status === 'ACTIVE').slice(0, 4);
const date = '2026-10-17';
const rec = (s, status) => ({ staffId: s.id, employeeId: s.employeeId, staffName: s.name, status });
let [st, b] = await post('/api/staff-attendance', { date, records: [rec(list[0], 'PRESENT'), rec(list[1], 'ABSENT'), rec(list[2], 'NOT_MARKED'), rec(list[3], undefined)] });
check('staff: only the 2 explicitly marked records are saved', st === 200 && b.count === 2 && b.records.map((r) => r.status).sort().join() === 'ABSENT,PRESENT', `${st} ${JSON.stringify(b).slice(0, 120)}`);
const TIME = /^\d{2}:\d{2} (AM|PM)$/;
check('staff: a manually marked Present gets a check-in time, an Absent gets none', TIME.test(b.records.find((r) => r.status === 'PRESENT')?.checkInTime || '') && !b.records.find((r) => r.status === 'ABSENT')?.checkInTime, JSON.stringify(b.records.map((r) => [r.status, r.checkInTime])));
const staffTime = b.records.find((r) => r.status === 'PRESENT')?.checkInTime;
const got = await j(await fetch(`${B}/api/staff-attendance?date=${date}`, { headers: H }));
const rows = got.records || got;
check('staff: unmarked staff have NO record for that day (no default Present)', Array.isArray(rows) && rows.filter((r) => r.date === date).length === 2);
let [stS, bS] = await post('/api/staff-attendance', { date, records: [rec(list[0], 'PRESENT'), rec(list[1], 'LATE')] });
check('staff: saving the same Present again keeps its time; a new Late gets one', stS === 200 && bS.records.find((r) => r.status === 'PRESENT')?.checkInTime === staffTime && TIME.test(bS.records.find((r) => r.status === 'LATE')?.checkInTime || ''), JSON.stringify(bS.records?.map((r) => [r.status, r.checkInTime])));
[stS, bS] = await post('/api/staff-attendance', { date, records: [{ ...rec(list[0], 'PRESENT'), checkInTime: '08:05 AM' }] });
check('staff: a time sent by the app is kept as given', bS.records?.[0]?.checkInTime === '08:05 AM');
[st, b] = await post('/api/staff-attendance', { date, records: [rec(list[2], 'NOT_MARKED'), rec(list[3], '')] });
check('staff: a submission with nothing marked is refused', st === 400, `${st} ${b.error}`);
[st, b] = await post('/api/staff-attendance', { date, records: [rec(list[0], 'present')] });
check('staff: lower-case status is normalised, not defaulted', st === 200 && b.records[0].status === 'PRESENT');
const [st403] = await (async () => { const r = await fetch(B + '/api/staff-attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return [r.status]; })();
check('staff: no token -> 401', st403 === 401);
await post('/api/staff-attendance', { date, records: [] });

// ---- student attendance
const students = (await j(await fetch(`${B}/api/students?limit=2000`, { headers: H })));
const sl = (Array.isArray(students) ? students : students.students || students.data || students.items || []).filter((s) => s.classId === 'c-1' && (s.section || 'A') === 'A' && s.status === 'ACTIVE').slice(0, 3);
const sdate = '2026-10-16';
const srec = (s, status) => ({ studentId: s.id, studentName: s.name, rollNumber: s.rollNumber, status });
[st, b] = await post('/api/attendance', { classId: 'c-1', section: 'A', date: sdate, records: [srec(sl[0], 'PRESENT'), srec(sl[1], 'NOT_MARKED'), srec(sl[2], undefined)] });
check('students: only the explicitly marked student is saved', st === 200 && b.count === 1 && b.records[0].studentId === sl[0].id && b.records[0].status === 'PRESENT', `${st} ${JSON.stringify(b).slice(0, 140)}`);
check('students: Present gets a check-in time', TIME.test(b.records[0].checkInTime || ''), JSON.stringify(b.records[0].checkInTime));
const stuTime = b.records[0].checkInTime;
[st, b] = await post('/api/attendance', { classId: 'c-1', section: 'A', date: sdate, records: [srec(sl[0], 'PRESENT'), srec(sl[1], 'ABSENT')] });
check('students: saving the class again keeps the earlier time; Absent has none', st === 200 && b.records.find((r) => r.studentId === sl[0].id)?.checkInTime === stuTime && !b.records.find((r) => r.studentId === sl[1].id)?.checkInTime, JSON.stringify(b.records?.map((r) => [r.status, r.checkInTime])));
[st, b] = await post('/api/attendance', { classId: 'c-1', section: 'A', date: sdate, records: [srec(sl[1], 'NOT_MARKED')] });
check('students: submission with nothing marked is refused', st === 400, `${st} ${b.error}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
