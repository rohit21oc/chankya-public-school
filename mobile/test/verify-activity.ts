import { resolveBackAction, nextHistory, stepBack } from '../src/utils/backNavigation';
import { buildBellItems, countNewNotices, toActivityNotices, noticeTime } from '../src/utils/activityModel';

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
};

const now = new Date('2026-10-23T12:00:00Z').getTime();
const notices = toActivityNotices([
  { id: 'a', title: 'Holiday', createdAt: '2026-10-23T08:00:00Z', status: 'PUBLISHED' },
  { id: 'b', title: 'Old notice', createdAt: '2026-09-01T08:00:00Z', status: 'PUBLISHED' },
  { id: 'c', title: 'Draft', createdAt: '2026-10-23T09:00:00Z', status: 'DRAFT' },
  { id: 'd', title: 'No date' },
]);
check('Notices: drafts and undated ones are dropped, newest first', notices.length === 2 && notices[0].id === 'a');
check('Notices: date-only values are understood', noticeTime({ publishDate: '2026-10-20' }).startsWith('2026-10-20'));
check('Notices: new = published after the last time Notices was opened', countNewNotices(notices, '2026-10-01T00:00:00Z') === 1 && countNewNotices(notices, '2026-08-01T00:00:00Z') === 2 && countNewNotices(notices, '2026-10-23T10:00:00Z') === 0);

const threads = [
  { threadId: 't1', from: 'Ram Vinay Yadav', unread: 3, lastText: 'Please come', lastKind: 'TEXT', lastAt: '2026-10-23T10:00:00Z' },
  { threadId: 't2', from: 'School office', student: 'Ananya', unread: 1, lastText: 'Pay your pending fees', lastKind: 'FEE_DUE', lastAt: '2026-10-23T11:00:00Z' },
  { threadId: 't3', from: 'School office', unread: 1, lastText: 'School closed', lastKind: 'EMERGENCY', lastAt: '2026-10-23T09:00:00Z' },
  { threadId: 't4', from: 'Read teacher', unread: 0, lastText: 'ok', lastKind: 'TEXT', lastAt: '2026-10-23T11:30:00Z' },
];
const items = buildBellItems(threads, notices, '', now);
check('Bell: unread chats and recent notices are listed, read chats and old notices are not', items.length === 4 && !items.some((i) => i.id === 'm-t4' || i.id === 'n-b'));
check('Bell: newest first', items[0].id === 'm-t2');
check('Bell: a fee reminder offers Pay now and goes to fees', items[0].kind === 'FEE' && items[0].target === 'fees' && items[0].sub === 'Tap to pay now');
check('Bell: counts messages per person', items.find((i) => i.id === 'm-t1')!.title === '3 new messages from Ram Vinay Yadav');
check('Bell: emergency is flagged', items.find((i) => i.id === 'm-t3')!.kind === 'EMERGENCY');
const afterClear = buildBellItems(threads, notices, '2026-10-23T11:45:00Z', now);
check('Clear: everything that arrived before the clear time disappears from the bell', afterClear.length === 0);
const later = buildBellItems([...threads, { threadId: 't5', from: 'Principal', unread: 1, lastText: 'Hi', lastKind: 'TEXT', lastAt: '2026-10-23T11:50:00Z' }], notices, '2026-10-23T11:45:00Z', now);
check('Clear: a message after the clear shows again', later.length === 1 && later[0].id === 'm-t5');
check('Clear: the chats keep their unread counts (the bell only hides them)', threads.filter((t) => t.unread > 0).length === 3);

const tapped = buildBellItems(threads, notices, '', now, { 'm-t1': threads.find((t) => t.threadId === 't1')!.lastAt! });
check('Tap: a tapped item leaves the bell', !tapped.some((i) => i.id === 'm-t1') && tapped.length === items.length - 1);
const t1 = threads.find((t) => t.threadId === 't1')!;
const again = buildBellItems(threads.map((t) => (t.threadId === 't1' ? { ...t, lastAt: '2026-10-23T11:59:00Z' } : t)), notices, '', now, { 'm-t1': t1.lastAt! });
check('Tap: a newer message in that chat shows again', again.some((i) => i.id === 'm-t1'));

// one step back
const h1 = nextHistory([], 'dashboard', 'communication');
const h2 = nextHistory(h1, 'communication', 'messages');
const h3 = nextHistory(h2, 'messages', 'profile');
check('Back: dashboard is the implicit base', h1.length === 0 && h2.join() === 'communication' && h3.join() === 'communication,messages');
const b1 = stepBack(h3);
check('Back: one step goes to the previous screen', b1.screen === 'messages' && b1.history.join() === 'communication');
check('Back: then the one before', stepBack(b1.history).screen === 'communication');
check('Back: finally the dashboard', stepBack([]).screen === 'dashboard');
check('Back: opening the dashboard clears the trail', nextHistory(h3, 'profile', 'dashboard').length === 0);
check('Back: hardware back uses history', resolveBackAction({ isAuthenticated: true, isDrawerOpen: false, currentScreenId: 'profile', historyLength: 2 }) === 'go-back');

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll activity checks passed.');
