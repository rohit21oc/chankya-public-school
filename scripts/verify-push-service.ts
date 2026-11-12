/** Push service rules without a server: validation, delivery loop, dead-device clean-up, Expo request shape. */
import { PushService, createRealTransport, isExpoPushToken, parseWebSubscription, tidyPayload, audience, type PushDevice, type PushStore, type PushTransport } from '../server/services/pushService.ts';

let fail = 0;
const check = (n: string, ok: boolean, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };

check('Valid Expo token accepted', isExpoPushToken('ExponentPushToken[abcdefghijklmnopqrstuv]'));
check('Garbage / script tokens rejected', !isExpoPushToken('abc') && !isExpoPushToken('ExponentPushToken[<script>]') && !isExpoPushToken(5));
check('HTTPS push-service endpoint accepted', !!parseWebSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'a', auth: 'b' } }));
check('http, localhost, IP and private hosts are refused (the server would POST there)',
  ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://db.internal/x', 'https://printer.local/x']
    .every((endpoint) => parseWebSubscription({ endpoint, keys: { p256dh: 'a', auth: 'b' } }) === null));
check('A subscription without keys is refused', parseWebSubscription({ endpoint: 'https://fcm.googleapis.com/x' }) === null);

const t = tidyPayload({ type: 'MESSAGE', title: ' Hi\u0007 there ', body: 'x'.repeat(400), data: { a: 'b' }, url: '//evil.com' });
check('Payload is cleaned: control chars gone, body capped, offsite url dropped', t.title === 'Hi there' && t.body.length === 160 && t.body.endsWith('...') && t.url === undefined);
check('A same-site url is kept', tidyPayload({ type: 'NOTICE', title: 'a', body: 'b', url: '/messages' }).url === '/messages');

class MemStore implements PushStore {
  items: PushDevice[] = [];
  all() { return this.items; }
  async upsert(d: PushDevice) { const i = this.items.findIndex((x) => x.key === d.key); if (i < 0) this.items.push(d); else this.items[i] = d; }
  async remove(keys: string[]) { this.items = this.items.filter((d) => !keys.includes(d.key)); }
}
const sent: Array<{ kind: string; keys: string[]; title: string }> = [];
let goneExpo: string[] = [];
const transport: PushTransport = {
  async sendExpo(devices, p) { sent.push({ kind: 'EXPO', keys: devices.map((d) => d.key), title: p.title }); return goneExpo; },
  async sendFcm(devices, p) { sent.push({ kind: 'FCM', keys: devices.map((d) => d.key), title: p.title }); return []; },
  async sendWeb(devices, p) { sent.push({ kind: 'WEB', keys: devices.map((d) => d.key), title: p.title }); return []; },
};
const store = new MemStore();
const svc = new PushService(store, transport);
const tk = (n: number) => `ExponentPushToken[device${String(n).padStart(12, '0')}]`;

await svc.register({ kind: 'EXPO', userId: 'p1', role: 'parent', studentIds: ['s1', 's1', 's2'], expoToken: tk(1) });
await svc.register({ kind: 'EXPO', userId: 'p2', role: 'PARENT', studentIds: ['s9'], expoToken: tk(2) });
await svc.register({ kind: 'EXPO', userId: 't1', role: 'TEACHER', studentIds: [], staffId: 'staff-1', expoToken: tk(3) });
check('Role is stored upper-case and student ids de-duplicated', store.items[0].role === 'PARENT' && store.items[0].studentIds.length === 2);

await svc.register({ kind: 'EXPO', userId: 'p2', role: 'PARENT', studentIds: ['s1'], expoToken: tk(1) });
check('The same device signing in as another login moves to that login (no double delivery)', store.items.filter((d) => d.key === tk(1)).length === 1 && store.items.find((d) => d.key === tk(1))!.userId === 'p2');
await svc.register({ kind: 'EXPO', userId: 'p1', role: 'PARENT', studentIds: ['s1', 's2'], expoToken: tk(1) });

let r = await svc.notify(audience.familyOf('s1'), { type: 'MESSAGE', title: 'A', body: 'b' });
check('familyOf(s1) reaches only the device linked to s1', r.attempted === 1 && sent.at(-1)!.keys[0] === tk(1), JSON.stringify(sent.at(-1)));
r = await svc.notify(audience.familyOf('s1'), { type: 'MESSAGE', title: 'A', body: 'b' }, 'p1');
check('The sender is excluded from their own push', r.attempted === 0);
r = await svc.notify(audience.staffMember('staff-1'), { type: 'MESSAGE', title: 'A', body: 'b' });
check('staffMember reaches that staff login only', r.attempted === 1 && sent.at(-1)!.keys[0] === tk(3));

