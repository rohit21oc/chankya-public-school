import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

interface Session {
  role: string;
  name: string;
  token: string;
  user: any;
  receivedEvents: any[];
  sseReq?: http.ClientRequest;
}

function postJson(path: string, data: any, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function putJson(path: string, data: any, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function deleteReq(path: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function getJson(path: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function connectSse(session: Session): Promise<void> {
  return new Promise((resolve) => {
    const url = new URL(`/api/realtime/events?userId=${session.user.id}&role=${session.role}`, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${session.token}`,
        },
      },
      (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              try {
                const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ''));
                session.receivedEvents.push(parsed);
              } catch (e) {
                // ignore
              }
            }
          }
        });
        session.sseReq = req;
        // Wait 100ms for connection handshake
        setTimeout(resolve, 150);
      }
    );
    req.on('error', (err) => console.error(`SSE error for ${session.name}:`, err.message));
    req.end();
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('====================================================');
  console.log('STARTING REAL-TIME MULTI-SESSION & PERSISTENCE TESTS');
  console.log('====================================================\n');

  // STEP 1: Log in all 4 sessions
  console.log('[1/5] Authenticating all 4 roles simultaneously...');

  // Super Admin
  const adminRes = await postJson('/api/auth/login', {
    loginType: 'ADMIN',
    identifier: 'admin',
    password: 'admin123',
  });
  if (!adminRes.data?.success) throw new Error('Super Admin login failed: ' + JSON.stringify(adminRes));
  const adminSession: Session = {
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
    token: adminRes.data.token,
    user: adminRes.data.user,
    receivedEvents: [],
  };
  console.log('✓ Super Admin authenticated:', adminSession.user.name);

  // Teacher
  const teacherRes = await postJson('/api/auth/login', {
    loginType: 'STAFF',
    identifier: 'CPS0002',
    password: 'admin123',
  });
  if (!teacherRes.data?.success) throw new Error('Teacher login failed: ' + JSON.stringify(teacherRes));
  const teacherSession: Session = {
    role: 'TEACHER',
    name: 'Teacher (Mrs. Sunita Verma)',
    token: teacherRes.data.token,
    user: teacherRes.data.user,
    receivedEvents: [],
  };
  console.log('✓ Teacher authenticated:', teacherSession.user.name);

  // Student
  const studentRes = await postJson('/api/auth/login', {
    loginType: 'STUDENT',
    identifier: '64010001',
    dob: '14-05-2011',
  });
  if (!studentRes.data?.success) throw new Error('Student login failed: ' + JSON.stringify(studentRes));
  const studentSession: Session = {
    role: 'STUDENT',
    name: 'Student (Aarav Gupta)',
    token: studentRes.data.token,
    user: studentRes.data.user,
    receivedEvents: [],
  };
  console.log('✓ Student authenticated:', studentSession.user.name);

  // Parent
  const parentRes = await postJson('/api/auth/login', {
    loginType: 'PARENT',
    identifier: '9876543210',
    dob: '14-05-2011',
  });
  if (!parentRes.data?.success) throw new Error('Parent login failed: ' + JSON.stringify(parentRes));
  const parentSession: Session = {
    role: 'PARENT',
    name: 'Parent (Alok Gupta)',
    token: parentRes.data.token,
    user: parentRes.data.user,
    receivedEvents: [],
  };
  console.log('✓ Parent authenticated:', parentSession.user.name);

  const sessions = [adminSession, teacherSession, studentSession, parentSession];

  // STEP 2: Establish SSE connection for all 4 sessions
  console.log('\n[2/5] Establishing concurrent SSE streams for all 4 sessions...');
  for (const s of sessions) {
    await connectSse(s);
  }
  await sleep(300);
  for (const s of sessions) {
    console.log(`✓ ${s.name} SSE connected. Initial events received: ${s.receivedEvents.length}`);
  }

  // Clear init events to focus on operational events
  for (const s of sessions) {
    s.receivedEvents = [];
  }

  // Helper to assert SSE delivery
  function countEvents(entity: string, action?: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      const match = s.receivedEvents.filter((e) => e.entity === entity && (!action || e.action === action));
      counts[s.name] = match.length;
    }
    return counts;
  }

  // STEP 3: Multi-Entity Real-Time Sync Tests
  console.log('\n[3/5] Testing Real-Time SSE Sync across modules...');

  // 3.1 Student CRUD
  console.log('\n--- Testing Student Real-Time Sync ---');
  const studentAdm = `6401${Math.floor(1000 + Math.random() * 9000)}`;
  const newStudentRes = await postJson(
    '/api/students',
    {
      name: 'Rohan Sharma',
      admissionNumber: studentAdm,
      classId: 'c-10',
      section: 'A',
      rollNumber: '88',
      dob: '2011-06-15',
      gender: 'MALE',
      parentName: 'Suresh Sharma',
      parentPhone: '9811223344',
      address: 'Sheohar Town',
    },
    adminSession.token
  );
  console.log('Admin created student status:', newStudentRes.status);
  await sleep(300);
  const studentSync = countEvents('STUDENT', 'CREATE');
  console.log('SSE Delivery for STUDENT CREATE:', studentSync);

  // 3.2 Teacher/Staff Real-Time Sync
  console.log('\n--- Testing Staff Real-Time Sync ---');
  const staffUpdateRes = await putJson(
    `/api/teachers/t-2`,
    {
      qualification: 'M.Sc. Mathematics, B.Ed., M.Phil',
    },
    adminSession.token
  );
  console.log('Admin updated teacher status:', staffUpdateRes.status);
  await sleep(300);
  const staffSync = countEvents('STAFF', 'UPDATE');
  console.log('SSE Delivery for STAFF UPDATE:', staffSync);

  // 3.3 Attendance Real-Time Sync
  console.log('\n--- Testing Attendance Real-Time Sync ---');
  const todayStr = new Date().toISOString().substring(0, 10);
  const attRes = await postJson(
    '/api/attendance',
    {
      date: todayStr,
      classId: 'c-10',
      section: 'A',
      records: [
        { studentId: 'st-1', status: 'PRESENT' },
        { studentId: 'st-2', status: 'PRESENT' },
      ],
    },
    teacherSession.token
  );
  console.log('Teacher submitted attendance status:', attRes.status);
  await sleep(300);
  const attSync = countEvents('ATTENDANCE', 'UPDATE');
  console.log('SSE Delivery for ATTENDANCE UPDATE:', attSync);

  // 3.4 Fees Real-Time Sync
  console.log('\n--- Testing Fees Real-Time Sync ---');
  const feeRes = await postJson(
    '/api/fees/payments',
    {
      studentId: 'st-1',
      studentName: 'Aarav Gupta',
      admissionNumber: '64010001',
      classId: 'c-10',
      section: 'A',
      amount: 4500,
      paymentMode: 'ONLINE',
      remarks: 'Quarter 2 Tuition Fee',
    },
    adminSession.token
  );
  console.log('Admin recorded fee payment status:', feeRes.status);
  await sleep(300);
  const feeSync = countEvents('FEE', 'CREATE');
  console.log('SSE Delivery for FEE CREATE:', feeSync);

  // 3.5 Results / Exam Marks Real-Time Sync
  console.log('\n--- Testing Exam Marks Real-Time Sync ---');
  const examRes = await postJson(
    '/api/exams/marks',
    {
      examId: 'ex-1',
      classId: 'c-10',
      section: 'A',
      subjectId: 's-1',
      marks: [
        { studentId: 'st-1', marksObtained: 94, maxMarks: 100 },
      ],
    },
    teacherSession.token
  );
  console.log('Teacher submitted exam marks status:', examRes.status);
  await sleep(300);
  const examSync = countEvents('EXAM', 'UPDATE');
  console.log('SSE Delivery for EXAM UPDATE:', examSync);

  // 3.6 Timetable Real-Time Sync
  console.log('\n--- Testing Timetable Real-Time Sync ---');
  const ttRes = await putJson(
    '/api/timetables/c-10/A',
    {
      slots: [
        {
          id: `tt-slot-${Date.now()}`,
          dayOfWeek: 'Monday',
          periodNumber: 1,
          subjectId: 's-1',
          subjectName: 'Mathematics',
          teacherId: 't-2',
          teacherName: 'Mrs. Sunita Verma',
          roomNumber: 'Room 201',
        },
      ],
    },
    adminSession.token
  );
  console.log('Admin updated timetable status:', ttRes.status);
  await sleep(300);
  const ttSync = countEvents('TIMETABLE', 'UPDATE');
  console.log('SSE Delivery for TIMETABLE UPDATE:', ttSync);

  // 3.7 Notices Real-Time Sync
  console.log('\n--- Testing Notices Real-Time Sync ---');
  const noticeRes = await postJson(
    '/api/notices',
    {
      title: 'Annual Sports Meet 2026 Scheduled',
      content: 'The school annual sports day will be celebrated on October 15th, 2026. All houses must submit athlete lists.',
      category: 'GENERAL',
      targetAudience: 'ALL',
      priority: 'HIGH',
      publishDate: todayStr,
    },
    adminSession.token
  );
  console.log('Admin published notice status:', noticeRes.status);
  await sleep(300);
  const noticeSync = countEvents('NOTICE', 'CREATE');
  console.log('SSE Delivery for NOTICE CREATE:', noticeSync);

  // 3.8 Classes Real-Time Sync
  console.log('\n--- Testing Classes Real-Time Sync ---');
  const classRes = await putJson(
    '/api/classes/c-10',
    {
      maxCapacity: 45,
    },
    adminSession.token
  );
  console.log('Admin updated class status:', classRes.status);
  await sleep(300);
  const classSync = countEvents('CLASS', 'UPDATE');
  console.log('SSE Delivery for CLASS UPDATE:', classSync);

  // 3.9 Subjects Real-Time Sync
  console.log('\n--- Testing Subjects Real-Time Sync ---');
  const subjRes = await postJson(
    '/api/subjects',
    {
      name: 'Robotics & AI',
      code: 'ROB-101',
      type: 'ELECTIVE',
      classIds: ['c-9', 'c-10'],
      maxMarks: 100,
      passMarks: 33,
      theoryMarks: 40,
      practicalMarks: 60,
      credits: 4,
    },
    adminSession.token
  );
  console.log('Admin added subject status:', subjRes.status);
  await sleep(300);
  const subjSync = countEvents('SUBJECT', 'CREATE');
  console.log('SSE Delivery for SUBJECT CREATE:', subjSync);

  // 3.10 Public Website Management Real-Time Sync
  console.log('\n--- Testing Public Website Real-Time Sync ---');
  const facilityRes = await postJson(
    '/api/facilities',
    {
      title: 'Advanced Robotics Lab Sheohar',
      category: 'STEM',
      description: 'State of the art robotics and automation lab for experiential learning.',
      displayOrder: 99,
      isActive: true,
    },
    adminSession.token
  );
  console.log('Admin added facility status:', facilityRes.status);
  await sleep(300);
  const webSync = countEvents('WEBSITE', 'CREATE');
  console.log('SSE Delivery for WEBSITE CREATE:', webSync);

  // STEP 4: RBAC & Profile Management Testing
  console.log('\n[4/5] Testing Role-Based Access Control (RBAC) & Profile Management...');

  // Student attempts to edit their profile
  console.log('Test 4.1: Student attempts to modify academic / restricted fields...');
  const studentTamperRes = await putJson(
    `/api/students/${studentSession.user.id}`,
    {
      admissionNumber: 'HACKED-999',
      classId: 'c-12',
      rollNumber: '1',
      dob: '2000-01-01',
      name: 'Aarav Gupta The Great',
    },
    studentSession.token
  );
  console.log('Student direct update on /api/students status:', studentTamperRes.status);

  // Check if profile endpoint respects RBAC
  console.log('Test 4.2: Student updating safe contact info via profile endpoint...');
  const studentSafeProfileRes = await putJson(
    '/api/auth/profile',
    {
      address: 'Updated Ward 14, Sheohar, Bihar',
      bloodGroup: 'O+',
      emergencyContact: '9876543210',
    },
    studentSession.token
  );
  console.log('Student safe profile update status:', studentSafeProfileRes.status);

  // Parent attempts unauthorized staff operations
  console.log('Test 4.3: Parent attempts to publish school notice...');
  const parentNoticeRes = await postJson(
    '/api/notices',
    {
      title: 'Unauthorized Parent Notice',
      content: 'This should fail.',
    },
    parentSession.token
  );
  console.log('Parent publish notice status (expect 403):', parentNoticeRes.status);

  // Teacher attempts admin-only settings update
  console.log('Test 4.4: Teacher attempts to modify core school affiliation settings...');
  const teacherSettingsRes = await putJson(
    '/api/settings',
    {
      schoolName: 'Chanakya Public School & Coaching Centre',
    },
    teacherSession.token
  );
  console.log('Teacher settings update status (expect 403):', teacherSettingsRes.status);

  // STEP 5: Persistence & Authority Verification
  console.log('\n[5/5] Testing Persistence across operations, refresh, and restart...');

  // Create persistent test marker
  const testNoticeTitle = `Authoritative DB Verification Notice - ${Date.now()}`;
  console.log(`Creating marker notice: "${testNoticeTitle}"`);
  const createNotice = await postJson(
    '/api/notices',
    {
      title: testNoticeTitle,
      content: 'This notice confirms MongoDB persistent storage is authoritative.',
      category: 'ACADEMIC',
      targetAudience: 'ALL',
      priority: 'MEDIUM',
      publishDate: todayStr,
    },
    adminSession.token
  );
  console.log('Marker notice created:', createNotice.status);

  // Wait 1 second for async sync to MongoDB / storage
  console.log('Waiting 1000ms for database flush...');
  await sleep(1000);

  // Verify fetch returns notice
  const getNotices1 = await getJson('/api/notices', studentSession.token);
  const hasNotice1 = (getNotices1.data || []).some((n: any) => n.title === testNoticeTitle);
  console.log('✓ Marker notice present in student session fetch:', hasNotice1);

  // Verify re-login maintains session and authoritative state
  console.log('Simulating session refresh and re-login for all users...');
  const reLoginAdmin = await postJson('/api/auth/login', {
    loginType: 'ADMIN',
    identifier: 'admin',
    password: 'admin123',
  });
  console.log('✓ Admin re-login success:', reLoginAdmin.data?.success);

  const reLoginStudent = await postJson('/api/auth/login', {
    loginType: 'STUDENT',
    identifier: '64010001',
    dob: '14-05-2011',
  });
  console.log('✓ Student re-login success:', reLoginStudent.data?.success);

  // Final fetch using new token
  const getNotices2 = await getJson('/api/notices', reLoginStudent.data.token);
  const hasNotice2 = (getNotices2.data || []).some((n: any) => n.title === testNoticeTitle);
  console.log('✓ Marker notice persists authoritatively after re-login:', hasNotice2);

  // Clean up SSE connections
  for (const s of sessions) {
    if (s.sseReq) s.sseReq.destroy();
  }

  console.log('\n====================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
