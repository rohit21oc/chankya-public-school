import { persistentStorage } from '../server/storage/persistentStorage.ts';
import { mongoService } from '../server/db/mongo.ts';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING TEACHER ASSIGNMENT & ATTENDANCE FLOW VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Verify Active Classes from MongoDB
    console.log('\n--- 1. Testing Active Classes Query ---');
    const classesRes = await fetch(`${BASE_URL}/api/classes`);
    const allClasses = await classesRes.json();
    assert(Array.isArray(allClasses) && allClasses.length > 0, `Classes loaded: ${allClasses.length} found`);
    const activeClasses = allClasses.filter((c: any) => (c.status || 'ACTIVE') === 'ACTIVE');
    assert(activeClasses.length > 0, `Active classes found: ${activeClasses.length}`);
    const inactiveClass = allClasses.find((c: any) => c.status === 'INACTIVE');
    if (inactiveClass) {
      console.log(`  Identified inactive test class: ${inactiveClass.name} (${inactiveClass.id})`);
    }

    // 2. Setup / Find a Teacher for Testing
    console.log('\n--- 2. Setting Up Test Teacher ---');
    const teachersRes = await fetch(`${BASE_URL}/api/teachers`);
    const teachers = await teachersRes.json();
    assert(Array.isArray(teachers) && teachers.length > 0, `Teachers loaded: ${teachers.length} found`);
    
    // Choose Sunita Verma or create a test teacher
    let teacher = teachers.find((t: any) => t.name === 'Sunita Verma' || t.portalRole === 'TEACHER');
    assert(!!teacher, `Target teacher found: ${teacher.name} (${teacher.id})`);

    // Pick an active class and section (e.g., Class 1, Section A)
    const targetClass1 = activeClasses.find((c: any) => c.name === 'Class 1') || activeClasses[0];
    const targetSec1 = targetClass1.sections?.[0] || 'A';
    console.log(`  Assigning teacher to: ${targetClass1.name} - Section ${targetSec1}`);

    // 3. Update Teacher Assignment via PUT /api/teachers/:id
    console.log('\n--- 3. Testing Teacher Class Assignment & MongoDB Persistence ---');
    const updatePayload = {
      classTeacherOf: `${targetClass1.name}-${targetSec1}`,
      teachingProfile: {
        assignedClassId: targetClass1.id,
        assignedClassName: targetClass1.name,
        assignedSection: targetSec1,
        isClassTeacher: true,
        academicDepartment: 'Academics',
        teachingWorkloadPeriods: 24,
      },
      assignedClasses: [`${targetClass1.name}-${targetSec1}`],
    };

    const updateRes = await fetch(`${BASE_URL}/api/teachers/${teacher.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    assert(updateRes.ok, `PUT /api/teachers/${teacher.id} succeeded (HTTP ${updateRes.status})`);
    const updatedTeacher = await updateRes.json();
    assert(
      updatedTeacher.classTeacherOf === `${targetClass1.name}-${targetSec1}`,
      `Teacher classTeacherOf set to ${updatedTeacher.classTeacherOf}`
    );
    assert(
      updatedTeacher.teachingProfile?.assignedClassId === targetClass1.id,
      `Teaching profile assignedClassId matches ${targetClass1.id}`
    );

    // Verify persistence directly in MongoDB Atlas / persistentStorage
    await persistentStorage.initialize();
    const storedStaff = await persistentStorage.loadStaff();
    const verifiedTeacher = storedStaff.find((s: any) => s.id === teacher.id);
    assert(
      verifiedTeacher?.classTeacherOf === `${targetClass1.name}-${targetSec1}`,
      `Verified MongoDB persistence: classTeacherOf === "${verifiedTeacher?.classTeacherOf}"`
    );

    // 4. Test Teacher Assigned Classes & Defaulting Endpoint (/api/attendance/assigned-classes)
    console.log('\n--- 4. Testing Attendance Default Class & Section Selection ---');
    // Login as teacher or simulate teacher session
    const authHeaders = {
      'x-auth-user-id': teacher.id,
      'x-auth-user-role': 'TEACHER',
      'x-auth-employee-id': teacher.employeeId || '',
    };

    const assignedRes = await fetch(`${BASE_URL}/api/attendance/assigned-classes`, {
      headers: authHeaders,
    });
    assert(assignedRes.ok, `/api/attendance/assigned-classes returned 200`);
    const assignedData = await assignedRes.json();
    assert(assignedData.allAccess === false, `Teacher allAccess is strictly false`);
    assert(
      assignedData.defaultClassId === targetClass1.id,
      `Default class automatically set to assigned class: ${assignedData.defaultClassId}`
    );
    assert(
      assignedData.defaultSection === targetSec1,
      `Default section automatically set to assigned section: ${assignedData.defaultSection}`
    );
    assert(
      assignedData.classes.some((c: any) => c.classId === targetClass1.id),
      `Assigned classes list contains ${targetClass1.name}`
    );

    // Ensure inactive classes are never returned in assignedData
    if (inactiveClass) {
      assert(
        !assignedData.classes.some((c: any) => c.classId === inactiveClass.id),
        `Inactive class ${inactiveClass.id} is excluded from teacher classes`
      );
    }

    // 5. Test Dynamic Student Loading from MongoDB for Selected Class & Section
    console.log('\n--- 5. Testing Dynamic Student Loading for Class & Section ---');
    const studentsRes = await fetch(`${BASE_URL}/api/students?classId=${targetClass1.id}&section=${targetSec1}&limit=100`, {
      headers: authHeaders,
    });
    assert(studentsRes.ok, `GET /api/students returned 200`);
    const studentsJson = await studentsRes.json();
    const enrolledStudents = studentsJson.data || [];
    assert(
      enrolledStudents.length > 0,
      `Loaded ${enrolledStudents.length} active students enrolled in ${targetClass1.name} Section ${targetSec1}`
    );
    const sampleStudent = enrolledStudents[0];
    console.log(`  Sample Student: ${sampleStudent.name} (ID: ${sampleStudent.id}, Roll: ${sampleStudent.rollNumber})`);

    // 6. Test Teacher Attendance Saving & Upsert to MongoDB
    console.log('\n--- 6. Testing Attendance Save & MongoDB Persistence ---');
    const testDate = '2026-10-14';
    const testRecords = enrolledStudents.map((s: any, idx: number) => ({
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      status: idx === 0 ? 'ABSENT' : 'PRESENT',
      remarks: idx === 0 ? 'Medical leave requested' : 'Regular on time',
    }));

    const saveAttendanceRes = await fetch(`${BASE_URL}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        date: testDate,
        classId: targetClass1.id,
        section: targetSec1,
        records: testRecords,
      }),
    });
    assert(saveAttendanceRes.ok, `POST /api/attendance succeeded (HTTP ${saveAttendanceRes.status})`);
    const saveJson = await saveAttendanceRes.json();
    assert(saveJson.success === true, `Attendance save returned success: true`);
    assert(saveJson.count === testRecords.length, `Attendance saved for ${saveJson.count} students`);

    // 7. Verify Attendance Fetch & Duplicate Prevention
    console.log('\n--- 7. Testing Existing Attendance Loading & Duplicate Prevention ---');
    const fetchAttRes = await fetch(
      `${BASE_URL}/api/attendance?classId=${targetClass1.id}&section=${targetSec1}&date=${testDate}`,
      { headers: authHeaders }
    );
    assert(fetchAttRes.ok, `GET /api/attendance for ${testDate} returned 200`);
    const fetchedRecords = await fetchAttRes.json();
    assert(
      fetchedRecords.length === testRecords.length,
      `Fetched exactly ${fetchedRecords.length} records (No duplicates created)`
    );
    const absRec = fetchedRecords.find((r: any) => r.studentId === sampleStudent.id);
    assert(absRec?.status === 'ABSENT', `Student ${sampleStudent.name} loaded with status ABSENT`);
    assert(absRec?.remarks === 'Medical leave requested', `Remarks correctly loaded: "${absRec?.remarks}"`);

    // 8. Test Editing / Upserting Existing Attendance
    console.log('\n--- 8. Testing Attendance Update / Upsert ---');
    const updatedRecords = fetchedRecords.map((r: any) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.studentName,
      rollNumber: r.rollNumber,
      status: 'PRESENT', // Changed from ABSENT to PRESENT
      remarks: r.studentId === sampleStudent.id ? 'Attended late with note' : r.remarks,
    }));

    const updateAttRes = await fetch(`${BASE_URL}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        date: testDate,
        classId: targetClass1.id,
        section: targetSec1,
        records: updatedRecords,
      }),
    });
    assert(updateAttRes.ok, `Update attendance succeeded`);

    // Re-query to verify updated data persists
    const refetchAttRes = await fetch(
      `${BASE_URL}/api/attendance?classId=${targetClass1.id}&section=${targetSec1}&date=${testDate}`,
      { headers: authHeaders }
    );
    const refetchedRecords = await refetchAttRes.json();
    assert(
      refetchedRecords.length === testRecords.length,
      `Re-fetched count remains ${refetchedRecords.length} (no duplicates after update)`
    );
    const updatedRec = refetchedRecords.find((r: any) => r.studentId === sampleStudent.id);
    assert(
      updatedRec?.status === 'PRESENT',
      `Updated status correctly persisted as PRESENT (was ABSENT)`
    );
    assert(
      updatedRec?.remarks === 'Attended late with note',
      `Updated remarks correctly persisted: "${updatedRec?.remarks}"`
    );

    // 9. Test Assignment Change Updates Attendance Default Automatically
    console.log('\n--- 9. Testing Re-assignment Updates Attendance Defaults Automatically ---');
    const targetClass2 = activeClasses.find((c: any) => c.name === 'Class 2' || c.id === 'c-2') || activeClasses[1];
    const targetSec2 = 'B';
    console.log(`  Re-assigning teacher to: ${targetClass2.name} - Section ${targetSec2}`);

    const reassignRes = await fetch(`${BASE_URL}/api/teachers/${teacher.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classTeacherOf: `${targetClass2.name}-${targetSec2}`,
        teachingProfile: {
          assignedClassId: targetClass2.id,
          assignedClassName: targetClass2.name,
          assignedSection: targetSec2,
          isClassTeacher: true,
          academicDepartment: 'Academics',
          teachingWorkloadPeriods: 26,
        },
        assignedClasses: [`${targetClass2.name}-${targetSec2}`],
      }),
    });
    assert(reassignRes.ok, `Teacher re-assignment updated`);

    // Verify /api/attendance/assigned-classes immediately reflects new default
    const reassignedCheck = await fetch(`${BASE_URL}/api/attendance/assigned-classes`, {
      headers: authHeaders,
    });
    const reassignedData = await reassignedCheck.json();
    assert(
      reassignedData.defaultClassId === targetClass2.id,
      `Default class automatically switched to new assignment: ${reassignedData.defaultClassId} (${targetClass2.name})`
    );
    assert(
      reassignedData.defaultSection === targetSec2,
      `Default section automatically switched to new assignment: ${reassignedData.defaultSection}`
    );

    // 10. Test Strict Unauthorized Class Access Enforcement
    console.log('\n--- 10. Testing Strict Unauthorized Attendance Access Security ---');
    // Find an active class that is NOT assigned to this teacher
    const assignedClassIds = (reassignedData.classes || []).map((c: any) => c.classId);
    const unauthorizedClass = activeClasses.find(
      (c: any) => !assignedClassIds.includes(c.id) && (c.status || 'ACTIVE') === 'ACTIVE'
    );
    assert(!!unauthorizedClass, `Identified unassigned test class: ${unauthorizedClass?.name} (${unauthorizedClass?.id})`);
    const unauthorizedRes = await fetch(`${BASE_URL}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        date: testDate,
        classId: unauthorizedClass.id,
        section: 'A',
        records: [{ studentId: 'unauthorized-id', status: 'PRESENT' }],
      }),
    });
    assert(
      unauthorizedRes.status === 403,
      `Unauthorized POST /api/attendance for unassigned class blocked with HTTP 403 Forbidden`
    );

    const unauthorizedGetRes = await fetch(
      `${BASE_URL}/api/attendance?classId=${unauthorizedClass.id}&section=A&date=${testDate}`,
      { headers: authHeaders }
    );
    assert(
      unauthorizedGetRes.status === 403,
      `Unauthorized GET /api/attendance for unassigned class blocked with HTTP 403 Forbidden`
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\n=== VERIFICATION SUMMARY ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed === 0) {
    console.log('ALL TESTS PASSED SUCCESSFULLY! (100%)\n');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests();
