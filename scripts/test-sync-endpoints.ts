import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

const syncEndpoints = [
  '/api/settings',
  '/api/students?limit=2000',
  '/api/teachers',
  '/api/classes',
  '/api/subjects',
  '/api/timetables',
  '/api/timetables/periods',
  '/api/attendance',
  '/api/staff-attendance',
  '/api/fees/structures',
  '/api/fees/payments',
  '/api/exams',
  '/api/marks',
  '/api/homework',
  '/api/notices',
  '/api/study-materials',
  '/api/hostels',
  '/api/transport',
  '/api/fee-configurations',
  '/api/transport-slabs',
  '/api/fee-ledgers',
  '/api/staff-leaves',
  '/api/staff-payroll',
  '/api/audit-logs?limit=500',
  '/api/admin/accounts',
  '/api/holidays',
];

function req(path: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    http.get(new URL(path, BASE_URL), (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 500, data: body });
        }
      });
    }).on('error', (e) => resolve({ status: 0, data: e.message }));
  });
}

async function run() {
  console.log('Testing all 26 sync endpoints as ANONYMOUS (unauthenticated):');
  for (const ep of syncEndpoints) {
    const res = await req(ep);
    const mark = res.status === 200 ? '✅ 200' : `❌ ${res.status}`;
    console.log(`${mark} ${ep} ->`, res.status !== 200 ? res.data : 'OK');
  }
}

run();
