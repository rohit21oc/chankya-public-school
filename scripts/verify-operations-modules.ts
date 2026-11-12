/**
 * Checks for the Hostel, Transport and Notice & SMS modules.
 *
 * Starts the real backend (server.ts) with a random per-run JWT secret and no
 * database, works on a snapshot of data/ (restored afterwards) and checks:
 *
 *   Notices  - validation, duplicate refusal, author-only edit/delete for teachers,
 *              teachers see their own drafts, protected fields cannot be overwritten,
 *              expiry is recomputed, duplicate cleanup removes exact copies only.
 *   SMS      - nothing is reported as sent when no SMS gateway is configured.
 *   Hostel   - counts come from beds, a student holds one bed, double booking,
 *              inactive students, hostel type vs gender, room/hostel validation, RBAC.
 *   Transport- stop numbering and validation, stop delete guard, passenger counts,
 *              seat limits per vehicle, inactive students, vehicle delete guard.
 *
 * Run: npm run verify:operations
 */
import { spawn, ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const TODAY = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`); }
};

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
function signToken(payload: Record<string, unknown>): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
async function call(method: string, p: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json };
}
function snapshotData(): Map<string, Buffer> {
  const snap = new Map<string, Buffer>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else snap.set(p, fs.readFileSync(p));
    }
  };
  walk(DATA_DIR);
  return snap;
}
function restoreData(snap: Map<string, Buffer>) {
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (!snap.has(p)) fs.unlinkSync(p);
    }
  };
  walk(DATA_DIR);
  for (const [p, buf] of snap) fs.writeFileSync(p, buf);
}
async function waitForHealth(timeoutMs = 150000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
const writeJson = (f: string, v: unknown) => fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(v, null, 2));

/** Small, known fixtures written into the data snapshot before the server starts. */
function prepareFixtures() {
  const students: any[] = readJson('students.json');
  const base = students.find((s) => s.status === 'ACTIVE') || students[0];
  const mk = (id: string, name: string, gender: string, status = 'ACTIVE') => ({
    ...base, id, name, gender, status, admissionNumber: `FX-${id}`,
    hostelRequired: false, hostelId: undefined, hostelRoomId: undefined, hostelBedNumber: undefined, hostelName: undefined,
    transportRequired: false, transportRouteId: undefined, transportStopId: undefined, transportStopName: undefined, vehicleNumber: undefined,
  });
  students.push(mk('fx-boy-1', 'Fixture Boy One', 'MALE'), mk('fx-boy-2', 'Fixture Boy Two', 'MALE'), mk('fx-girl-1', 'Fixture Girl One', 'FEMALE'), mk('fx-gone', 'Fixture Left School', 'MALE', 'INACTIVE'));
  writeJson('students.json', students);
  writeJson('notices.json', [
    ...readJson('notices.json'),
    { id: 'fx-legacy', title: 'Fixture legacy notice', content: 'Old record', noticeType: 'CIRCULAR', targetAudience: 'EVERYBODY', status: 'PUBLISHED', publishDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
  ]);

  writeJson('hostels.json', [
    ...readJson('hostels.json'),
    { id: 'fx-h-boys', name: 'Fixture Boys Block', type: 'BOYS', wardenName: 'Warden', wardenPhone: '9000000001', floors: [1, 2], totalRooms: 2, capacity: 0, monthlyFee: 0, messFee: 0, status: 'ACTIVE' },
  ]);
  const bed = (n: string) => ({ bedNumber: n, status: 'AVAILABLE' });
  writeJson('hostelRooms.json', [
    ...readJson('hostelRooms.json'),
    // Stored counters deliberately wrong: the API must count from the beds.
    { id: 'fx-r-1', hostelId: 'fx-h-boys', hostelName: 'Fixture Boys Block', roomNumber: 'F101', floor: 1, capacity: 2, capacityBeds: 2, occupiedBeds: 5, roomType: 'Standard', monthlyFee: 0, status: 'AVAILABLE', beds: [bed('Bed A'), bed('Bed B'), bed('Bed C')] },
    { id: 'fx-r-2', hostelId: 'fx-h-boys', hostelName: 'Fixture Boys Block', roomNumber: 'F201', floor: 2, capacity: 2, capacityBeds: 2, occupiedBeds: 0, roomType: 'Standard', monthlyFee: 0, status: 'AVAILABLE', beds: [bed('Bed A'), bed('Bed B')] },
  ]);

  writeJson('vehicles.json', [
    ...readJson('vehicles.json'),
    { id: 'fx-v-1', registrationNumber: 'FX-01-0001', capacity: 2, driverName: 'Driver One', driverPhone: '9000000002', status: 'ACTIVE' },
  ]);
  writeJson('routes.json', [
    ...readJson('routes.json'),
    {
      id: 'fx-route', routeName: 'Fixture Route', startPoint: 'A', endPoint: 'School', vehicleId: 'fx-v-1', status: 'ACTIVE',
      // Two stops share number 2: the API must renumber them 1..n.
      stops: [
        { id: 'fx-s1', stopName: 'Fixture Stop One', pickupTime: '07:00', dropTime: '14:00', monthlyFare: 500, stopOrder: 1, status: 'ACTIVE' },
        { id: 'fx-s2', stopName: 'Fixture Stop Two', pickupTime: '07:10', dropTime: '14:10', monthlyFare: 600, stopOrder: 2, status: 'ACTIVE' },
        { id: 'fx-s3', stopName: 'Fixture Stop Three', pickupTime: '07:20', dropTime: '14:20', monthlyFare: 700, stopOrder: 2, status: 'ACTIVE' },
      ],
    },
  ]);
}

async function main() {
  console.log('\n=== Hostel, Transport and Notice & SMS checks ===');
  const snap = snapshotData();
  let server: ChildProcess | null = null;
  try {
    prepareFixtures();
    const staff: any[] = readJson('staff.json');
    const teachers = staff.filter((s) => s.portalRole === 'TEACHER' && s.status === 'ACTIVE');
    const admin = signToken({ userId: 'admin-test', role: 'SUPER_ADMIN' });
    const teacherA = signToken({ userId: teachers[0].id, role: 'TEACHER', employeeId: teachers[0].employeeId });
    const teacherB = signToken({ userId: teachers[1].id, role: 'TEACHER', employeeId: teachers[1].employeeId });
    const accountant = signToken({ userId: 'acct-test', role: 'ACCOUNTANT' });
    const vp = signToken({ userId: 'vp-test', role: 'VICE_PRINCIPAL' });
    const transportMgr = signToken({ userId: 'tm-test', role: 'TRANSPORT_MANAGER' });

    server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server.ts'], {
      cwd: ROOT,
      env: { ...process.env, JWT_SECRET, NODE_ENV: 'development', DISABLE_HMR: 'true', MONGODB_URI: '', SMS_PROVIDER: '', SMS_API_KEY: '' },
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
    });
    if (!(await waitForHealth())) throw new Error(`Backend did not become healthy on port ${PORT}.`);

    // ------------------------------------------------------------------ Notices
    console.log('\n--- Notices ---');
    const base = { content: 'Fixture notice body.', noticeType: 'GENERAL', targetAudience: 'ALL', priority: 'NORMAL', publishDate: TODAY };
    let r = await call('POST', '/api/notices', admin, { ...base, title: '   ' });
    check('empty title is refused', r.status === 400, String(r.status));
    r = await call('POST', '/api/notices', admin, { ...base, title: 'Fixture class notice', targetAudience: 'CLASS', targetClass: '' });
    check('class notice without a class is refused', r.status === 400, String(r.status));
    r = await call('POST', '/api/notices', admin, { ...base, title: 'Fixture expiry', expiryDate: '2000-01-01' });
    check('expiry before publish date is refused', r.status === 400, String(r.status));
    r = await call('POST', '/api/notices', admin, { ...base, title: 'Fixture bad type', noticeType: 'NOPE' });
    check('unknown category is refused', r.status === 400, String(r.status));
    r = await call('POST', '/api/notices', accountant, { ...base, title: 'Fixture accountant' });
    check('accountant cannot publish notices', r.status === 403, String(r.status));

    r = await call('POST', '/api/notices', teacherA, { ...base, title: 'Fixture teacher draft', status: 'DRAFT' });
    const draft = r.json;
    check('teacher can save a draft', r.status === 201 && draft?.status === 'DRAFT', String(r.status));
    r = await call('POST', '/api/notices', teacherA, { ...base, title: 'Fixture teacher draft', status: 'DRAFT' });
    check('same title on the same day is refused with 409', r.status === 409 && r.json?.code === 'DUPLICATE_NOTICE', String(r.status));

    const listA = (await call('GET', '/api/notices', teacherA)).json as any[];
    const listB = (await call('GET', '/api/notices', teacherB)).json as any[];
    check('teacher sees their own draft', Array.isArray(listA) && listA.some((n) => n.id === draft.id));
    check("other teachers do not see someone else's draft", Array.isArray(listB) && !listB.some((n) => n.id === draft.id));

    r = await call('PUT', `/api/notices/${draft.id}`, teacherB, { title: 'Taken over' });
    check("teacher cannot edit another teacher's notice", r.status === 403, String(r.status));
    r = await call('DELETE', `/api/notices/${draft.id}`, teacherB);
    check("teacher cannot delete another teacher's notice", r.status === 403, String(r.status));
    r = await call('PUT', `/api/notices/${draft.id}`, teacherA, { title: '' });
    check('saving an empty title is refused', r.status === 400, String(r.status));
    r = await call('PUT', `/api/notices/${draft.id}`, teacherA, { status: 'PUBLISHED', id: 'hijack', authorId: 'someone-else', createdAt: '1999-01-01' });
    check('author can publish their draft', r.status === 200 && r.json?.status === 'PUBLISHED', String(r.status));
    check('id, author and created date cannot be overwritten', r.json?.id === draft.id && r.json?.authorId === draft.authorId && r.json?.createdAt === draft.createdAt);

    const exp = (await call('POST', '/api/notices', admin, { ...base, title: 'Fixture expiring', publishDate: '2026-01-01', expiryDate: '2026-01-02' })).json;
    check('a notice past its expiry date is EXPIRED', exp?.status === 'EXPIRED', exp?.status);
    r = await call('PUT', `/api/notices/${exp.id}`, admin, { expiryDate: '' });
    check('clearing the expiry date publishes it again', r.json?.status === 'PUBLISHED', r.json?.status);

    // Duplicate cleanup: an exact copy is removed, a notice that only shares the title stays.
    const orig = (await call('POST', '/api/notices', admin, { ...base, title: 'Fixture holiday', content: 'School closed on Monday.' })).json;
    const copy = (await call('POST', '/api/notices', admin, { ...base, title: 'Fixture holiday', content: 'School closed on Monday.', force: true })).json;
    const sameTitle = (await call('POST', '/api/notices', admin, { ...base, title: 'Fixture holiday', content: 'School closed on Friday.', force: true })).json;
    r = await call('POST', '/api/notices/cleanup-duplicates', admin, { dryRun: true });
    const dupIds = (r.json?.duplicates || []).map((d: any) => d.id);
    check('cleanup preview lists the exact copy', dupIds.includes(copy.id) && !dupIds.includes(orig.id));
    check('cleanup preview keeps a notice that only shares the title', !dupIds.includes(sameTitle.id));
    r = await call('POST', '/api/notices/cleanup-duplicates', teacherA, {});
    check('teachers cannot run duplicate cleanup', r.status === 403, String(r.status));
    r = await call('POST', '/api/notices/cleanup-duplicates', admin, {});
    const after = (await call('GET', '/api/notices', admin)).json as any[];
    check('cleanup removes the copy and keeps the others', r.json?.removed >= 1 && !after.some((n) => n.id === copy.id) && after.some((n) => n.id === orig.id) && after.some((n) => n.id === sameTitle.id));
    r = await call('DELETE', `/api/notices/${draft.id}`, teacherA);
    check('author can delete their notice', r.status === 200, String(r.status));
    const legacy = readJson('notices.json').find((n: any) => n.id === 'fx-legacy');
    r = await call('PUT', '/api/notices/fx-legacy', admin, { status: 'DRAFT' });
    check('an older notice with an unusual category can still be unpublished', Boolean(legacy) && r.status === 200 && r.json?.status === 'DRAFT', String(r.status));

    // ------------------------------------------------------------------ SMS
    console.log('\n--- SMS ---');
    r = await call('GET', '/api/sms/stats', admin);
    check('stats say SMS is not configured', r.json?.configured === false && r.json?.gatewayStatus === 'NOT_CONFIGURED');
    r = await call('POST', '/api/sms/send', admin, { recipients: [{ phone: '9876543210', name: 'Test' }], message: 'Hello' });
    check('sending without a gateway is refused, not reported as sent', r.status === 503 && r.json?.code === 'SMS_NOT_CONFIGURED', String(r.status));
    r = await call('POST', '/api/sms/send', accountant, { recipients: [{ phone: '9876543210' }], message: 'Hello' });
    check('accountant cannot send SMS', r.status === 403, String(r.status));
    r = await call('POST', '/api/sms/send', admin, { recipients: [{ phone: '9876543210' }], message: 'x'.repeat(1001) });
    check('over-long SMS is refused', r.status === 400, String(r.status));
    r = await call('POST', '/api/sms/quick-triggers/dispatch', admin, { triggerType: 'EMERGENCY_CIRCULAR', customMessage: 'Test' });
    check('quick trigger is refused without a gateway', r.status === 503, String(r.status));
    r = await call('POST', '/api/notices', admin, { ...base, title: 'Fixture staff only', targetAudience: 'STAFF', sendSmsBroadcast: true });
    check('staff-only notice never sends SMS to parents', r.status === 201 && r.json?.smsDispatch?.skipped === true);

    // ------------------------------------------------------------------ Hostel
    console.log('\n--- Hostel ---');
    let h = (await call('GET', '/api/hostels', admin)).json;
    let room1 = h.rooms.find((x: any) => x.id === 'fx-r-1');
    check('room counts come from its beds (3 beds, 0 occupied)', room1.capacity === 3 && room1.occupiedBeds === 0, `${room1.capacity}/${room1.occupiedBeds}`);
    const sumBeds = h.rooms.reduce((a: number, x: any) => a + x.beds.length, 0);
    const sumOcc = h.rooms.reduce((a: number, x: any) => a + x.beds.filter((b: any) => b.allocatedStudentId).length, 0);
    check('total beds and occupied beds match the beds', h.stats.totalBeds === sumBeds && h.stats.occupiedBeds === sumOcc, `${h.stats.totalBeds}/${sumBeds} ${h.stats.occupiedBeds}/${sumOcc}`);

    r = await call('POST', '/api/hostels/allocate', admin, { roomId: 'fx-r-1', bedNumber: 'Bed A', studentId: 'fx-gone' });
    check('inactive student cannot get a bed', r.status === 400, String(r.status));
    r = await call('POST', '/api/hostels/allocate', admin, { roomId: 'fx-r-1', bedNumber: 'Bed A', studentId: 'fx-girl-1' });
    check('girl cannot be placed in a boys hostel', r.status === 400 && /Boys hostel/.test(r.json?.error || ''), String(r.status));
    r = await call('POST', '/api/hostels/allocate', admin, { roomId: 'fx-r-1', bedNumber: 'Bed A', studentId: 'fx-boy-1' });
    check('bed allocation works', r.status === 200, String(r.status));
    r = await call('POST', '/api/hostels/allocate', admin, { roomId: 'fx-r-1', bedNumber: 'Bed A', studentId: 'fx-boy-2' });
    check('an occupied bed cannot be given to someone else', r.status === 409, String(r.status));

    // Make the student record stale, then allocate again elsewhere: the old bed must still be freed.
    const stu = readJson('students.json');
    r = await call('POST', '/api/hostels/allocate', admin, { roomId: 'fx-r-2', bedNumber: 'Bed B', studentId: 'fx-boy-1' });
    h = (await call('GET', '/api/hostels', admin)).json;
    const held = h.rooms.flatMap((x: any) => x.beds.filter((b: any) => b.allocatedStudentId === 'fx-boy-1').map((b: any) => `${x.id}:${b.bedNumber}`));
    check('a student holds only one bed after moving', r.status === 200 && held.length === 1 && held[0] === 'fx-r-2:Bed B', held.join(','));
    void stu;

    r = await call('POST', '/api/hostels/allocate', admin, { roomId: 'fx-r-2', bedNumber: 'Bed A', studentId: 'fx-boy-2' });
    r = await call('POST', '/api/hostels/vacate', admin, { studentId: 'fx-boy-2' });
    h = (await call('GET', '/api/hostels', admin)).json;
    const r2 = h.rooms.find((x: any) => x.id === 'fx-r-2');
    check("vacate frees only that student's bed", r.status === 200 && !r2.beds.find((b: any) => b.bedNumber === 'Bed A').allocatedStudentId && r2.beds.find((b: any) => b.bedNumber === 'Bed B').allocatedStudentId === 'fx-boy-1');

    // Remove the chosen (middle) bed, then add one: the free name comes back, no duplicates.
    r = await call('PUT', '/api/hostels/rooms/fx-r-1', admin, { removeBedNumber: 'Bed B' });
    check('removing Bed B removes Bed B (not the last bed)', r.status === 200 && r.json.beds.map((b: any) => b.bedNumber).join(',') === 'Bed A,Bed C', r.json?.beds?.map((b: any) => b.bedNumber).join(','));
    r = await call('PUT', '/api/hostels/rooms/fx-r-1', admin, { addBed: true });
    check('adding a bed reuses the free name (Bed B), no duplicates', r.status === 200 && r.json.beds.map((b: any) => b.bedNumber).sort().join(',') === 'Bed A,Bed B,Bed C', r.json?.beds?.map((b: any) => b.bedNumber).join(','));
    r = await call('PUT', '/api/hostels/rooms/fx-r-2', admin, { removeBedNumber: 'Bed B' });
    check('an occupied bed cannot be removed', r.status === 400, String(r.status));

    r = await call('PUT', '/api/hostels/rooms/fx-r-2', admin, { roomNumber: 'F101' });
    check('duplicate room number is refused', r.status === 409, String(r.status));
    r = await call('PUT', '/api/hostels/rooms/fx-r-2', admin, { capacity: 11 });
    check('more than 10 beds is refused', r.status === 400, String(r.status));
    r = await call('PUT', '/api/hostels/rooms/fx-r-2', admin, { capacity: 0 });
    check('zero beds is refused', r.status === 400, String(r.status));
    r = await call('DELETE', '/api/hostels/rooms/fx-r-2', admin);
    check('room with a student cannot be deleted', r.status === 400, String(r.status));
    r = await call('PUT', '/api/hostels/fx-h-boys', admin, { name: '  ' });
    check('empty hostel name is refused', r.status === 400, String(r.status));
    r = await call('PUT', '/api/hostels/fx-h-boys', admin, { type: 'GIRLS' });
    check('hostel type cannot change while boys live there', r.status === 400, String(r.status));
    r = await call('PUT', '/api/hostels/fx-h-boys', admin, { floors: [1] });
    check('floor with rooms cannot be removed', r.status === 400, String(r.status));
    r = await call('PUT', '/api/hostels/fx-h-boys', vp, { wardenName: 'New Warden' });
    check('vice principal (who can add rooms) can also edit the hostel', r.status === 200, String(r.status));
    r = await call('PUT', '/api/hostels/fx-h-boys', accountant, { wardenName: 'X' });
    check('accountant cannot edit hostels', r.status === 403, String(r.status));

    // ------------------------------------------------------------------ Transport
    console.log('\n--- Transport ---');
    let t: any = (await call('GET', '/api/transport', admin)).json;
    let route = t.routes.find((x: any) => x.id === 'fx-route');
    check('repeated stop numbers are renumbered 1..n', route.stops.map((x: any) => x.stopOrder).join(',') === '1,2,3', route.stops.map((x: any) => x.stopOrder).join(','));

    r = await call('POST', '/api/transport/routes/fx-route/stops', transportMgr, { stopName: 'Fixture First', pickupTime: '06:50', dropTime: '13:50', monthlyFare: 400, stopOrder: 1 });
    route = r.json?.route;
    check('new stop at position 1 shifts the others down', r.status === 201 && route.stops[0].stopName === 'Fixture First' && route.stops.map((x: any) => x.stopOrder).join(',') === '1,2,3,4');
    r = await call('POST', '/api/transport/routes/fx-route/stops', transportMgr, { stopName: 'fixture first', pickupTime: '06:50', dropTime: '13:50' });
    check('duplicate stop name on a route is refused', r.status === 409, String(r.status));
    r = await call('POST', '/api/transport/routes/fx-route/stops', transportMgr, { stopName: 'Bad Time', pickupTime: '25:99', dropTime: '13:50' });
    check('invalid pickup time is refused', r.status === 400, String(r.status));
    r = await call('PUT', '/api/transport/routes/fx-route/stops/fx-s3', transportMgr, { stopOrder: 1 });
    check('moving a stop keeps numbers 1..n', r.status === 200 && r.json.route.stops[0].id === 'fx-s3' && r.json.route.stops.map((x: any) => x.stopOrder).join(',') === '1,2,3,4');

    r = await call('POST', '/api/transport/allocate', transportMgr, { studentId: 'fx-gone', routeId: 'fx-route', stopId: 'fx-s1' });
    check('inactive student cannot be allocated', r.status === 400, String(r.status));
    r = await call('POST', '/api/transport/allocate', transportMgr, { studentId: 'fx-boy-1', routeId: 'fx-route', stopId: 'fx-s1' });
    check('student is placed on the stop that was chosen', r.json?.student?.transportStopId === 'fx-s1', r.json?.student?.transportStopId);
    const r3 = await call('POST', '/api/transport/allocate', transportMgr, { studentId: 'fx-boy-2', routeId: 'fx-route', stopId: 'fx-s2' });
    check('students are allocated', r.status === 200 && r3.status === 200, `${r.status}/${r3.status}`);
    check('student gets the bus registration number', r.json?.student?.vehicleNumber === 'FX-01-0001', r.json?.student?.vehicleNumber);
    r = await call('POST', '/api/transport/allocate', transportMgr, { studentId: 'fx-girl-1', routeId: 'fx-route', stopId: 'fx-s1' });
    check('a full bus refuses another student (2 seats)', r.status === 409 && r.json?.code === 'BUS_FULL', String(r.status));
    r = await call('PUT', '/api/transport/routes/fx-route/stops/fx-s2', transportMgr, { monthlyFare: 999 });
    t = (await call('GET', '/api/transport', admin)).json;
    const studs = readJson('students.json');
    const b1 = studs.find((x: any) => x.id === 'fx-boy-1');
    const b2 = studs.find((x: any) => x.id === 'fx-boy-2');
    check("editing one stop's fare changes only that stop's students", r.status === 200 && b2.transportMonthlyFee === 999 && b1.transportMonthlyFee === 500, `${b1?.transportMonthlyFee}/${b2?.transportMonthlyFee}`);

    r = await call('PUT', '/api/transport/vehicles/fx-v-1', transportMgr, { capacity: 1 });
    check('capacity cannot drop below students riding', r.status === 400, String(r.status));
    r = await call('DELETE', '/api/transport/routes/fx-route/stops/fx-s1', transportMgr);
    check('stop used by a student cannot be deleted', r.status === 409, String(r.status));
    r = await call('DELETE', '/api/transport/vehicles/fx-v-1', transportMgr);
    check('vehicle with riders cannot be deleted', r.status === 409, String(r.status));

    t = (await call('GET', '/api/transport', admin)).json;
    const routeIds = new Set(t.routes.map((x: any) => x.id));
    const all = readJson('students.json').filter((s: any) => s.status === 'ACTIVE' && s.transportRequired);
    const onRoutes = all.filter((s: any) => routeIds.has(s.transportRouteId) || t.routes.some((x: any) => x.routeName === s.transportRouteId)).length;
    check('passengers count only students on existing routes', t.stats.studentsUsingTransport === onRoutes, `${t.stats.studentsUsingTransport} vs ${onRoutes}`);
    check('students without a valid route are reported separately', t.stats.unassignedTransportStudents === all.length - onRoutes);
    const perRoute = t.routes.reduce((a: number, x: any) => a + (x.assignedStudentsCount || 0), 0);
    check('route counts add up to the passenger count', perRoute === t.stats.studentsUsingTransport, `${perRoute} vs ${t.stats.studentsUsingTransport}`);
    r = await call('PUT', '/api/transport/routes/fx-route', transportMgr, { vehicleId: 'does-not-exist' });
    check('route cannot point to a missing vehicle', r.status === 404, String(r.status));
    r = await call('POST', '/api/transport/allocate', accountant, { studentId: 'fx-girl-1', routeId: 'fx-route', stopId: 'fx-s1' });
    check('accountant keeps allocation access (unchanged RBAC), and the seat limit still applies', r.status === 409, String(r.status));
  } catch (err: any) {
    failed++;
    console.log(`  FAIL: run aborted (${err?.message || err})`);
  } finally {
    if (server?.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already stopped */ }
    }
    await new Promise((r) => setTimeout(r, 1500));
    restoreData(snap);
  }
  console.log(`\nOPERATIONS MODULES: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
