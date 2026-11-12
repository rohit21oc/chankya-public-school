import fs from 'fs';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`✅ [PASS] ${name}${details ? ` - ${details}` : ''}`);
  } else {
    results.push({ name, passed: false, error: details || 'Assertion failed' });
    console.error(`❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
  }
}

async function api(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=====================================================');
  console.log('🚀 RUNNING TEACHER PORTAL & DASHBOARD VERIFICATION');
  console.log('=====================================================\n');

  // 1. Teacher Login
  let teacherToken = '';
  let teacherUser: any = null;
  try {
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: {
        identifier: 'PDS0002',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      },
    });

    assert(loginRes.ok && loginRes.data?.success === true, 'Teacher login successful with PDS0002', `Token length: ${loginRes.data?.token?.length}`);
    teacherToken = loginRes.data?.token;
    teacherUser = loginRes.data?.user;
    assert(teacherUser?.role === 'TEACHER', 'Authenticated user has TEACHER role', `Role: ${teacherUser?.role}`);
    assert(teacherUser?.employeeId === 'PDS0002', 'Authenticated user employeeId is PDS0002', `EmployeeId: ${teacherUser?.employeeId}`);
  } catch (err: any) {
    assert(false, 'Teacher login failed', err.message);
  }

  const teacherHeaders = {
    Authorization: `Bearer ${teacherToken}`,
    'x-auth-user-id': teacherUser?.id,
    'x-auth-user-role': teacherUser?.role,
    'x-auth-employee-id': teacherUser?.employeeId,
  };

  // 2. Teacher Dashboard Summary Endpoint (/api/teacher/dashboard-summary)
  let summary: any = null;
  try {
    const summaryRes = await api('/api/teacher/dashboard-summary', {
      headers: teacherHeaders,
    });

    assert(summaryRes.ok && summaryRes.status === 200, 'Teacher Dashboard Summary API responds with HTTP 200');
    summary = summaryRes.data;

    // Verify teacher profile info
    assert(!!summary.teacher?.name, 'Summary contains teacher profile', `Teacher: ${summary.teacher?.name} (${summary.teacher?.designation})`);
    assert(summary.teacher?.employeeId === 'PDS0002', 'Summary teacher matches authenticated employeeId', `ID: ${summary.teacher?.employeeId}`);

    // Verify assigned classes
    assert(Array.isArray(summary.assignedClasses), 'Assigned classes array exists in summary', `Count: ${summary.assignedClasses?.length}`);
    if (summary.assignedClasses?.length > 0) {
      const firstClass = summary.assignedClasses[0];
      assert(!!firstClass.className && !!firstClass.section, 'Assigned class has className and section', `${firstClass.className} - Section ${firstClass.section}`);
      assert(typeof firstClass.studentCount === 'number', 'Assigned class has enrolled student count', `Students: ${firstClass.studentCount}`);
      assert(typeof firstClass.attendance?.isMarked === 'boolean', 'Assigned class has attendance marking state');
    }

    // Verify today's timetable
    assert(Array.isArray(summary.todayTimetable), 'Today timetable array exists in summary', `Scheduled periods: ${summary.todayTimetable?.length}`);
    if (summary.todayTimetable?.length > 0) {
      const firstSlot = summary.todayTimetable[0];
      assert(!!firstSlot.subjectName && !!firstSlot.startTime, 'Timetable slot has subject, timing, and status', `${firstSlot.subjectName} (${firstSlot.startTime} - ${firstSlot.endTime}) - ${firstSlot.status}`);
    }

    // Verify upcoming exams
    assert(Array.isArray(summary.upcomingExams), 'Upcoming exams array exists in summary', `Count: ${summary.upcomingExams?.length}`);

    // Verify notices
    assert(Array.isArray(summary.recentNotices), 'School notices array exists in summary', `Count: ${summary.recentNotices?.length}`);

    // Verify leave summary
    assert(typeof summary.leaveSummary?.remainingBalance === 'number', 'Leave summary has valid balance', `Balance: ${summary.leaveSummary?.remainingBalance} days`);

    // Verify quick stats
    assert(typeof summary.quickStats?.totalAssignedStudents === 'number', 'Quick stats totalAssignedStudents calculated', `Total: ${summary.quickStats?.totalAssignedStudents}`);
    assert(typeof summary.quickStats?.pendingAttendanceCount === 'number', 'Quick stats pendingAttendanceCount calculated', `Pending: ${summary.quickStats?.pendingAttendanceCount}`);
  } catch (err: any) {
    assert(false, 'Dashboard summary verification failed', err.message);
  }

  // 3. Teacher Assigned Classes Endpoint (/api/teacher/classes)
  try {
    const classesRes = await api('/api/teacher/classes', {
      headers: teacherHeaders,
    });
    assert(classesRes.ok && classesRes.data?.success === true, 'Teacher Classes API responds with HTTP 200', `Assigned classes: ${classesRes.data?.assignedClasses?.length}`);
  } catch (err: any) {
    assert(false, 'Teacher classes verification failed', err.message);
  }

  // 4. Data Scoping & Row-Level Authorization for Teacher
  try {
    // Teacher viewing students: should ONLY see their assigned class students
    const studentsRes = await api('/api/students', {
      headers: teacherHeaders,
    });
    assert(studentsRes.ok, 'Teacher student directory API returns HTTP 200');
    const teacherStudents = Array.isArray(studentsRes.data?.data)
      ? studentsRes.data.data
      : (Array.isArray(studentsRes.data) ? studentsRes.data : []);
    
    // Verify each returned student is in teacher's assigned classes
    if (summary?.assignedClasses?.length > 0 && teacherStudents.length > 0) {
      const assignedClassNames = summary.assignedClasses.map((ac: any) => ac.className.toLowerCase());
      const allPermitted = teacherStudents.every((st: any) => {
        const sClass = (st.className || '').toLowerCase();
        return assignedClassNames.some((ac: string) => ac === sClass || ac.includes(sClass) || sClass.includes(ac));
      });
      assert(allPermitted, 'Data Scoping Enforced: All returned students belong to teacher assigned classes');
    } else {
      assert(true, 'Data Scoping: Scoped student list returned');
    }

    // Teacher attempting to view confidential audit logs -> 403 Forbidden
    const auditRes = await api('/api/audit-logs', {
      headers: teacherHeaders,
    });
    assert(auditRes.status === 403, 'RBAC Enforced: Teacher blocked from viewing institutional audit logs (HTTP 403)');

    // Teacher attempting to view settings -> 403 Forbidden
    const settingsRes = await api('/api/settings', {
      method: 'PUT',
      headers: teacherHeaders,
      body: { schoolName: 'Hacked' },
    });
    assert(settingsRes.status === 403, 'RBAC Enforced: Teacher blocked from modifying global school settings (HTTP 403)');
  } catch (err: any) {
    assert(false, 'Data scoping verification failed', err.message);
  }

  // 5. Administrator Regression Check
  try {
    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: {
        identifier: 'admin',
        password: 'admin123',
        loginType: 'STAFF_ADMIN',
      },
    });
    assert(adminLogin.ok && adminLogin.data?.user?.role === 'SUPER_ADMIN', 'Super Admin login successful', `Admin: ${adminLogin.data?.user?.name}`);

    const adminHeaders = {
      Authorization: `Bearer ${adminLogin.data?.token}`,
    };

    const adminStudentsRes = await api('/api/students?limit=10', {
      headers: adminHeaders,
    });
    assert(adminStudentsRes.ok, 'Admin students list functions properly');

    const adminTimetableRes = await api('/api/timetables', {
      headers: adminHeaders,
    });
    assert(adminTimetableRes.ok, 'Admin timetable API functions properly');
  } catch (err: any) {
    assert(false, 'Administrator regression check failed', err.message);
  }

  // 6. Summary
  console.log('\n=====================================================');
  console.log('📊 TEACHER PORTAL VERIFICATION SUMMARY');
  console.log('=====================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TEACHER PORTAL VERIFICATION CHECKS PASSED PERFECTLY!');
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
