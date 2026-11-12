/**
 * Messages extras in the app: class labels, who may send an emergency message (must match the server),
 * the emergency card in chat, the parent photo picker setup, and wording on ID cards / marksheets.
 *   npx tsx test/verify-messages-extras.ts
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { EMERGENCY_ROLES, classLabel } from '../src/utils/messagesRules';

let fail = 0;
const check = (name: string, ok: boolean, got: unknown = '') => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → ${JSON.stringify(got)}`}`);
};
const read = (...p: string[]) => fs.readFileSync(join(__dirname, '..', ...p), 'utf8');

check('Bare class number gets "Class"', classLabel({ className: '5', section: 'A' }) === 'Class 5-A', classLabel({ className: '5', section: 'A' }));
check('"Class 1" is not doubled', classLabel({ className: 'Class 1', section: 'B' }) === 'Class 1-B', classLabel({ className: 'Class 1', section: 'B' }));
check('Named classes stay as they are', classLabel({ className: 'Nursery', section: 'A' }) === 'Nursery-A' && classLabel({ className: 'ELP' }) === 'ELP');
check('No class → empty', classLabel({}) === '');

const rules = read('..', 'server', 'services', 'engagementRules.ts');
const server = /EMERGENCY_MESSAGE_ROLES = \[([^\]]*)\]/.exec(rules)?.[1].match(/'([A-Z_]+)'/g)?.map((x) => x.replace(/'/g, '')) || [];
check('Emergency roles match the server', server.length > 0 && server.slice().sort().join() === EMERGENCY_ROLES.slice().sort().join(), { server, app: EMERGENCY_ROLES });
check('Teachers and accountants cannot send emergencies', !EMERGENCY_ROLES.includes('TEACHER') && !EMERGENCY_ROLES.includes('ACCOUNTANT'));

const thread = read('src', 'components', 'ChatThread.tsx');
check('Chat shows emergency messages as their own card', thread.includes("item.kind === 'EMERGENCY'") && thread.includes('Emergency message'));
const inbox = read('src', 'components', 'comm', 'ChatInbox.tsx');
check('Staff chat list marks emergencies', inbox.includes("t.lastKind === 'EMERGENCY'"));
check('Staff chat header opens the parent profile', inbox.includes('<ProfileSheet') && inbox.includes('side="SCHOOL"'));

const app = JSON.parse(read('app.json'));
const picker = (app.expo.plugins as any[]).find((p) => (Array.isArray(p) ? p[0] : p) === 'expo-image-picker');
check('Photo picker plugin is configured with a gallery permission text', Array.isArray(picker) && !!picker[1]?.photosPermission);
const pkg = JSON.parse(read('package.json'));
const bundled = JSON.parse(fs.readFileSync(require.resolve('expo/bundledNativeModules.json', { paths: [join(__dirname, '..')] }), 'utf8'));
check('expo-image-picker matches the Expo SDK', pkg.dependencies['expo-image-picker'] === bundled['expo-image-picker'], { pkg: pkg.dependencies['expo-image-picker'], sdk: bundled['expo-image-picker'] });
const more = read('src', 'parent', 'screens', 'ParentMoreScreen.tsx');
check('Photo picker is loaded on demand (old builds do not crash)', more.includes("require('expo-image-picker')") && !/^import .*expo-image-picker/m.test(more));

const idCard = read('src', 'components', 'IdCard.tsx');
check('ID card does not hard-code CBSE', !idCard.includes('CBSE AFFILIATION'));

console.log(fail ? `\n${fail} FAILED` : '\nAll messages checks passed.');
process.exit(fail ? 1 : 0);
