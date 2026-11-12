import { isPushType, moduleForPush, parentRouteForPush } from '../src/utils/pushRouting';
import fs from 'node:fs';
import { join } from 'node:path';

let fail = 0;
const check = (n: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); };

check('Known types are accepted, anything else is not', isPushType('MESSAGE') && isPushType('TEST') && !isPushType('message') && !isPushType(undefined) && !isPushType({}));
check('Parent: a message opens the chat', parentRouteForPush('MESSAGE') === 'chat');
check('Parent: a fee reminder opens the payment screen', parentRouteForPush('FEE_DUE') === 'fees');
check('Parent: a notice opens Notices, homework opens Homework', parentRouteForPush('NOTICE') === 'notices' && parentRouteForPush('HOMEWORK') === 'homework');
check('Parent: the test notification and unknown data open nothing', parentRouteForPush('TEST') === null && parentRouteForPush('hack') === null && parentRouteForPush(null) === null);
check('Staff: message, notice and homework map to real modules', moduleForPush('MESSAGE') === 'messages' && moduleForPush('NOTICE') === 'communication' && moduleForPush('HOMEWORK') === 'homework');
check('Staff: unknown data opens nothing', moduleForPush('x') === null && moduleForPush(undefined) === null);

// The channel id the app creates must be the one the server sends on, or Android would use a silent default.
const server = fs.readFileSync(join(__dirname, '..', '..', 'server', 'services', 'pushService.ts'), 'utf8');
const app = fs.readFileSync(join(__dirname, '..', 'src', 'services', 'pushNotifications.ts'), 'utf8');
const idServer = /ANDROID_CHANNEL_ID = '([^']+)'/.exec(server)?.[1];
const idApp = /ALERT_CHANNEL_ID = '([^']+)'/.exec(app)?.[1];
check(`Server and app use the same Android channel (${idServer})`, !!idServer && idServer === idApp);
const cfg = JSON.parse(fs.readFileSync(join(__dirname, '..', 'app.json'), 'utf8'));
const plugin = (cfg.expo.plugins as any[]).find((p) => Array.isArray(p) && p[0] === 'expo-notifications');
check('app.json declares expo-notifications with the same default channel', plugin?.[1]?.defaultChannel === idServer);
check('The notification icon file exists', fs.existsSync(join(__dirname, '..', 'assets', 'notification-icon.png')));

// Server routing urls must be real web paths
const eng = fs.readFileSync(join(__dirname, '..', '..', 'server', 'routes', 'engagementRoutes.ts'), 'utf8');
// Every push sent from the chat routes (messages, fee reminders, emergency) opens the Messages page.
const urls = eng.match(/url: '[^']*'/g) || [];
check('Chat pushes open /messages on the web', urls.length >= 3 && urls.every((u) => u === "url: '/messages'"));

console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll push routing checks passed.');
process.exit(fail ? 1 : 0);
