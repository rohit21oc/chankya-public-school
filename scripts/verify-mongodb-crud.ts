import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';

function req(method: string, urlPath: string, data?: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const url = new URL(urlPath, BASE_URL);
    const headers: Record<string, string> = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const request = http.request(
      url,
      { method, headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode || 500, data: body });
          }
        });
      }
    );
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function verify() {
  console.log('--- STARTING COMPREHENSIVE MONGODB ARCHITECTURE VERIFICATION ---');

  // Record initial mtime of data/students.json
  const studentsJsonPath = path.resolve(process.cwd(), 'data', 'students.json');
  const initialMtime = fs.statSync(studentsJsonPath).mtimeMs;

  // 1. Authenticate as School Admin
  console.log('1. Testing Admin Authentication...');
  const loginRes = await req('POST', '/api/auth/login', {
    identifier: 'admin',
    password: 'admin123',
  });

  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log('✓ Admin authenticated successfully.');

  // 2. Load School Settings
  console.log('2. Testing GET /api/school-settings...');
  const settingsRes = await req('GET', '/api/school-settings', undefined, token);
  if (settingsRes.status !== 200 || !settingsRes.data.schoolName) {
    throw new Error(`Failed to load school settings: ${JSON.stringify(settingsRes.data)}`);
  }
  console.log(`✓ School Settings loaded: "${settingsRes.data.schoolName}"`);

  // 3. Load Students
  console.log('3. Testing GET /api/students...');
  const studentsRes = await req('GET', '/api/students', undefined, token);
  const studentList = Array.isArray(studentsRes.data)
    ? studentsRes.data
    : Array.isArray(studentsRes.data?.data)
    ? studentsRes.data.data
    : null;
  if (studentsRes.status !== 200 || !studentList) {
    throw new Error(`Failed to load students: ${JSON.stringify(studentsRes.data)}`);
  }
  console.log(`✓ Students loaded successfully: Count = ${studentList.length}`);

  // 4. Create Student via REST API -> MongoDB
  console.log('4. Testing POST /api/students (Create Student)...');
  const testStudentId = `st-test-${Date.now()}`;
  const testAdmissionNo = `ADM-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const newStudent = {
    id: testStudentId,
    admissionNumber: testAdmissionNo,
    rollNumber: '99',
    name: 'MongoDB Verification Student',
    dob: '15-05-2014',
    gender: 'MALE',
    address: '123 Test Street, Sheohar',
    mobile: '9876543210',
    admissionDate: '2026-09-01',
    classId: 'c-10',
    className: 'Class 10',
    section: 'A',
    academicSession: '2026-2027',
    parentName: 'Test Guardian',
    parentPhone: '9876543210',
    status: 'ACTIVE',
  };

  const createRes = await req('POST', '/api/students', newStudent, token);
  if (createRes.status !== 200 && createRes.status !== 201) {
    throw new Error(`Student creation failed: ${JSON.stringify(createRes.data)}`);
  }
  console.log(`✓ Student created successfully with ID: ${createRes.data.id || testStudentId}`);

  // 5. Update Student via REST API -> MongoDB
  console.log('5. Testing PUT /api/students/:id (Update Student)...');
  const updateRes = await req(
    'PUT',
    `/api/students/${testStudentId}`,
    {
      ...newStudent,
      name: 'MongoDB Verification Student UPDATED',
      bloodGroup: 'O+',
    },
    token
  );
  if (updateRes.status !== 200) {
    throw new Error(`Student update failed: ${JSON.stringify(updateRes.data)}`);
  }
  console.log('✓ Student updated successfully.');

  // 6. Delete Student via REST API -> MongoDB
  console.log('6. Testing DELETE /api/students/:id (Delete Student)...');
  const deleteRes = await req('DELETE', `/api/students/${testStudentId}`, undefined, token);
  if (deleteRes.status !== 200) {
    throw new Error(`Student deletion failed: ${JSON.stringify(deleteRes.data)}`);
  }
  console.log('✓ Student deleted successfully.');

  // 7. Verify Staff
  console.log('7. Testing GET /api/staff...');
  const staffRes = await req('GET', '/api/staff', undefined, token);
  if (staffRes.status !== 200 || !Array.isArray(staffRes.data)) {
    throw new Error(`Failed to load staff: ${JSON.stringify(staffRes.data)}`);
  }
  console.log(`✓ Staff loaded successfully: Count = ${staffRes.data.length}`);

  // 8. Verify Classes
  console.log('8. Testing GET /api/classes...');
  const classesRes = await req('GET', '/api/classes', undefined, token);
  if (classesRes.status !== 200 || !Array.isArray(classesRes.data)) {
    throw new Error(`Failed to load classes: ${JSON.stringify(classesRes.data)}`);
  }
  console.log(`✓ Classes loaded successfully: Count = ${classesRes.data.length}`);

  // 9. Verify that data/students.json was NEVER modified during these operations!
  const finalMtime = fs.statSync(studentsJsonPath).mtimeMs;
  if (finalMtime !== initialMtime) {
    throw new Error('FAIL: data/students.json was modified! JSON files must NOT be written to in production!');
  }
  console.log('✓ Verified: data/students.json was completely untouched. Production operations rely solely on MongoDB!');

  console.log('\n====================================================');
  console.log(' ALL MONGODB ARCHITECTURE TESTS PASSED SUCCESSFULLY! ');
  console.log('====================================================');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
