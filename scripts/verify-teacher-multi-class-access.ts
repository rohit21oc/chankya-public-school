import { persistentStorage } from '../server/storage/persistentStorage.ts';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING TEACHER MULTI-CLASS QUALIFICATION & ACCESS VERIFICATION ===\n');
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
    // 1. Load active classes
    console.log('\n--- 1. Testing Active Classes Loading ---');
    const classesRes = await fetch(`${BASE_URL}/api/classes`);
    const allClasses = await classesRes.json();
    assert(Array.isArray(allClasses) && allClasses.length > 0, `Loaded ${allClasses.length} total classes`);
    const activeClasses = allClasses.filter((c: any) => (c.status || 'ACTIVE') === 'ACTIVE');
    assert(activeClasses.length >= 3, `Found ${activeClasses.length} active classes for testing`);

    // Identify at least 2 qualified classes and 1 unselected class
    const qualifiedClass1 = activeClasses.find((c: any) => c.name === 'Class 9') || activeClasses[0];
    const qualifiedClass2 = activeClasses.find((c: any) => c.name === 'Class 10') || activeClasses[1];
    const unselectedClass = activeClasses.find(
      (c: any) => c.id !== qualifiedClass1.id && c.id !== qualifiedClass2.id
    ) || activeClasses[2];

    console.log(`  Target Qualified Class 1: ${qualifiedClass1.name} (${qualifiedClass1.id})`);
    console.log(`  Target Qualified Class 2: ${qualifiedClass2.name} (${qualifiedClass2.id})`);
    console.log(`  Target Unselected Class:  ${unselectedClass.name} (${unselectedClass.id})`);

    // 2. Locate or identify teacher for testing
    console.log('\n--- 2. Setting Up Test Teacher ---');
    const teachersRes = await fetch(`${BASE_URL}/api/teachers`);
    const teachers = await teachersRes.json();
    assert(Array.isArray(teachers) && teachers.length > 0, `Loaded ${teachers.length} teachers`);

    let teacher = teachers.find((t: any) => t.portalRole === 'TEACHER' || t.role === 'TEACHER');
    if (!teacher) teacher = teachers[0];
    assert(!!teacher, `Target teacher identified: ${teacher.name} (${teacher.id})`);

    // 3. Update Teacher with Multiple Classes Qualified to Teach
    console.log('\n--- 3. Persisting Multiple Qualified Classes to MongoDB ---');
    const updatePayload = {
      classesQualifiedToTeach: `${qualifiedClass1.name}, ${qualifiedClass2.name}`,
      qualifiedClasses: [qualifiedClass1.name, qualifiedClass2.name],
      assignedClasses: [],
      classTeacherOf: undefined,
      teachingProfile: {
        classesQualifiedToTeach: [qualifiedClass1.name, qualifiedClass2.name],
        assignedClassId: undefined,
        assignedClassName: undefined,
        assignedSection: undefined,
        isClassTeacher: false,
      },
    };

    const updateRes = await fetch(`${BASE_URL}/api/teachers/${teacher.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-user-role': 'SUPER_ADMIN',
        'x-auth-user-id': 'admin-1',
      },
      body: JSON.stringify(updatePayload),
    });
    assert(updateRes.ok, `PUT /api/teachers/${teacher.id} succeeded (HTTP ${updateRes.status})`);
    const updatedStaff = await updateRes.json();
    assert(
      updatedStaff.classesQualifiedToTeach?.includes(qualifiedClass1.name) &&
      updatedStaff.classesQualifiedToTeach?.includes(qualifiedClass2.name),
      `Staff record has updated classesQualifiedToTeach: "${updatedStaff.classesQualifiedToTeach}"`
    );

    // Verify persistence directly in persistentStorage
    await persistentStorage.initialize();
    const storedStaff = await persistentStorage.loadStaff();
    const verifiedStaff = storedStaff.find((s: any) => s.id === teacher.id);
    assert(
      verifiedStaff?.classesQualifiedToTeach?.includes(qualifiedClass1.name),
      `Verified MongoDB persistence of classesQualifiedToTeach in storage`
    );

    const teacherAuthHeaders = {
      'x-auth-user-id': teacher.id,
      'x-auth-user-role': 'TEACHER',
      'x-auth-employee-id': teacher.employeeId || '',
    };

    // 4. Test Authorized Classes Endpoint
    console.log('\n--- 4. Testing Teacher Authorized Classes Endpoints ---');
    const authAssignRes = await fetch(`${BASE_URL}/api/teacher/authorized-assignments`, {
      headers: teacherAuthHeaders,
    });
    assert(authAssignRes.ok, `GET /api/teacher/authorized-assignments returned 200`);
    const authAssignData = await authAssignRes.json();
    assert(authAssignData.allAccess === false, `Teacher allAccess is strictly false`);
    const assignedClassIds = authAssignData.classes.map((c: any) => c.classId);
    assert(
      assignedClassIds.includes(qualifiedClass1.id),
      `Authorized assignments include Qualified Class 1 (${qualifiedClass1.name})`
    );
    assert(
      assignedClassIds.includes(qualifiedClass2.id),
      `Authorized assignments include Qualified Class 2 (${qualifiedClass2.name})`
    );
    assert(
      !assignedClassIds.includes(unselectedClass.id),
      `Authorized assignments strictly exclude unselected Class (${unselectedClass.name})`
    );

    // 5. Test My Students Access & Scoping
    console.log('\n--- 5. Testing My Students Class Scoping & Access Control ---');
    // A. Query students without filter -> must only return authorized classes
    const myStudentsRes = await fetch(`${BASE_URL}/api/students?limit=100`, {
      headers: teacherAuthHeaders,
    });
    assert(myStudentsRes.ok, `GET /api/students returned 200 for teacher`);
    const myStudentsData = await myStudentsRes.json();
    const studentList = myStudentsData.data || [];
    assert(studentList.length > 0, `Returned ${studentList.length} scoped students for teacher`);

    const authorizedClassIds = new Set(authAssignData.classes.map((c: any) => c.classId));
    const authorizedClassNames = new Set(authAssignData.classes.map((c: any) => c.className.toLowerCase()));

    const hasOnlyPermittedClasses = studentList.every(
      (s: any) =>
        authorizedClassIds.has(s.classId) ||
        authorizedClassNames.has(s.className?.toLowerCase())
    );
    assert(hasOnlyPermittedClasses, `Every returned student belongs strictly to teacher's authorized/qualified classes`);

    // B. Query students for authorized Class 1 -> HTTP 200
    const q1StudentsRes = await fetch(`${BASE_URL}/api/students?classId=${qualifiedClass1.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(q1StudentsRes.ok, `GET /api/students for qualified ${qualifiedClass1.name} returned 200`);

    // C. Query students for authorized Class 2 -> HTTP 200
    const q2StudentsRes = await fetch(`${BASE_URL}/api/students?classId=${qualifiedClass2.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(q2StudentsRes.ok, `GET /api/students for qualified ${qualifiedClass2.name} returned 200`);

    // D. Query students for unselected class -> HTTP 403 Forbidden!
    const unselectedStudentsRes = await fetch(`${BASE_URL}/api/students?classId=${unselectedClass.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(
      unselectedStudentsRes.status === 403,
      `GET /api/students for unselected class ${unselectedClass.name} rejected with HTTP 403 Forbidden`
    );

    // E. Individual student access: find one student in qualified class, one in unselected class
    const adminStudentsRes = await fetch(`${BASE_URL}/api/students?limit=200`);
    const adminStudents = (await adminStudentsRes.json()).data || [];
    const studentInQualifiedClass = adminStudents.find(
      (s: any) => s.classId === qualifiedClass1.id || s.classId === qualifiedClass2.id
    );
    const studentInUnselectedClass = adminStudents.find((s: any) => s.classId === unselectedClass.id);

    if (studentInQualifiedClass) {
      const getQualifiedStuRes = await fetch(`${BASE_URL}/api/students/${studentInQualifiedClass.id}`, {
        headers: teacherAuthHeaders,
      });
      assert(
        getQualifiedStuRes.ok,
        `GET /api/students/:id for student in qualified class succeeded (HTTP ${getQualifiedStuRes.status})`
      );
    }

    if (studentInUnselectedClass) {
      const getUnselectedStuRes = await fetch(`${BASE_URL}/api/students/${studentInUnselectedClass.id}`, {
        headers: teacherAuthHeaders,
      });
      assert(
        getUnselectedStuRes.status === 403,
        `GET /api/students/:id for student in unselected class rejected with HTTP 403 Forbidden`
      );
    }

    // F. Attempt to modify student record as Teacher -> HTTP 403 Forbidden!
    if (studentInQualifiedClass) {
      const modifyStuRes = await fetch(`${BASE_URL}/api/students/${studentInQualifiedClass.id}`, {
        method: 'PUT',
        headers: {
          ...teacherAuthHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });
      assert(
        modifyStuRes.status === 403,
        `Teacher prohibited from modifying student record: HTTP ${modifyStuRes.status} Forbidden`
      );
    }

    // 6. Test Exam Marks Entry Access & Scoping
    console.log('\n--- 6. Testing Exam Marks Entry Scoping & Authorization ---');
    // A. Query marks for qualified Class 1 -> HTTP 200
    const q1MarksRes = await fetch(`${BASE_URL}/api/marks?classId=${qualifiedClass1.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(q1MarksRes.ok, `GET /api/marks for qualified class returned HTTP 200`);

    // B. Query marks for unselected class -> HTTP 403 Forbidden!
    const unselectedMarksRes = await fetch(`${BASE_URL}/api/marks?classId=${unselectedClass.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(
      unselectedMarksRes.status === 403,
      `GET /api/marks for unselected class ${unselectedClass.name} rejected with HTTP 403 Forbidden`
    );

    // C. Post marks for student in qualified class -> HTTP 200
    if (studentInQualifiedClass) {
      const postMarksPayload = {
        classId: studentInQualifiedClass.classId,
        section: studentInQualifiedClass.section || 'A',
        examId: 'exam-sample-unit',
        marksList: [
          {
            studentId: studentInQualifiedClass.id,
            studentName: studentInQualifiedClass.name,
            classId: studentInQualifiedClass.classId,
            section: studentInQualifiedClass.section || 'A',
            marksObtained: 85,
            maxMarks: 100,
            isAbsent: false,
            grade: 'A2',
          },
        ],
      };
      const postMarksRes = await fetch(`${BASE_URL}/api/exams/marks`, {
        method: 'POST',
        headers: {
          ...teacherAuthHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postMarksPayload),
      });
      assert(
        postMarksRes.ok,
        `POST /api/exams/marks for student in qualified class succeeded (HTTP ${postMarksRes.status})`
      );
    }

    // D. Post marks for student in unselected class -> HTTP 403 Forbidden!
    if (studentInUnselectedClass) {
      const postUnselectedMarksPayload = {
        classId: unselectedClass.id,
        section: studentInUnselectedClass.section || 'A',
        examId: 'exam-sample-unit',
        marksList: [
          {
            studentId: studentInUnselectedClass.id,
            studentName: studentInUnselectedClass.name,
            classId: unselectedClass.id,
            section: studentInUnselectedClass.section || 'A',
            marksObtained: 90,
            maxMarks: 100,
            isAbsent: false,
          },
        ],
      };
      const postUnselectedRes = await fetch(`${BASE_URL}/api/exams/marks`, {
        method: 'POST',
        headers: {
          ...teacherAuthHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postUnselectedMarksPayload),
      });
      assert(
        postUnselectedRes.status === 403,
        `POST /api/exams/marks for unselected class rejected with HTTP 403 Forbidden`
      );
    }

    // 7. Test Student Documents (Student ID Card Only)
    console.log('\n--- 7. Testing Student Documents & ID Card Authorization ---');
    if (studentInQualifiedClass) {
      const idCardRes = await fetch(`${BASE_URL}/api/students/${studentInQualifiedClass.id}/id-card`, {
        headers: teacherAuthHeaders,
      });
      assert(
        idCardRes.ok,
        `GET /api/students/:id/id-card for qualified student succeeded (HTTP ${idCardRes.status})`
      );
    }

    if (studentInUnselectedClass) {
      const unselectedIdCardRes = await fetch(`${BASE_URL}/api/students/${studentInUnselectedClass.id}/id-card`, {
        headers: teacherAuthHeaders,
      });
      assert(
        unselectedIdCardRes.status === 403,
        `GET /api/students/:id/id-card for unselected student rejected with HTTP 403 Forbidden`
      );
    }

    // 8. Test Academic Structure (Read-Only)
    console.log('\n--- 8. Testing Academic Structure Read-Only Scoping & Immutability ---');
    // A. Read classes list
    const teacherClassesRes = await fetch(`${BASE_URL}/api/classes`, {
      headers: teacherAuthHeaders,
    });
    assert(teacherClassesRes.ok, `GET /api/classes returned 200 for teacher`);
    const teacherClasses = await teacherClassesRes.json();
    const teacherCIds = teacherClasses.map((c: any) => c.id);
    assert(
      teacherCIds.includes(qualifiedClass1.id) && teacherCIds.includes(qualifiedClass2.id),
      `Teacher classes list includes both qualified classes (${qualifiedClass1.name}, ${qualifiedClass2.name})`
    );
    assert(
      !teacherCIds.includes(unselectedClass.id),
      `Teacher classes list strictly excludes unselected class (${unselectedClass.name})`
    );

    // B. Read single class details
    const getQClassRes = await fetch(`${BASE_URL}/api/classes/${qualifiedClass1.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(getQClassRes.ok, `GET /api/classes/:id for qualified class returned HTTP 200`);

    const getUnselectedClassRes = await fetch(`${BASE_URL}/api/classes/${unselectedClass.id}`, {
      headers: teacherAuthHeaders,
    });
    assert(
      getUnselectedClassRes.status === 403,
      `GET /api/classes/:id for unselected class rejected with HTTP 403 Forbidden`
    );

    // C. Verify Teachers CANNOT create, modify, or delete academic classes
    const createClassRes = await fetch(`${BASE_URL}/api/classes`, {
      method: 'POST',
      headers: {
        ...teacherAuthHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hacked Class', numericOrder: 99 }),
    });
    assert(
      createClassRes.status === 403,
      `Teacher prohibited from creating class: HTTP ${createClassRes.status} Forbidden`
    );

    const updateClassRes = await fetch(`${BASE_URL}/api/classes/${qualifiedClass1.id}`, {
      method: 'PUT',
      headers: {
        ...teacherAuthHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Modified Class Name' }),
    });
    assert(
      updateClassRes.status === 403,
      `Teacher prohibited from updating class: HTTP ${updateClassRes.status} Forbidden`
    );

    const deleteClassRes = await fetch(`${BASE_URL}/api/classes/${qualifiedClass1.id}`, {
      method: 'DELETE',
      headers: teacherAuthHeaders,
    });
    assert(
      deleteClassRes.status === 403,
      `Teacher prohibited from deleting class: HTTP ${deleteClassRes.status} Forbidden`
    );

    console.log(`\n=== VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
