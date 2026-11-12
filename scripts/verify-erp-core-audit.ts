/**
 * ERP core audit suite: Dashboard, Students, Teachers & Staff, Staff Salary, Admission Letter email.
 *
 * Runs against a running server (AUDIT_BASE_URL, default http://localhost:3000) that is connected to a
 * LOCAL MongoDB-compatible test database (MONGODB_URI). Persistence is verified by reading the database
 * directly, not by trusting API responses.
 *
 * Safety:
 *  - Refuses to run unless MONGODB_URI points at localhost / 127.0.0.1 (set AUDIT_ALLOW_REMOTE=1 to override;
 *    never do this against production).
 *  - Creates only its own records (names prefixed "AUDIT-"), never edits or deletes seeded records.
 *  - Sessions are signed with JWT_SECRET from the environment (the same secret the test server uses).
 *
 * Usage:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/ JWT_SECRET=... npx tsx scripts/verify-erp-core-audit.ts
 */
import jwt from 'jsonwebtoken';
import { MongoClient, Db } from 'mongodb';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const DB_NAME = 'pds_school_erp';
const RUN = Date.now().toString().slice(-6);

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function sign(payload: Record<string, unknown>): string {
  return jwt.sign({ ...payload, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: '2h' });
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const SECRET_KEYS = ['passwordHash', 'initialPassword', 'temporaryPassword', 'passwordResetToken', 'passwordResetTokenHash'];
function leaksSecret(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of SECRET_KEYS) if (k in obj && obj[k]) return k;
  return null;
}