goneExpo = [tk(2)];
r = await svc.notify((d) => d.role === 'PARENT', { type: 'NOTICE', title: 'N', body: 'b' });
check('A device Expo reports as gone is removed from the store', r.removed === 1 && !store.items.some((d) => d.key === tk(2)));
goneExpo = [];

const bad: PushTransport = { async sendExpo() { throw new Error('network down'); }, async sendFcm() { return []; }, async sendWeb() { return []; } };
const svc2 = new PushService(store, bad);
let threw = false;
try { await svc2.notify(() => true, { type: 'NOTICE', title: 'N', body: 'b' }); } catch { threw = true; }
check('A delivery failure never throws into the caller', !threw);

check('Another login cannot unregister my device', (await svc.unregister('p2', [tk(1)])) === 0 && store.items.some((d) => d.key === tk(1)));
check('The owner can', (await svc.unregister('p1', [tk(1)])) === 1 && !store.items.some((d) => d.key === tk(1)));

// Real transport: Expo request shape, chunking and ticket handling (fetch is faked, nothing leaves the machine)
const calls: any[] = [];
const fakeFetch: any = async (url: string, init: any) => {
  const body = JSON.parse(init.body);
  calls.push({ url, auth: init.headers.Authorization, body });
  return { ok: true, status: 200, json: async () => ({ data: body.map((m: any, i: number) => (i === 1 ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }) };
};
const real = createRealTransport({ fetchImpl: fakeFetch, expoAccessToken: 'secret-token' });
const mkDev = (n: number): PushDevice => ({ key: tk(n), kind: 'EXPO', userId: `u${n}`, role: 'PARENT', studentIds: [], token: tk(n), createdAt: '', updatedAt: '' });
const devs = Array.from({ length: 205 }, (_, i) => mkDev(i + 10));
const gone = await real.sendExpo(devs, { type: 'MESSAGE', title: 'T', body: 'B', data: { threadId: 'x' } });
check('205 devices are sent in chunks of at most 100', calls.length === 3 && calls[0].body.length === 100 && calls[2].body.length === 5);
check('Request goes to the Expo push API with the access token', calls[0].url === 'https://exp.host/--/api/v2/push/send' && calls[0].auth === 'Bearer secret-token');
const m0 = calls[0].body[0];
check('Each message has sound, high priority, the Android channel and routing data', m0.sound === 'default' && m0.priority === 'high' && m0.channelId === 'school-alerts' && m0.data.type === 'MESSAGE' && m0.data.threadId === 'x' && m0.to === tk(10));
check('Only DeviceNotRegistered tickets are reported as gone (one per chunk here)', gone.length === 3 && gone[0] === tk(11));
const noKeys = createRealTransport({ fetchImpl: fakeFetch });
check('Web push without VAPID keys is a quiet no-op', (await noKeys.sendWeb([{ ...mkDev(1), kind: 'WEB' }], { type: 'NOTICE', title: 'a', body: 'b' })).length === 0);

// --- Website enquiries / quick calls reach the school office only --------------------------------------
{
  const st = new MemStore();
  const sv = new PushService(st, transport);
  await sv.register({ kind: 'EXPO', userId: 'adm', role: 'PRINCIPAL', studentIds: [], expoToken: tk(21) });
  await sv.register({ kind: 'EXPO', userId: 'par', role: 'PARENT', studentIds: ['s1'], expoToken: tk(22) });
  await sv.register({ kind: 'EXPO', userId: 'tea', role: 'TEACHER', studentIds: [], expoToken: tk(23) });
  const OFFICE = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN'];
  sent.length = 0;
  const rr = await sv.notify((d) => OFFICE.includes(d.role), { type: 'CALLBACK', title: 'Call back requested: Sunita', body: '9876543210 - Evening', data: { enquiryId: 'enq-1', kind: 'CALLBACK' }, url: '/public-website-management?tab=enquiries' });
  check('A quick call push goes to the principal only, not parents or teachers', rr.attempted === 1 && sent.at(-1)!.keys.join() === tk(21));
  check('Enquiry push keeps its type and in-app link', tidyPayload({ type: 'ENQUIRY', title: 'a', body: 'b', url: '/public-website-management?tab=enquiries' }).type === 'ENQUIRY' && tidyPayload({ type: 'CALLBACK', title: 'a', body: 'b', url: '/public-website-management?tab=enquiries' }).url === '/public-website-management?tab=enquiries');
}
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const put = src.slice(src.indexOf("app.put('/api/enquiries/:id'"), src.indexOf("app.delete('/api/enquiries/:id'"));
  check('Updating an enquiry cannot overwrite what the family submitted (no body spread)', !/\.\.\.req\.body/.test(put) && put.includes('ENQUIRY_STATUSES') && put.includes('followUpDate'));
  const status = src.slice(src.indexOf("app.get('/api/public/enquiry/status'"), src.indexOf("app.get('/api/enquiries'"));
  check('The public status lookup strips internal notes', status.includes('notes: _n'));
  check('Both public forms notify the office', (src.match(/notifyOfficeOfEnquiry\(/g) || []).length >= 3);
}

// --- Direct Firebase (FCM) push: no Expo account involved ---------------------------------------------
{
  const { generateKeyPairSync, createVerify } = await import('node:crypto');
  const { isFcmToken, parseFcmServiceAccount, buildFcmAssertion } = await import('../server/services/pushService.ts');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const saJson = JSON.stringify({ project_id: 'cps-test', client_email: 'svc@cps-test.iam.gserviceaccount.com', private_key: pem });
  const fcmTok = (n: number) => `fcm${n}:APA91b${'x'.repeat(60)}`;

  check('A Firebase device token is accepted, garbage refused', isFcmToken(fcmTok(1)) && !isFcmToken('short') && !isFcmToken('a b'.repeat(30)) && !isFcmToken(7));
  check('Service account is read from raw JSON or base64', !!parseFcmServiceAccount(saJson) && !!parseFcmServiceAccount(Buffer.from(saJson).toString('base64')) && parseFcmServiceAccount('nope') === null && parseFcmServiceAccount(undefined) === null);
  const sa = parseFcmServiceAccount(saJson)!;
  const jwt = buildFcmAssertion(sa, 1_000_000).split('.');
  const okSig = createVerify('RSA-SHA256').update(`${jwt[0]}.${jwt[1]}`).verify(publicKey, Buffer.from(jwt[2], 'base64url'));
  const claim = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
  check('Google sign-in request is a valid RS256 token for the messaging scope', okSig && claim.iss === sa.clientEmail && claim.scope.endsWith('firebase.messaging') && claim.exp === 1_003_600);

  const st = new MemStore();
  const sv = new PushService(st, transport);
  const bad1 = await sv.register({ kind: 'FCM', userId: 'p1', role: 'PARENT', studentIds: ['s1'], fcmToken: 'junk' });
  const good = await sv.register({ kind: 'FCM', userId: 'p1', role: 'PARENT', studentIds: ['s1'], fcmToken: fcmTok(1) });
  check('FCM registration validates the token and stores it by that token', 'error' in bad1 && 'key' in good && st.items[0].kind === 'FCM' && st.items[0].token === fcmTok(1));
  sent.length = 0;
  await sv.notify(audience.familyOf('s1'), { type: 'FEE_DUE', title: 'Fee due', body: 'Pay', category: 'fee_due' });
  check('notify() routes FCM devices to sendFcm', sent.length === 1 && sent[0].kind === 'FCM');

  const calls: Array<{ url: string; init: any }> = [];
  const fakeFetch = (async (url: string, init: any) => {
    calls.push({ url, init });
    if (url.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    const to = JSON.parse(init.body).message.token;
    if (to === fcmTok(3)) return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
    if (to === fcmTok(4)) return new Response(JSON.stringify({ error: { status: 'INTERNAL' } }), { status: 500 });
    return new Response('{}', { status: 200 });
  }) as any;
  const mk = (n: number): PushDevice => ({ key: fcmTok(n), kind: 'FCM', userId: 'u', role: 'PARENT', studentIds: [], token: fcmTok(n), createdAt: '', updatedAt: '' });
  const rt = createRealTransport({ fcmServiceAccount: saJson, fetchImpl: fakeFetch });
  const goneKeys = await rt.sendFcm([mk(2), mk(3), mk(4)], { type: 'MESSAGE', title: 'T', body: 'B', data: { threadId: 'x' }, category: 'fee_due' });
  const sendCalls = calls.filter((c) => c.url.includes('fcm.googleapis.com'));
  const m = JSON.parse(sendCalls[0].init.body).message;
  check('FCM request: project URL, bearer token, channel, string-only data', sendCalls[0].url === 'https://fcm.googleapis.com/v1/projects/cps-test/messages:send' && sendCalls[0].init.headers.Authorization === 'Bearer tok' && m.android.notification.channel_id === 'school-alerts' && m.data.threadId === 'x' && m.data.type === 'MESSAGE' && Object.values(m.data).every((v) => typeof v === 'string') && m.notification.title === 'T');
  check('Only an UNREGISTERED token is reported gone; a server error is not', goneKeys.length === 1 && goneKeys[0] === fcmTok(3));
  check('Access token is fetched once and reused', calls.filter((c) => c.url.includes('oauth2')).length === 1);
  const quiet = createRealTransport({});
  check('FCM without a server key is a quiet no-op', (await quiet.sendFcm([mk(9)], { type: 'NOTICE', title: 'a', body: 'b' })).length === 0);
}

console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll push service checks passed.');
process.exit(fail ? 1 : 0);
