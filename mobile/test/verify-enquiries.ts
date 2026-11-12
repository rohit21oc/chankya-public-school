import { dialDigits, filterEnquiries, countByKind, kindOf, relativeTime, statusOf, telUrl, whatsappUrl, type Enquiry } from '../src/utils/enquiryModel';
import { buildBellItems, toActivityLeads } from '../src/utils/activityModel';
import { moduleForPush, parentRouteForPush } from '../src/utils/pushRouting';
import { MOBILE_MODULES as MODULES } from '../src/utils/rbac';

let fail = 0;
const check = (n: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); };

const now = Date.parse('2026-10-24T10:00:00Z');
const list: Enquiry[] = [
  { id: 'a', parentName: 'Rajesh Kumar', studentName: 'Aryan', classApplying: 'Class 3', mobile: '9876543210', status: 'SUBMITTED', submittedAt: '2026-10-24T09:30:00Z' },
  { id: 'b', kind: 'CALLBACK', parentName: 'Sunita', mobile: '+91 98765 11111', status: 'SUBMITTED', submittedAt: '2026-10-24T09:55:00Z', preferredTime: 'Evening' },
  { id: 'c', kind: 'ENQUIRY', parentName: 'Mohan', studentName: 'Riya', classApplying: 'UKG', mobile: '9000000000', status: 'ACCEPTED', submittedAt: '2026-10-20T09:00:00Z' },
  { id: 'd', parentName: 'Old record', studentName: 'Old', mobile: '9111111111', status: 'CONTACTED', createdAt: '2026-10-10T09:00:00Z' },
];

check('Records without a kind are admission enquiries', kindOf(list[0]) === 'ENQUIRY' && kindOf(list[1]) === 'CALLBACK');
check('Legacy statuses map to current ones', statusOf('ACCEPTED') === 'ADMITTED' && statusOf('REVIEWED') === 'UNDER_REVIEW');
const c = countByKind(list);
check('Counts by kind and new', c.ALL === 4 && c.ENQUIRY === 3 && c.CALLBACK === 1 && c.NEW === 2);
check('New filter shows only untouched leads, newest first', filterEnquiries(list, 'ALL', 'NEW', '').map((e) => e.id).join() === 'b,a');
check('Quick calls tab shows only call requests', filterEnquiries(list, 'CALLBACK', 'ALL', '').map((e) => e.id).join() === 'b');
check('Closed tab includes admitted (legacy accepted)', filterEnquiries(list, 'ALL', 'DONE', '').map((e) => e.id).join() === 'c');
check('In progress excludes only admitted and closed', filterEnquiries(list, 'ALL', 'OPEN', '').length === 3);
check('Search by mobile and by name', filterEnquiries(list, 'ALL', 'ALL', '11111')[0]?.id === 'b' && filterEnquiries(list, 'ALL', 'ALL', 'riya')[0]?.id === 'c');
check('Date falls back to createdAt on old records', filterEnquiries(list, 'ALL', 'ALL', '').map((e) => e.id).join() === 'b,a,c,d');
check('Phone digits drop +91, spaces and leading zero', dialDigits('+91 98765 11111') === '9876511111' && dialDigits('09876543210') === '9876543210' && telUrl('98765-43210') === 'tel:9876543210');
check('WhatsApp link targets the 10-digit number with a school greeting', whatsappUrl(list[0]).startsWith('https://wa.me/919876543210?text=') && decodeURIComponent(whatsappUrl(list[1])).includes('call back request'));
check('Relative time', relativeTime('2026-10-24T09:55:00Z', now) === '5 min ago' && relativeTime('2026-10-23T09:00:00Z', now) === 'Yesterday' && relativeTime('', now) === '');

const leads = toActivityLeads(list);
check('Bell leads are only the ones nobody has responded to', leads.map((l) => l.id).join() === 'b,a');
const bell = buildBellItems([], [], '', now, {}, leads);
check('Bell lists them with the right kind and opens Enquiries', bell.length === 2 && bell[0].kind === 'CALLBACK' && bell[0].target === 'enquiries' && bell[1].kind === 'ENQUIRY');
check('A cleared bell hides them until something newer arrives', buildBellItems([], [], '2026-10-24T09:56:00Z', now, {}, leads).length === 0);
check('A tapped lead leaves the bell', buildBellItems([], [], '', now, { 'e-b': '2026-10-24T09:55:00Z' }, leads).length === 1);
check('Leads older than 14 days are not in the bell', buildBellItems([], [], '', now, {}, [{ ...leads[0], at: '2026-09-01T00:00:00Z' }]).length === 0);

check('Tapping an enquiry or call push opens Enquiries for staff', moduleForPush('ENQUIRY') === 'enquiries' && moduleForPush('CALLBACK') === 'enquiries');
check('Parents are not sent there', parentRouteForPush('ENQUIRY') === null);
const mod = MODULES.find((m: any) => m.id === 'enquiries');
check('Module is limited to the school office', !!mod && !mod.roles.includes('TEACHER') && !mod.roles.includes('PARENT') && mod.roles.includes('PRINCIPAL'));

console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll enquiry checks passed.');
process.exit(fail ? 1 : 0);
