/**
 * Browser side of push without a browser or the internet:
 *  1. public/sw.js run in a sandbox with a fake service-worker environment (visible vs hidden tab, click handling)
 *  2. the server's real web-push sender against a local fake push service (headers, encryption, dead subscriptions)
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import webpush from 'web-push';
import { createRealTransport, type PushDevice } from '../server/services/pushService.ts';

let fail = 0;
const check = (n: string, ok: boolean, x = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`); };

// ---------------- 1. service worker ----------------
function loadSw(windows: Array<{ url: string; visibilityState: string }>) {
  const listeners: Record<string, Function> = {};
  const shown: any[] = [];
  const posted: any[] = [];
  const opened: string[] = [];
  const focused: string[] = [];
  const navigated: string[] = [];
  const clientList = windows.map((w) => ({
    ...w,
    postMessage: (m: any) => posted.push(m),
    focus: async () => { focused.push(w.url); },
    navigate: async (u: string) => { navigated.push(u); },
  }));
  const self: any = {
    location: { origin: 'https://school.example' },
    addEventListener: (type: string, fn: Function) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => clientList, openWindow: async (u: string) => { opened.push(u); } },
    registration: { showNotification: async (title: string, opts: any) => { shown.push({ title, opts }); } },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL, String });
  const fire = async (type: string, event: any) => {
    let p: Promise<any> = Promise.resolve();
    listeners[type]({ ...event, waitUntil: (x: Promise<any>) => { p = x; } });
    await p;
  };
  return { fire, shown, posted, opened, focused, navigated };
}
const pushEvent = (payload: any) => ({ data: { json: () => payload, text: () => JSON.stringify(payload) } });

let sw = loadSw([]);
await sw.fire('push', pushEvent({ title: 'Mrs Rao · Aarav', body: 'Please send the form', type: 'MESSAGE', data: { threadId: 'st-1::t-3' }, url: '/messages' }));
check('Site closed: a system notification is shown with title, body, school icon and the page to open', sw.shown.length === 1 && sw.shown[0].title === 'Mrs Rao · Aarav' && sw.shown[0].opts.body === 'Please send the form' && sw.shown[0].opts.icon === '/api/school-logo/favicon' && sw.shown[0].opts.data.url === '/messages');
check('Notifications of one conversation replace each other (tag per thread)', sw.shown[0].opts.tag === 'MESSAGE:st-1::t-3');

sw = loadSw([{ url: 'https://school.example/dashboard', visibilityState: 'hidden' }]);
await sw.fire('push', pushEvent({ title: 'T', body: 'B', type: 'NOTICE', url: '/communication' }));
check('Site open but in the background: still shows the system notification', sw.shown.length === 1 && sw.posted.length === 0);

sw = loadSw([{ url: 'https://school.example/dashboard', visibilityState: 'visible' }]);
await sw.fire('push', pushEvent({ title: 'T', body: 'B', type: 'MESSAGE', url: '/messages' }));
check('Site in front: no system banner; the page is told so it can show its own popup', sw.shown.length === 0 && sw.posted.length === 1 && sw.posted[0].type === 'SCHOOL_PUSH' && sw.posted[0].payload.url === '/messages');

sw = loadSw([]);
await sw.fire('push', { data: { json: () => { throw new Error('not json'); }, text: () => 'plain words' } });
check('A push that is not JSON still shows something readable', sw.shown.length === 1 && sw.shown[0].opts.body === 'plain words');

sw = loadSw([]);
await sw.fire('push', pushEvent({ title: 'X', body: 'Y', url: 'https://evil.example/phish' }));
check('An off-site url in a push is never used: it opens the home page instead', sw.shown[0].opts.data.url === '/');

sw = loadSw([]);
let closed = false;
await sw.fire('notificationclick', { notification: { close: () => { closed = true; }, data: { url: '/homework' } } });
check('Click with no window open: opens the page', closed && sw.opened.length === 1 && sw.opened[0] === 'https://school.example/homework');

sw = loadSw([{ url: 'https://school.example/fees/ledger', visibilityState: 'hidden' }]);
await sw.fire('notificationclick', { notification: { close: () => {}, data: { url: '/messages' } } });
check('Click with the site already open: focuses that tab and goes to the page (no second tab)', sw.opened.length === 0 && sw.focused.length === 1 && sw.navigated[0] === 'https://school.example/messages');

// ---------------- 2. real web-push sender ----------------
const keys = webpush.generateVAPIDKeys();
const requests: Array<{ headers: http.IncomingHttpHeaders; bytes: number; path: string }> = [];
// web-push talks HTTPS only, so the fake push service is a local HTTPS server with a throw-away certificate
// (made with openssl; trusted for this process only).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'push-test-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'k.pem'), '-out', path.join(tmp, 'c.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
const server = https.createServer({ key: fs.readFileSync(path.join(tmp, 'k.pem')), cert: fs.readFileSync(path.join(tmp, 'c.pem')) }, (req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    requests.push({ headers: req.headers, bytes: Buffer.concat(chunks).length, path: req.url || '' });
    if ((req.url || '').startsWith('/gone')) { res.statusCode = 410; res.end('gone'); return; }
    res.statusCode = 201; res.end();
  });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as any).port;

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const sub = (p: string) => ({ endpoint: `https://127.0.0.1:${port}${p}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });
const dev = (key: string, p: string): PushDevice => ({ key, kind: 'WEB', userId: 'u', role: 'PARENT', studentIds: [], subscription: sub(p), createdAt: '', updatedAt: '' });

const real = createRealTransport({ vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey, vapidSubject: 'mailto:admin@school.example' });
const gone = await real.sendWeb([dev('alive', '/alive'), dev('dead', '/gone')], { type: 'MESSAGE', title: 'Hello', body: 'World', url: '/messages' });
const alive = requests.find((r) => r.path === '/alive');
check('The push reaches the push service with VAPID authorisation', !!alive && /^vapid t=.+, k=.+/.test(String(alive.headers.authorization)), JSON.stringify(alive?.headers.authorization));
check('The body is encrypted (aes128gcm) and the message has a lifetime', alive?.headers['content-encoding'] === 'aes128gcm' && Number(alive?.headers.ttl) === 86400 && (alive?.bytes || 0) > 60);
check('The VAPID key in the header is the server\'s public key', String(alive?.headers.authorization).includes(`k=${keys.publicKey}`));
check('A subscription the push service answers 410 for is reported gone, a healthy one is not', gone.length === 1 && gone[0] === 'dead');
server.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll web push checks passed.');
process.exit(fail ? 1 : 0);
