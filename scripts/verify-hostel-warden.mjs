/**
 * Support staff (no app login) + Hostel Warden portal, against a RUNNING local server
 * (JSON dev data, no MongoDB needed):
 *   env -u MONGODB_URI NODE_ENV=production npx tsx server.ts      then      node scripts/verify-hostel-warden.mjs
 * It creates test staff, night attendance, alerts, a mess menu and a student leave. Restore the data afterwards:
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
const short = (r) => `${r.s} ${JSON.stringify(r.j).slice(0, 220)}`;
const stamp = String(Date.now()).slice(-5);
const india = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
const TODAY = india();

const mkStaff = async (label, phoneTail, extra) => {
  const r = await call('POST', '/api/staff', ADMIN, {
    name: `${label} ${stamp}`, phone: `97${stamp}${phoneTail}`, joiningDate: '2026-04-01', monthlySalary: 1, gender: 'MALE', dob: '1985-01-01', ...extra,
  });
  return { r, staff: r.j?.staff || r.j?.data || r.j };
};
const sign = (staff, role) => jwt.sign({ userId: staff.id, role }, S, { expiresIn: '30m' });

// =================================================================================================
// A. Support staff: an ID and attendance record, never a login
// =================================================================================================
const { r: drvRes, staff: driver } = await mkStaff('Driver Test', '201', { portalRole: 'SUPPORT_STAFF', designation: 'Driver', department: 'Support Services', loginEnabled: true, initialPassword: 'Try@12345' });
check('Support staff (Driver) is registered', drvRes.s === 200 || drvRes.s === 201, short(drvRes));
check('…with an Employee ID and role SUPPORT_STAFF', !!driver?.employeeId && driver?.portalRole === 'SUPPORT_STAFF' && driver?.designation === 'Driver', JSON.stringify({ e: driver?.employeeId, r: driver?.portalRole, d: driver?.designation }));
check('…and login switched off even though the form asked for it', driver?.loginEnabled === false, String(driver?.loginEnabled));
let r = await call('GET', '/api/auth/me', sign(driver, 'SUPPORT_STAFF'));
check('A session for support staff is refused', r.s === 401 || r.s === 403, short(r));
r = await call('PUT', `/api/staff/${driver.id}`, ADMIN, { loginEnabled: true, designation: 'Driver' });
const afterEdit = (await call('GET', `/api/staff/${driver.id}`, ADMIN)).j;
check('Editing cannot switch login on for support staff', (afterEdit?.data || afterEdit?.staff || afterEdit)?.loginEnabled === false, short(r));
r = await call('PATCH', `/api/teachers/${driver.id}/portal-status`, ADMIN, { loginEnabled: true });
const afterPortal = (await call('GET', `/api/staff/${driver.id}`, ADMIN)).j;
check('Portal access toggle cannot switch it on either', (afterPortal?.data || afterPortal?.staff || afterPortal)?.loginEnabled === false, short(r));
r = await call('GET', '/api/staff', ADMIN);
const staffList = Array.isArray(r.j) ? r.j : r.j?.data || [];
check('Support staff appears in the staff directory', staffList.some((s) => s.id === driver.id));
const attDate = '2026-03-02';
r = await call('POST', '/api/staff-attendance', ADMIN, { date: attDate, records: [{ staffId: driver.id, employeeId: driver.employeeId, status: 'PRESENT' }] });
check('Staff attendance can be marked for support staff', r.s === 200 || r.s === 201, short(r));
r = await call('GET', `/api/staff-attendance?date=${attDate}&staffId=${driver.id}`, ADMIN);
check('…and is saved against their record', Array.isArray(r.j) && r.j.some((a) => a.staffId === driver.id && a.status === 'PRESENT'), short(r));

// =================================================================================================
// B. Hostel warden portal
// =================================================================================================
const hostels = (await call('GET', '/api/hostels', ADMIN)).j;
const allocs = (hostels.allocations || []).filter((a) => a.status === 'ACTIVE');
const students = read('students.json');
const withResidents = hostels.hostels.filter((h) => allocs.some((a) => a.hostelId === h.id && students.some((s) => s.id === a.studentId)));
if (withResidents.length < 1) { console.error('Need a hostel with an active resident in the dev data.'); process.exit(2); }
const MY = withResidents[0];
const OTHER = hostels.hostels.find((h) => h.id !== MY.id);
const myIds = allocs.filter((a) => a.hostelId === MY.id && students.some((s) => s.id === a.studentId)).map((a) => a.studentId);
const outsider = students.find((s) => !allocs.some((a) => a.studentId === s.id && a.hostelId === MY.id));

const { staff: warden } = await mkStaff('Warden Test', '202', { portalRole: 'HOSTEL_WARDEN', designation: 'Hostel Warden', department: 'Hostel Administration', hostelAssignment: { hostelId: MY.id, hostelName: MY.name } });
check('Hostel warden registered with a hostel assignment', warden?.hostelAssignment?.hostelId === MY.id, JSON.stringify(warden?.hostelAssignment));
const W = sign(warden, 'HOSTEL_WARDEN');
const { staff: teacher } = await mkStaff('Teacher Test', '203', { portalRole: 'TEACHER', designation: 'TGT Teacher', department: 'ACADEMICS', subjectExpertise: ['Mathematics'], qualifiedClasses: ['Class 6'] });
const TCH = sign(teacher, 'TEACHER');

// --- access ---
r = await call('GET', '/api/hostel-warden/me', W);
check('Warden: /me lists only their own hostel', r.s === 200 && r.j.hostels.length === 1 && r.j.hostels[0].id === MY.id, short(r));
check('Warden cannot approve leave (forward only); can manage mess', r.j?.permissions?.approveLeave === false && r.j?.permissions?.forwardLeave === true && r.j?.permissions?.manageMess === true, JSON.stringify(r.j?.permissions));
r = await call('GET', '/api/hostel-warden/dashboard', TCH);
check('Teacher is refused the warden portal (403)', r.s === 403, short(r));
r = await call('GET', '/api/hostel-warden/dashboard', null);
check('No sign-in is refused (401)', r.s === 401, short(r));
if (OTHER) {
  r = await call('GET', `/api/hostel-warden/students?hostelId=${OTHER.id}`, W);
  check('Warden asking for another hostel is refused (403)', r.s === 403, short(r));
}
r = await call('GET', '/api/hostel-warden/me', ADMIN);
check('Super Admin sees every hostel', r.s === 200 && r.j.hostels.length === hostels.hostels.length, short(r));

// --- the warden's own record wins over another staff member with the same (school) email ---
const sharedEmail = `office${stamp}@cps.test`;
await call('PUT', `/api/staff/${warden.id}`, ADMIN, { email: sharedEmail, hostelAssignment: { hostelId: MY.id, hostelName: MY.name }, hostelId: MY.id });
const { staff: vp } = await mkStaff('Vice Principal Test', '204', { portalRole: 'VICE_PRINCIPAL', designation: 'Vice Principal', department: 'Senior Wing', email: sharedEmail });
check('A Vice Principal with the same email is registered after the warden', !!vp?.id);
const Wfresh = jwt.sign({ userId: warden.id, role: 'HOSTEL_WARDEN', fresh: 1 }, S, { expiresIn: '29m' }); // a new sign-in (no cached session)
r = await call('GET', '/api/hostel-warden/me', Wfresh);
check('Warden still resolves to their OWN record (their hostel, not the Vice Principal\'s none)', r.s === 200 && r.j.hostels.length === 1 && r.j.hostels[0].id === MY.id, short(r));
r = await call('GET', '/api/auth/me', Wfresh);
check('/api/auth/me for the warden shows the warden, not the Vice Principal', (r.j?.user || r.j)?.name === warden.name, short(r));

// --- hostel chosen later through Edit staff ---
const { staff: w2 } = await mkStaff('Warden Two', '205', { portalRole: 'HOSTEL_WARDEN', designation: 'Hostel Warden', department: 'Hostel Administration' });
const W2 = sign(w2, 'HOSTEL_WARDEN');
r = await call('GET', '/api/hostel-warden/students', W2);
check('A warden without a hostel sees no students (and is told why in the app)', r.s === 200 && r.j.data.length === 0, short(r));
r = await call('PUT', `/api/staff/${w2.id}`, ADMIN, { hostelId: MY.id, hostelAssignment: { hostelId: MY.id, hostelName: MY.name } });
r = await call('GET', '/api/hostel-warden/students', W2);
check('After choosing the hostel in Edit staff the warden sees its students', r.s === 200 && r.j.data.length === myIds.length, short(r));

// --- hostel that names the warden (Hostel module warden name) ---
const { staff: w3 } = await mkStaff('Named Warden', '206', { portalRole: 'HOSTEL_WARDEN', designation: 'Hostel Warden', department: 'Hostel Administration' });
const hostelBefore = { ...MY };
r = await call('PUT', `/api/hostels/${MY.id}`, ADMIN, { ...MY, wardenName: w3.name, wardenPhone: '9123400000' });
const r3 = await call('GET', '/api/hostel-warden/me', sign(w3, 'HOSTEL_WARDEN'));
check('A warden named on the hostel record (Hostel module) gets that hostel without a staff-form assignment', r.s === 200 && r3.s === 200 && r3.j.hostels.some((h) => h.id === MY.id), `${r.s} ${short(r3)}`);
await call('PUT', `/api/hostels/${MY.id}`, ADMIN, hostelBefore);

// --- accounts / HR do not run the hostel ---
const { staff: acc } = await mkStaff('Accountant Test', '207', { portalRole: 'ACCOUNTANT', designation: 'Accountant', department: 'Accounts & Finance' });
r = await call('GET', '/api/hostel-warden/dashboard', sign(acc, 'ACCOUNTANT'));
check('Accountant is refused the warden portal (403)', r.s === 403, short(r));

// --- students ---
r = await call('GET', '/api/hostel-warden/students', W);
check('Students: only residents of the warden\'s hostel', r.s === 200 && r.j.data.length === myIds.length && r.j.data.every((s) => myIds.includes(s.id) && s.hostelId === MY.id), short(r));
check('…with room, bed, admission no. and class', r.j.data.every((s) => s.roomNumber && s.bedNumber && s.admissionNumber && s.className));
const first = r.j.data[0];
r = await call('GET', `/api/hostel-warden/students?search=${encodeURIComponent(first.name.slice(0, 4))}`, W);
check('Search by name works', r.s === 200 && r.j.data.some((s) => s.id === first.id), short(r));
r = await call('GET', `/api/hostel-warden/students?classId=${encodeURIComponent(first.classId)}`, W);
check('Class filter works', r.s === 200 && r.j.data.every((s) => s.classId === first.classId), short(r));
r = await call('GET', `/api/hostel-warden/students/${first.id}`, W);
check('Profile opens with parent contact and emergency block', r.s === 200 && 'parent' in r.j.data && 'emergency' in r.j.data, short(r));
r = await call('GET', `/api/hostel-warden/students/${outsider.id}`, W);
check('Profile of a student from elsewhere: 404', r.s === 404, short(r));

// --- night attendance ---
const schoolAttBefore = fs.readFileSync(new URL('../data/attendance.json', import.meta.url), 'utf8');
r = await call('GET', '/api/hostel-warden/attendance', W);
check('Roll-call sheet lists every resident, none marked yet', r.s === 200 && r.j.rows.length === myIds.length && r.j.submitted === false, short(r));
const entries = myIds.map((id, i) => ({ studentId: id, status: i === 0 ? 'ABSENT' : 'PRESENT' }));
r = await call('POST', '/api/hostel-warden/attendance', W, { date: TODAY, entries: [...entries, { studentId: outsider.id, status: 'PRESENT' }] });
check('A student from another hostel in the list is refused (400)', r.s === 400, short(r));
r = await call('POST', '/api/hostel-warden/attendance', W, { date: TODAY, entries: [{ studentId: myIds[0], status: 'SLEEPING' }] });
check('An unknown status is refused (400)', r.s === 400, short(r));
r = await call('POST', '/api/hostel-warden/attendance', W, { date: TODAY, entries });
check('Night attendance saved (201)', r.s === 201 && r.j.saved === myIds.length, short(r));
check('…one absent student raised one alert', r.j?.alertsRaised === 1, short(r));
r = await call('POST', '/api/hostel-warden/attendance', W, { date: TODAY, entries });
check('Submitting the same night again is refused as a duplicate (409)', r.s === 409 && r.j.code === 'ALREADY_MARKED', short(r));
const [dupA, dupB] = await Promise.all([
  call('POST', '/api/hostel-warden/attendance', ADMIN, { date: india(-1), entries }),
  call('POST', '/api/hostel-warden/attendance', ADMIN, { date: india(-1), entries }),
]);
check('Two phones submitting at once: one saves, one is refused', [dupA.s, dupB.s].sort().join() === '201,409', `${dupA.s} ${dupB.s}`);
const schoolAttAfter = fs.readFileSync(new URL('../data/attendance.json', import.meta.url), 'utf8');
check('School (classroom) attendance is untouched', schoolAttBefore === schoolAttAfter);
r = await call('GET', '/api/hostel-warden/attendance', W);
check('Sheet now shows the saved statuses', r.j.submitted === true && r.j.rows.every((x) => x.record), short(r));
const absentRec = r.j.rows.find((x) => x.id === myIds[0]).record;

r = await call('GET', '/api/hostel-warden/dashboard', W);
check('Dashboard: totals from saved data', r.s === 200 && r.j.stats.totalStudents === myIds.length && r.j.stats.absent === 1 && r.j.stats.present === myIds.length - 1, JSON.stringify(r.j?.stats));
check('Dashboard: the absent alert is open', r.j.stats.openAlerts >= 1 && r.j.alerts.some((a) => a.type === 'ABSENT_AT_NIGHT' && a.studentId === myIds[0]));
check('Dashboard: today\'s activity shows the roll-call', r.j.activities.some((x) => x.kind === 'ATTENDANCE'), JSON.stringify(r.j.activities).slice(0, 200));

// --- corrections ---
r = await call('PUT', `/api/hostel-warden/attendance/${absentRec.id}`, W, { status: 'PRESENT' });
check('Correction without a reason is refused (400)', r.s === 400, short(r));
r = await call('PUT', `/api/hostel-warden/attendance/${absentRec.id}`, TCH, { status: 'PRESENT', reason: 'x' });
check('Teacher cannot correct (403)', r.s === 403, short(r));
r = await call('PUT', `/api/hostel-warden/attendance/${absentRec.id}`, W, { status: 'PRESENT', reason: 'Came back at 9:40 pm, was in the common room' });
check('Warden corrects with a reason', r.s === 200 && r.j.record.status === 'PRESENT' && r.j.record.corrected === true && r.j.record.history.length === 2, short(r));
r = await call('GET', '/api/hostel-warden/alerts?status=OPEN', W);
check('The absent alert closed itself after the correction', !r.j.data.some((a) => a.type === 'ABSENT_AT_NIGHT' && a.studentId === myIds[0] && a.date === TODAY), short(r));
r = await call('GET', '/api/audit-logs?limit=50', ADMIN);
const logs = Array.isArray(r.j) ? r.j : r.j?.data || r.j?.logs || [];
check('Correction is in the audit log', JSON.stringify(logs).includes('HOSTEL_NIGHT_ATTENDANCE_CORRECTED'), short(r));

const old = india(-6);
r = await call('POST', '/api/hostel-warden/attendance', W, { date: old, entries });
check('Warden cannot mark a night older than 2 days (403)', r.s === 403, short(r));
r = await call('POST', '/api/hostel-warden/attendance', ADMIN, { date: old, entries });
check('Principal/admin can record an old night', r.s === 201, short(r));
const oldRec = (await call('GET', `/api/hostel-warden/attendance?date=${old}`, ADMIN)).j.rows[0].record;
r = await call('PUT', `/api/hostel-warden/attendance/${oldRec.id}`, W, { status: 'OUTSIDE', reason: 'Late correction' });
check('…and the warden cannot correct it (403)', r.s === 403, short(r));
r = await call('POST', '/api/hostel-warden/attendance', W, { date: india(2), entries });
check('A future night is refused', r.s === 403 || r.s === 400, short(r));

// --- history & reports ---
r = await call('GET', `/api/hostel-warden/attendance/history?studentId=${myIds[0]}`, W);
check('History for one student, newest first', r.s === 200 && r.j.data.length >= 2 && r.j.data[0].date >= r.j.data[1].date, short(r));
r = await call('GET', `/api/hostel-warden/attendance/history?studentId=${outsider.id}`, W);
check('History of an outsider is refused (404)', r.s === 404, short(r));
r = await call('GET', `/api/hostel-warden/attendance/report?type=daily&date=${TODAY}`, W);
check('Daily report', r.s === 200 && r.j.counts.total === myIds.length && r.j.counts.present === myIds.length, short(r));
r = await call('GET', `/api/hostel-warden/attendance/report?type=monthly&month=${TODAY.slice(0, 7)}`, W);
check('Monthly report with per-student totals', r.s === 200 && r.j.perStudent.length === myIds.length && r.j.nightsTaken >= 1, short(r));

// --- emergency alerts ---
r = await call('POST', '/api/hostel-warden/alerts', W, { message: 'x' });
check('Emergency without a description is refused', r.s === 400, short(r));
r = await call('POST', '/api/hostel-warden/alerts', W, { message: 'High fever, taken to the sick room', studentId: myIds[0] });
check('Warden raises an emergency alert', r.s === 201 && r.j.alert.type === 'EMERGENCY', short(r));
const emId = r.j?.alert?.id;
r = await call('GET', '/api/hostel-warden/dashboard', W);
check('Dashboard counts the emergency', r.j.stats.emergencyAlerts === 1, JSON.stringify(r.j.stats));
r = await call('PUT', `/api/hostel-warden/alerts/${emId}/resolve`, W, { resolution: 'Doctor visited, stable' });
check('Emergency resolved', r.s === 200 && r.j.alert.status === 'RESOLVED', short(r));

// --- mess menu ---
r = await call('PUT', '/api/hostel-warden/mess', W, { date: TODAY, meals: [{ meal: 'SNACK', items: ['Tea'] }] });
check('Mess: unknown meal refused', r.s === 400, short(r));
const meals = [
  { meal: 'BREAKFAST', time: '7:30 AM – 8:15 AM', items: ['Poha', 'Milk', 'Banana'] },
  { meal: 'LUNCH', time: '1:00 PM – 1:45 PM', items: 'Rice, Dal, Aloo Gobhi, Salad' },
  { meal: 'DINNER', time: '8:00 PM – 8:45 PM', items: ['Roti', 'Paneer', 'Kheer'] },
];
r = await call('PUT', '/api/hostel-warden/mess', W, { date: TODAY, meals, notice: 'Special kheer on Sunday' });
check('Warden saves today\'s menu', r.s === 200 && r.j.menu.meals.length === 3 && r.j.menu.meals[1].items.length === 4, short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${TODAY}`, W);
check('Menu reads back for today', r.s === 200 && r.j.data[0].menu?.meals?.[0]?.items?.includes('Poha') && !r.j.data[0].carriedFrom, short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${india(1)}`, W);
check('Tomorrow without a menu shows today\'s, labelled', r.s === 200 && r.j.data[0].carriedFrom === TODAY, short(r));
r = await call('PUT', '/api/hostel-warden/mess', W, { date: india(3), meals });
r = await call('DELETE', `/api/hostel-warden/mess?date=${india(3)}`, TCH);
check('Teacher cannot delete a menu (403)', r.s === 403, short(r));
r = await call('DELETE', `/api/hostel-warden/mess?date=${india(3)}`, W);
check('Warden deletes a day\'s menu', r.s === 200, short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${india(3)}`, W);
check('…that day falls back to the latest earlier menu, labelled', r.j.data[0].carriedFrom === TODAY, short(r));
r = await call('DELETE', `/api/hostel-warden/mess?date=${india(3)}`, W);
check('Deleting again: 404', r.s === 404, short(r));
r = await call('PUT', '/api/hostel-warden/mess', TCH, { date: TODAY, meals });
check('Teacher cannot change the menu (403)', r.s === 403, short(r));
if (OTHER) {
  r = await call('PUT', '/api/hostel-warden/mess', W, { hostelId: OTHER.id, date: TODAY, meals });
  check('Warden cannot change another hostel\'s menu (403)', r.s === 403, short(r));
}

// --- weekly menu: set once, repeats every week; a special menu wins on its date ---
const weekdayOf = (iso) => { const g = new Date(`${iso}T00:00:00Z`).getUTCDay(); return g === 0 ? 7 : g; };
const in7 = india(7), in8 = india(8);
r = await call('PUT', '/api/hostel-warden/mess/weekly', W, { weekday: 9, meals });
check('Weekly: an invalid weekday is refused', r.s === 400, short(r));
r = await call('PUT', '/api/hostel-warden/mess/weekly', TCH, { weekday: weekdayOf(in7), meals });
check('Weekly: teacher cannot set it (403)', r.s === 403, short(r));
r = await call('PUT', '/api/hostel-warden/mess/weekly', W, { weekday: weekdayOf(in7), meals: [{ meal: 'LUNCH', time: '1 PM', items: ['Weekly Khichdi'] }] });
check('Weekly: warden saves one weekday', r.s === 200, short(r));
r = await call('GET', '/api/hostel-warden/mess/weekly', W);
check('Weekly: Monday…Sunday listed, the saved day filled', r.s === 200 && r.j.data[0].days.length === 7 && r.j.data[0].days[weekdayOf(in7) - 1].menu?.meals?.[0]?.items?.[0] === 'Weekly Khichdi', short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${in7}`, W);
check('Weekly: next week the same weekday shows the weekly menu', r.j.data[0].source === 'WEEKLY' && r.j.data[0].menu.meals[0].items[0] === 'Weekly Khichdi', short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${india(14)}`, W);
check('Weekly: …and the week after too', r.j.data[0].source === 'WEEKLY', short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${in8}`, W);
check('Weekly: a weekday without a weekly menu shows nothing (no stale carry-over)', r.j.data[0].source === null && r.j.data[0].menu === null && r.j.data[0].hasWeekly === true, short(r));
r = await call('PUT', '/api/hostel-warden/mess', W, { date: in7, meals: [{ meal: 'DINNER', items: ['Diwali Special'] }] });
r = await call('GET', `/api/hostel-warden/mess?date=${in7}`, W);
check('Special menu for a date beats the weekly menu', r.j.data[0].source === 'SPECIAL' && r.j.data[0].menu.meals[0].items[0] === 'Diwali Special', short(r));
r = await call('GET', `/api/hostel-warden/mess?date=${india(14)}`, W);
check('…only on that date', r.j.data[0].source === 'WEEKLY', short(r));
await call('DELETE', `/api/hostel-warden/mess?date=${in7}`, W);
r = await call('GET', `/api/hostel-warden/mess?date=${in7}`, W);
check('Removing the special menu brings the weekly menu back', r.j.data[0].source === 'WEEKLY', short(r));
r = await call('DELETE', `/api/hostel-warden/mess/weekly?weekday=${weekdayOf(in7)}`, W);
check('Weekly: a weekday can be cleared', r.s === 200, short(r));

// --- leave (existing student leave system) ---
const start = india(3), end = india(5);
r = await call('POST', '/api/student-leaves', ADMIN, { studentId: myIds[0], leaveType: 'CASUAL', startDate: start, endDate: end, reason: 'Family function at home' });
check('A student leave request exists (created through the existing leave API)', r.s === 201, short(r));
const leaveId = r.j?.leave?.id;
let otherLeaveId = null;
if (outsider) {
  const r2 = await call('POST', '/api/student-leaves', ADMIN, { studentId: outsider.id, leaveType: 'CASUAL', startDate: start, endDate: end, reason: 'Not a hostel student' });
  otherLeaveId = r2.j?.leave?.id;
}
r = await call('GET', '/api/hostel-warden/leaves?status=PENDING', W);
const mine = r.j?.data?.find((l) => l.id === leaveId);
check('Warden sees the request with class, room and parent contact', r.s === 200 && !!mine && 'parentPhone' in mine && mine.roomNumber, short(r));
check('…and no request of a non-hostel student', !r.j.data.some((l) => l.id === otherLeaveId));
check('…canApprove is false for the warden', r.j.canApprove === false);
r = await call('GET', '/api/student-leaves', W);
check('Existing leave list for the warden is limited to their hostel', r.s === 200 && r.j.some((l) => l.id === leaveId) && !r.j.some((l) => l.id === otherLeaveId), short(r));
r = await call('PUT', `/api/student-leaves/${leaveId}/status`, W, { status: 'APPROVED' });
check('Warden cannot approve (backend RBAC, 403)', r.s === 403, short(r));
if (otherLeaveId) {
  r = await call('PUT', `/api/student-leaves/${otherLeaveId}/forward`, W, { note: 'x' });
  check('Warden cannot forward another hostel\'s leave (403)', r.s === 403, short(r));
}
r = await call('PUT', `/api/student-leaves/${leaveId}/forward`, W, { note: 'Parent called, genuine request' });
check('Warden forwards to the Principal', r.s === 200 && !!r.j.leave.forwardedAt && r.j.leave.status === 'PENDING', short(r));
r = await call('PUT', `/api/student-leaves/${leaveId}/forward`, W, {});
check('Forwarding twice is refused (409)', r.s === 409, short(r));
r = await call('PUT', `/api/student-leaves/${leaveId}/forward`, ADMIN, {});
check('An approver does not forward (400)', r.s === 400, short(r));
r = await call('PUT', `/api/student-leaves/${leaveId}/status`, ADMIN, { status: 'APPROVED', remarks: 'OK' });
check('Principal/admin approves the forwarded leave', r.s === 200 && r.j.leave.status === 'APPROVED', short(r));
r = await call('GET', `/api/hostel-warden/attendance?date=${TODAY}`, W);
check('Leave does not touch tonight\'s saved hostel record', r.j.rows.find((x) => x.id === myIds[0]).record.status === 'PRESENT');

// --- parent chat / call ---
r = await call('GET', `/api/parent-chat/start?studentId=${myIds[0]}`, W);
check('Warden can open a chat with a resident\'s parent', r.s === 200 && !!r.j.threadId, short(r));
if (r.j?.threadId) {
  const r3 = await call('POST', `/api/parent-chat/threads/${encodeURIComponent(r.j.threadId)}/messages`, W, { text: 'Your child is well and attended roll-call.' });
  check('…and send a message', r3.s === 201, short(r3));
}
r = await call('GET', `/api/parent-chat/start?studentId=${outsider.id}`, W);
check('…but not with a non-resident\'s parent (403)', r.s === 403, short(r));

// --- other roles unaffected ---
r = await call('GET', '/api/teacher/authorized-assignments', TCH);
check('Teacher APIs unchanged', r.s === 200, short(r));
r = await call('GET', '/api/hostels', ADMIN);
check('Hostel admin API unchanged', r.s === 200 && Array.isArray(r.j.hostels), short(r));

console.log(fail ? `\n${fail} FAILED (${pass} passed)` : `\nAll ${pass} checks passed`);
process.exit(fail ? 1 : 0);