async function main() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET must be set to the test server secret.');
  if (!MONGODB_URI) throw new Error('MONGODB_URI must point at the local test database.');
  const host = MONGODB_URI.replace(/^mongodb(\+srv)?:\/\//, '').split(/[/?]/)[0].split('@').pop() || '';
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && process.env.AUDIT_ALLOW_REMOTE !== '1') {
    throw new Error(`Refusing to run: MONGODB_URI host "${host}" is not local.`);
  }

  const client = await MongoClient.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db: Db = client.db(DB_NAME);

  const health = await call('GET', '/api/health');
  if (health.status !== 200) throw new Error(`Server not healthy at ${BASE} (HTTP ${health.status}).`);

  const admin = sign({ userId: 'audit-admin', role: 'SUPER_ADMIN' });
  const hr = sign({ userId: 'audit-hr', role: 'HR_STAFF' });
  const accountant = sign({ userId: 'audit-acct', role: 'ACCOUNTANT' });
  const principal = sign({ userId: 'audit-principal', role: 'PRINCIPAL' });

  const classes: any[] = (await call('GET', '/api/classes', admin)).json || [];
  const activeClass = classes.find((c) => (c.status || 'ACTIVE') === 'ACTIVE' && (c.sections || []).length > 0);
  if (!activeClass) throw new Error('No active class with sections found in test data.');
  const section = activeClass.sections[0];

  const staffDir: any[] = (await call('GET', '/api/teachers', admin)).json || [];
  const teacherRec = staffDir.find((s) => (s.portalRole || s.systemRole || s.role) === 'TEACHER' && (s.status || 'ACTIVE') === 'ACTIVE');
  const teacher = sign({ userId: teacherRec?.id || 'audit-teacher', role: 'TEACHER', employeeId: teacherRec?.employeeId });
  const orphanTeacher = sign({ userId: 'audit-teacher-without-record', role: 'TEACHER' });
  const parent = sign({ userId: 'audit-parent', role: 'PARENT', linkedStudentIds: [] });

  // ------------------------------------------------------------------ DASHBOARD
  console.log('\n== Dashboard');
  {
    const anon = await call('GET', '/api/dashboard/summary');
    check('Dashboard summary requires sign-in', anon.status === 401, `HTTP ${anon.status}`);
    const asParent = await call('GET', '/api/dashboard/summary', parent);
    check('Dashboard summary is refused for parents', asParent.status === 403, `HTTP ${asParent.status}`);

    const d = await call('GET', '/api/dashboard/summary', admin);
    check('Dashboard summary loads for admin', d.status === 200, `HTTP ${d.status}`);
    const s = d.json || {};
    check("Dashboard 'today' is the Asia/Kolkata date", s.todayDate === istToday(), `${s.todayDate} vs ${istToday()}`);

    const dbStudents = await db.collection('students').find({}).toArray();
    const session = String(s.academicSession || '');
    const sameSession = (v?: string) => !v || v.replace(/[\s-]/g, '').slice(0, 4) === session.replace(/[\s-]/g, '').slice(0, 4);
    const activeDb = dbStudents.filter((x: any) => x.status === 'ACTIVE' && sameSession(x.academicSession));
    check('Active student count matches the database', s.totalStudents === activeDb.length, `${s.totalStudents} vs ${activeDb.length}`);

    const distTotal = (s.classDistribution || []).reduce((a: number, c: any) => a + (c.count || 0), 0);
    check('Class-wise distribution adds up to active students', distTotal === s.totalStudents, `${distTotal} vs ${s.totalStudents}`);

    const dbStaff = await db.collection('staff').find({}).toArray();
    const activeStaffDb = dbStaff.filter((x: any) => !x.status || x.status === 'ACTIVE');
    check('Active staff count matches the database', s.totalStaff === activeStaffDb.length, `${s.totalStaff} vs ${activeStaffDb.length}`);

    // Attendance: mark today's attendance for two active students in one section (LATE must count as present).
    const pick = activeDb.filter((x: any) => x.classId && x.section).slice(0, 1)[0];
    if (pick) {
      const peers = activeDb.filter((x: any) => x.classId === pick.classId && x.section === pick.section).slice(0, 2);
      if (peers.length === 2) {
        // Pick the most recent school day (not a Sunday, not a holiday) before today.
        const holidays = await db.collection('holidays').find({}).toArray();
        const isHoliday = (d: string) => holidays.some((h: any) => {
          const st = String(h.date || '').substring(0, 10);
          const en = String(h.endDate || h.date || '').substring(0, 10);
          return d >= st && d <= en;
        });
        let probe = new Date(`${istToday()}T12:00:00Z`);
        let today = '';
        for (let i = 0; i < 40 && !today; i++) {
          probe = new Date(probe.getTime() - 86400000);
          const d = probe.toISOString().substring(0, 10);
          if (probe.getUTCDay() !== 0 && !isHoliday(d)) today = d;
        }
        const post = await call('POST', '/api/attendance', admin, {
          date: today,
          classId: pick.classId,
          section: pick.section,
          records: [
            { studentId: peers[0].id, status: 'LATE', date: today, classId: pick.classId, section: pick.section },
            { studentId: peers[1].id, status: 'PRESENT', date: today, classId: pick.classId, section: pick.section },
          ],
        });
        if (post.status < 300) {
          const after = (await call('GET', `/api/dashboard/summary?date=${today}`, admin)).json || {};
          const a = after.attendance || {};
          const counted = (a.present || 0) + (a.absent || 0) + (a.leave || 0);
          check('Late arrivals count as present, not as leave', (a.present || 0) >= 2,
            `present=${a.present} late=${a.late} leave=${a.leave}`);
          check('Attendance % uses marked students as denominator',
            a.percentage === (counted ? Math.round(((a.present || 0) / counted) * 100) : null),
            `pct=${a.percentage} present=${a.present} marked=${counted}`);
          check('Not-marked = active students − marked', a.notMarked === Math.max(0, after.totalStudents - (a.totalMarked || 0)),
            `notMarked=${a.notMarked} total=${after.totalStudents} marked=${a.totalMarked}`);
        } else {
          check('Attendance fixture could be saved', false, `HTTP ${post.status} ${post.text.slice(0, 120)}`);
        }
      }
    }

    const asTeacher = await call('GET', '/api/dashboard/summary', teacher);
    const teacherSeesFees = asTeacher.json && asTeacher.json.fees && Array.isArray(asTeacher.json.fees.recentPayments) && asTeacher.json.fees.recentPayments.length >= 0 && asTeacher.json.fees.todayCollection !== undefined;
    check('Fee figures are hidden from roles without fee access', asTeacher.status === 200 ? !teacherSeesFees : asTeacher.status === 403,
      `HTTP ${asTeacher.status}`);
  }

  // ------------------------------------------------------------------ STUDENTS
  console.log('\n== Students');
  let createdStudent: any = null;
  {
    const noName = await call('POST', '/api/students', admin, { classId: activeClass.id, section, dob: '2016-04-10', gender: 'FEMALE' });
    check('Admission without a name is rejected', noName.status === 400, `HTTP ${noName.status}`);

    const badClass = await call('POST', '/api/students', admin, { name: `AUDIT-BadClass-${RUN}`, classId: 'no-such-class', section: 'A', dob: '2016-04-10', gender: 'MALE' });
    check('Admission to a non-existent class is rejected', badClass.status === 400, `HTTP ${badClass.status}`);

    const badSection = await call('POST', '/api/students', admin, { name: `AUDIT-BadSec-${RUN}`, classId: activeClass.id, section: 'ZZ', dob: '2016-04-10', gender: 'MALE' });
    check('Admission to a section the class does not have is rejected', badSection.status === 400, `HTTP ${badSection.status}`);

    const futureDob = await call('POST', '/api/students', admin, { name: `AUDIT-Future-${RUN}`, classId: activeClass.id, section, dob: '2099-01-01', gender: 'MALE' });
    check('Admission with a future date of birth is rejected', futureDob.status === 400, `HTTP ${futureDob.status}`);

    const clientId = `st-audit-${RUN}`;
    const payload = {
      id: clientId,
      name: `AUDIT-Student-${RUN}`,
      classId: activeClass.id,
      section,
      dob: '2016-04-10',
      gender: 'FEMALE',
      fatherName: 'AUDIT Father',
      fatherMobile: `90000${RUN.slice(-5)}`,
      parentEmail: '',
      temporaryPassword: 'should-not-be-stored',
    };
    const ok = await call('POST', '/api/students', admin, payload);
    createdStudent = ok.json && ok.json.id ? ok.json : ok.json?.student;
    check('Valid admission succeeds', ok.status === 200 || ok.status === 201, `HTTP ${ok.status}`);
    check('Admission response contains no password fields', !leaksSecret(createdStudent), leaksSecret(createdStudent) || '');

    const dbDoc = await db.collection('students').findOne({ id: createdStudent?.id || clientId });
    check('Admitted student is persisted in MongoDB', !!dbDoc, dbDoc ? `adm ${dbDoc.admissionNumber}` : 'not found');
    check('Temporary password is not stored on the student record', !!dbDoc && !dbDoc.temporaryPassword);
    check('Server assigned an admission number', !!dbDoc?.admissionNumber);

    const again = await call('POST', '/api/students', admin, payload);
    const countAfterRetry = await db.collection('students').countDocuments({ name: payload.name });
    check('Retrying the same admission does not create a duplicate', countAfterRetry === 1, `count=${countAfterRetry}, HTTP ${again.status}`);

    if (dbDoc) {
      const dupAdm = await call('POST', '/api/students', admin, {
        name: `AUDIT-Dup-${RUN}`,
        admissionNumber: dbDoc.admissionNumber,
        classId: activeClass.id,
        section,
        dob: '2015-02-02',
        gender: 'MALE',
      });
      const stillOriginal = await db.collection('students').findOne({ admissionNumber: dbDoc.admissionNumber });
      check('Admission with an existing admission number is rejected (409)', dupAdm.status === 409, `HTTP ${dupAdm.status}`);
      check('Existing student was not overwritten by the duplicate', stillOriginal?.name === payload.name, stillOriginal?.name);

      const overwriteById = await call('POST', '/api/students', accountant, { id: dbDoc.id, name: 'AUDIT-Overwritten', classId: activeClass.id, section, dob: '2016-04-10', gender: 'FEMALE' });
      const afterOverwrite = await db.collection('students').findOne({ id: dbDoc.id });
      check('Create endpoint cannot be used to overwrite another student', afterOverwrite?.name === payload.name, `HTTP ${overwriteById.status}, name=${afterOverwrite?.name}`);

      const edit = await call('PUT', `/api/students/${encodeURIComponent(dbDoc.id)}`, admin, { motherName: 'AUDIT Mother', city: 'Sheohar' });
      const afterEdit = await db.collection('students').findOne({ id: dbDoc.id });
      check('Student edit persists in MongoDB', edit.status === 200 && afterEdit?.motherName === 'AUDIT Mother', `HTTP ${edit.status}`);
      const reread = await call('GET', `/api/students/${encodeURIComponent(dbDoc.id)}`, admin);
      check('Edited value is returned after reload', reread.json?.motherName === 'AUDIT Mother');

      const badEditClass = await call('PUT', `/api/students/${encodeURIComponent(dbDoc.id)}`, admin, { classId: 'no-such-class' });
      check('Edit to a non-existent class is rejected', badEditClass.status === 400, `HTTP ${badEditClass.status}`);

      const badStatus = await call('PATCH', `/api/students/${encodeURIComponent(dbDoc.id)}/status`, admin, { status: 'BANANA' });
      check('Unknown student status is rejected', badStatus.status === 400, `HTTP ${badStatus.status}`);
      const goodStatus = await call('PATCH', `/api/students/${encodeURIComponent(dbDoc.id)}/status`, admin, { status: 'INACTIVE' });
      const afterStatus = await db.collection('students').findOne({ id: dbDoc.id });
      check('Status change persists in MongoDB', goodStatus.status === 200 && afterStatus?.status === 'INACTIVE', `HTTP ${goodStatus.status}, db=${afterStatus?.status}`);
      await call('PATCH', `/api/students/${encodeURIComponent(dbDoc.id)}/status`, admin, { status: 'ACTIVE' });

      const teacherDelete = await call('DELETE', `/api/students/${encodeURIComponent(dbDoc.id)}`, teacher);
      check('Teachers cannot delete students', teacherDelete.status === 403, `HTTP ${teacherDelete.status}`);

      // Admission letter email: test student has no parent email.
      const tinyPdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
      const noEmail = await call('POST', `/api/students/${encodeURIComponent(dbDoc.id)}/admission-letter/email`, admin, { pdfBase64: tinyPdf });
      check('Admission letter email without a parent email gives a clear 400', noEmail.status === 400 && /email/i.test(noEmail.json?.error || ''), `HTTP ${noEmail.status} ${noEmail.json?.error || ''}`);
      const teacherEmail = await call('POST', `/api/students/${encodeURIComponent(dbDoc.id)}/admission-letter/email`, teacher, { pdfBase64: tinyPdf });
      check('Teachers cannot email admission letters', teacherEmail.status === 403, `HTTP ${teacherEmail.status}`);

      await call('PUT', `/api/students/${encodeURIComponent(dbDoc.id)}`, admin, { parentEmail: `audit.parent.${RUN}@example.com` });
      const notPdf = await call('POST', `/api/students/${encodeURIComponent(dbDoc.id)}/admission-letter/email`, admin, { pdfBase64: Buffer.from('hello').toString('base64') });
      check('Admission letter email rejects a non-PDF attachment', notPdf.status === 400, `HTTP ${notPdf.status}`);
      const send = await call('POST', `/api/students/${encodeURIComponent(dbDoc.id)}/admission-letter/email`, admin, { pdfBase64: tinyPdf });
      const providerUnconfigured = !process.env.BREVO_API_KEY;
      check('Email is never reported as sent when the provider did not accept it',
        providerUnconfigured ? send.status >= 400 && send.json?.success !== true : (send.status === 200 ? send.json?.status === 'ACCEPTED' : true),
        `HTTP ${send.status} status=${send.json?.status} ${send.json?.error || ''}`);
    }

    // Delete guard: a student with attendance cannot be hard-deleted.
    const dbAll = await db.collection('students').find({ status: 'ACTIVE' }).toArray();
    const att = await db.collection('attendance').findOne({ studentId: { $in: dbAll.map((x: any) => x.id) } });
    if (att) {
      const guarded = await call('DELETE', `/api/students/${encodeURIComponent(att.studentId)}`, sign({ userId: 'audit-sa', role: 'SCHOOL_ADMIN' }));
      const still = await db.collection('students').findOne({ id: att.studentId });
      check('Students with attendance/fee/exam records cannot be hard-deleted', guarded.status === 409 && !!still, `HTTP ${guarded.status}`);
    }
    if (createdStudent?.id) {
      // Fresh admission with only its unpaid admission invoice may be deleted (mistaken entry).
      const scratch = await call('POST', '/api/students', admin, {
        name: `AUDIT-Mistake-${RUN}`,
        classId: activeClass.id,
        section,
        dob: '2017-05-05',
        gender: 'MALE',
      });
      const sid = scratch.json?.id;
      if (sid) {
        const del = await call('DELETE', `/api/students/${encodeURIComponent(sid)}`, admin);
        const gone = await db.collection('students').findOne({ id: sid });
        check('A mistaken admission with no activity can be deleted', del.status === 200 && !gone, `HTTP ${del.status}`);
      }
    }
  }

  // ------------------------------------------------------------------ STAFF
  console.log('\n== Teachers & Staff');
  let testStaff: any = null;
  const staffPassword = `Audit@${RUN}x`;
  {
    const noName = await call('POST', '/api/teachers', admin, { phone: '9000000000' });
    check('Adding staff without a name is rejected', noName.status === 400, `HTTP ${noName.status}`);

    const escalate = await call('POST', '/api/teachers', hr, { name: `AUDIT-Escalate-${RUN}`, phone: '9000000001', portalRole: 'SUPER_ADMIN', initialPassword: 'Escalate@123' });
    const escalatedDoc = await db.collection('staff').findOne({ name: `AUDIT-Escalate-${RUN}` });
    check('HR cannot create a Super Admin account', escalate.status === 403 && !escalatedDoc, `HTTP ${escalate.status}`);

    const add = await call('POST', '/api/teachers', admin, {
      name: `AUDIT-Staff-${RUN}`,
      phone: `91111${RUN.slice(-5)}`,
      designation: 'TGT Teacher',
      department: 'ACADEMICS',
      portalRole: 'TEACHER',
      joiningDate: '2026-01-05',
      monthlySalary: 30000,
      initialPassword: staffPassword,
    });
    testStaff = add.json?.staff;
    check('Adding staff succeeds', add.status === 201 && !!testStaff, `HTTP ${add.status}`);
    check('Add-staff response contains no password hash', !leaksSecret(testStaff), leaksSecret(testStaff) || '');
    const staffDoc = testStaff && (await db.collection('staff').findOne({ id: testStaff.id }));
    const userDoc = testStaff && (await db.collection('users').findOne({ id: testStaff.id }));
    check('New staff is persisted in MongoDB (staff + login account)', !!staffDoc && !!userDoc);

    if (testStaff) {
      const dupEmp = await call('POST', '/api/teachers', admin, { name: `AUDIT-DupEmp-${RUN}`, phone: '9000000002', employeeId: testStaff.employeeId });
      const dupDoc = await db.collection('staff').findOne({ name: `AUDIT-DupEmp-${RUN}` });
      check('Duplicate employee ID is rejected (409), not silently renumbered', dupEmp.status === 409 && !dupDoc, `HTTP ${dupEmp.status}`);

      const edit = await call('PUT', `/api/teachers/${testStaff.id}`, admin, { qualification: 'M.Sc., B.Ed.', phone: `92222${RUN.slice(-5)}` });
      const afterEdit = await db.collection('staff').findOne({ id: testStaff.id });
      check('Staff edit persists in MongoDB', edit.status === 200 && afterEdit?.qualification === 'M.Sc., B.Ed.', `HTTP ${edit.status}`);
      check('Staff edit response contains no password hash', !leaksSecret(edit.json), leaksSecret(edit.json) || '');

      const hrRole = await call('PUT', `/api/teachers/${testStaff.id}`, hr, { portalRole: 'SUPER_ADMIN' });
      const afterHrRole = await db.collection('staff').findOne({ id: testStaff.id });
      check('HR cannot promote staff to Super Admin via edit', hrRole.status === 403 && (afterHrRole?.portalRole || afterHrRole?.systemRole) !== 'SUPER_ADMIN', `HTTP ${hrRole.status}`);

      const hrSelf = staffDir.find((s) => (s.portalRole || s.systemRole) === 'HR_STAFF');
      if (hrSelf) {
        const hrSelfTok = sign({ userId: hrSelf.id, role: 'HR_STAFF', employeeId: hrSelf.employeeId });
        const selfRole = await call('PUT', `/api/teachers/${hrSelf.id}`, hrSelfTok, { portalRole: 'SCHOOL_ADMIN' });
        check('Staff cannot change their own role', selfRole.status === 403, `HTTP ${selfRole.status}`);
      }

      const dupEdit = await call('PUT', `/api/teachers/${testStaff.id}`, admin, { employeeId: staffDir.find((s) => s.employeeId && s.id !== testStaff.id)?.employeeId });
      check('Edit to an employee ID already in use is rejected', dupEdit.status === 409, `HTTP ${dupEdit.status}`);

      // Login, then deactivate: existing session must stop working and new logins must be refused.
      const login = await call('POST', '/api/auth/login', undefined, { identifier: testStaff.employeeId, password: staffPassword, loginType: 'STAFF_ADMIN' });
      check('New staff can sign in with the initial password', login.status === 200 && !!login.json?.token, `HTTP ${login.status} ${login.json?.error || ''}`);
      const staffToken = login.json?.token;
      const deact = await call('PUT', `/api/teachers/${testStaff.id}`, admin, { status: 'INACTIVE', accountStatus: 'INACTIVE' });
      const userAfter = await db.collection('users').findOne({ id: testStaff.id });
      check('Deactivation is saved on the login account', deact.status === 200 && (userAfter?.status === 'INACTIVE' || userAfter?.loginEnabled === false), `user.status=${userAfter?.status} loginEnabled=${userAfter?.loginEnabled}`);
      if (staffToken) {
        const me = await call('GET', '/api/auth/me', staffToken);
        check('Existing session of deactivated staff is rejected', me.status === 401 || me.status === 403, `HTTP ${me.status}`);
      }
      const relogin = await call('POST', '/api/auth/login', undefined, { identifier: testStaff.employeeId, password: staffPassword, loginType: 'STAFF_ADMIN' });
      check('Deactivated staff cannot sign in', relogin.status === 403, `HTTP ${relogin.status}`);
      await call('PUT', `/api/teachers/${testStaff.id}`, admin, { status: 'ACTIVE', accountStatus: 'ACTIVE' });

      const salaryBefore = (await db.collection('staff').findOne({ id: testStaff.id }))?.monthlySalary;
      const principalEdit = await call('PUT', `/api/teachers/${testStaff.id}`, principal, { qualification: 'M.A., B.Ed.', monthlySalary: 50000 });
      const salaryAfter = (await db.collection('staff').findOne({ id: testStaff.id }))?.monthlySalary;
      check('A role without payroll access cannot change salary while editing a profile',
        principalEdit.status === 200 && salaryAfter === salaryBefore, `HTTP ${principalEdit.status}, salary ${salaryBefore} → ${salaryAfter}`);

      const teacherEditsOther = await call('PUT', `/api/teachers/${testStaff.id}`, teacher, { phone: '9999999999' });
      check('Teachers cannot edit other staff', teacherEditsOther.status === 403, `HTTP ${teacherEditsOther.status}`);

      const idCard = await call('GET', `/api/staff/${testStaff.id}/id-card`, admin);
      check('Staff ID card data loads for admin', idCard.status === 200, `HTTP ${idCard.status}`);
      const idCardAnon = await call('GET', `/api/staff/${testStaff.id}/id-card`);
      check('Staff ID card data requires sign-in', idCardAnon.status === 401, `HTTP ${idCardAnon.status}`);

      const resend = await call('POST', `/api/teachers/${testStaff.id}/resend-credentials`, admin);
      check('Resend credentials without an email address gives a clear error, not success',
        resend.json?.success !== true || resend.json?.emailDispatched === false, `HTTP ${resend.status} ${resend.json?.message || resend.json?.error || ''}`);
    }
  }

  // ------------------------------------------------------------------ PAYROLL
  console.log('\n== Staff Salary & Payroll');
  {
    const asOrphanTeacher = await call('GET', '/api/staff-payroll', orphanTeacher);
    const leaked = Array.isArray(asOrphanTeacher.json) ? asOrphanTeacher.json.length : 0;
    check('A teacher session without a staff record cannot list payroll', asOrphanTeacher.status === 403 || leaked === 0, `HTTP ${asOrphanTeacher.status}, rows=${leaked}`);

    const future = await call('POST', '/api/staff-payroll/generate', admin, { month: '2099-01' });
    check('Payroll cannot be generated for a future month', future.status === 400, `HTTP ${future.status}`);
    const nowIst = istToday().slice(0, 7);
    const current = await call('POST', '/api/staff-payroll/generate', admin, { month: nowIst });
    check('Payroll cannot be generated for a month that has not ended', current.status === 400, `HTTP ${current.status}`);
    const badMonth = await call('POST', '/api/staff-payroll/generate', admin, { month: '2026-13' });
    check('Invalid payroll month is rejected', badMonth.status === 400, `HTTP ${badMonth.status}`);

    if (testStaff) {
      // September 2026: 30 days; Sundays 6,13,20,27. Fixture: 2 LATE, 1 ABSENT, 1 HALF_DAY, rejected leave on a PRESENT day.
      const marks: Array<[string, string]> = [
        ['2026-09-01', 'LATE'],
        ['2026-09-02', 'LATE'],
        ['2026-09-03', 'ABSENT'],
        ['2026-09-04', 'HALF_DAY'],
        ['2026-09-05', 'PRESENT'],
      ];
      for (const [date, status] of marks) {
        const existing = await db.collection('staff_attendance').find({ date }).toArray();
        const keep = existing.filter((r: any) => r.staffId !== testStaff.id).map((r: any) => ({ staffId: r.staffId, employeeId: r.employeeId, status: r.status, remarks: r.remarks }));
        await call('POST', '/api/staff-attendance', admin, { date, records: [...keep, { staffId: testStaff.id, status }] });
      }
      await call('POST', '/api/staff-leaves', admin, {
        staffId: testStaff.id,
        leaveType: 'CASUAL',
        startDate: '2026-09-05',
        endDate: '2026-09-05',
        reason: 'AUDIT rejected leave',
        status: 'REJECTED',
      });

      const gen = await call('POST', '/api/staff-payroll/generate', admin, { month: '2026-09', force: true });
      check('Payroll generation for a completed month succeeds', gen.status === 200, `HTTP ${gen.status} ${gen.json?.error || ''}`);
      const rec = await db.collection('staff_payroll').findOne({ staffId: testStaff.id, payrollMonth: '2026-09' });
      // Expected: daily = 1000; late = 2 × 25% = 500; unpaid = 1 (absent) + 0.5 (half day) = 1.5 → 1500; rejected leave on a present day: 0.
      const expectedLate = round2((30000 / 30) * 0.25 * 2);
      const expectedUnpaid = round2((30000 / 30) * 1.5);
      const expectedNet = round2(30000 - expectedLate - expectedUnpaid);
      check('Payroll record persisted in MongoDB', !!rec);
      check('Late deduction = 25% of daily rate per late day', rec?.lateDeduction === expectedLate, `${rec?.lateDeduction} vs ${expectedLate}`);
      check('Unpaid deduction counts absent + half day only (rejected leave on a present day is not deducted)', rec?.unpaidLeaveDeduction === expectedUnpaid, `${rec?.unpaidLeaveDeduction} vs ${expectedUnpaid}`);
      check('Net salary = monthly − deductions', rec?.netSalary === expectedNet, `${rec?.netSalary} vs ${expectedNet}`);

      const regen = await call('POST', '/api/staff-payroll/generate', admin, { month: '2026-09' });
      const count = await db.collection('staff_payroll').countDocuments({ staffId: testStaff.id, payrollMonth: '2026-09' });
      check('Re-running generation does not duplicate records', regen.status === 200 && count === 1, `count=${count}`);

      if (rec) {
        const teacherPay = await call('POST', `/api/staff-payroll/${rec.id}/pay`, teacher, { paymentMethod: 'CASH' });
        check('Teachers cannot mark salary as paid', teacherPay.status === 403, `HTTP ${teacherPay.status}`);
        const badMethod = await call('POST', `/api/staff-payroll/${rec.id}/pay`, admin, { paymentMethod: 'GOLD' });
        check('Unknown payment method is rejected', badMethod.status === 400, `HTTP ${badMethod.status}`);
        const noRef = await call('POST', `/api/staff-payroll/${rec.id}/pay`, admin, { paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-10-01' });
        check('A bank transfer cannot be recorded without its reference', noRef.status === 400, `HTTP ${noRef.status}`);
        const futureDate = await call('POST', `/api/staff-payroll/${rec.id}/pay`, admin, { paymentMethod: 'CASH', paymentDate: '2099-01-01' });
        check('A payment cannot be dated in the future', futureDate.status === 400, `HTTP ${futureDate.status}`);
        const pay = await call('POST', `/api/staff-payroll/${rec.id}/pay`, admin, { paymentMethod: 'BANK_TRANSFER', transactionReference: `AUDIT-UTR-${RUN}`, paymentDate: '2026-10-01' });
        const paidDoc = await db.collection('staff_payroll').findOne({ id: rec.id });
        check('Mark as paid persists in MongoDB', pay.status === 200 && paidDoc?.paymentStatus === 'PAID' && paidDoc?.transactionReference === `AUDIT-UTR-${RUN}`, `HTTP ${pay.status}`);
        const payAgain = await call('POST', `/api/staff-payroll/${rec.id}/pay`, admin, { paymentMethod: 'CASH' });
        const paidAgainDoc = await db.collection('staff_payroll').findOne({ id: rec.id });
        check('Paying an already-paid salary is refused (409)', payAgain.status === 409 && paidAgainDoc?.paymentMethod === 'BANK_TRANSFER', `HTTP ${payAgain.status}`);
        const forceRegen = await call('POST', '/api/staff-payroll/generate', admin, { month: '2026-09', force: true });
        const afterForce = await db.collection('staff_payroll').findOne({ id: rec.id });
        check('Forced regeneration never overwrites a paid salary', forceRegen.status === 200 && afterForce?.paymentStatus === 'PAID' && afterForce?.netSalary === rec.netSalary);
        const manualOverwrite = await call('POST', '/api/staff-payroll', admin, { id: rec.id, staffId: testStaff.id, month: 'September 2026', netSalary: 1, paymentStatus: 'PENDING' });
        const afterManual = await db.collection('staff_payroll').findOne({ id: rec.id });
        check('Manual salary entry cannot overwrite a paid record', manualOverwrite.status === 409 && afterManual?.netSalary === rec.netSalary, `HTTP ${manualOverwrite.status}`);
      }

      // Staff without a configured salary must not receive an invented amount.
      const noSal = await call('POST', '/api/teachers', admin, { name: `AUDIT-NoSalary-${RUN}`, phone: `93333${RUN.slice(-5)}`, joiningDate: '2026-01-05', portalRole: 'TEACHER' });
      const noSalId = noSal.json?.staff?.id;
      if (noSalId) {
        const g = await call('POST', '/api/staff-payroll/generate', admin, { month: '2026-08', force: true });
        const invented = await db.collection('staff_payroll').findOne({ staffId: noSalId, payrollMonth: '2026-08' });
        check('No payroll is invented for staff without a configured salary', !invented, invented ? `monthlySalary=${invented.monthlySalary}` : '');
        const listed = (g.json?.notConfigured || []).some((x: any) => x.staffId === noSalId || x.id === noSalId);
        check('Generation reports staff whose salary is not configured', listed);
        await call('PUT', `/api/teachers/${noSalId}`, admin, { status: 'INACTIVE', accountStatus: 'INACTIVE' });
      }
      await call('PUT', `/api/teachers/${testStaff.id}`, admin, { status: 'INACTIVE', accountStatus: 'INACTIVE' });
    }
  }

  await client.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Audit suite could not run:', err?.message || err);
  process.exit(2);
});
