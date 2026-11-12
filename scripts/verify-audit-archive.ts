/**
 * Monthly audit-log archive: rules, the Excel file, and the whole job with a fake cloud storage and e-mail
 * (no MongoDB, no R2, no Brevo needed):   npx tsx scripts/verify-audit-archive.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { buildXlsx, columnName } from '../server/services/xlsxWriter.ts';
import {
  archiveRow,
  istMonth,
  monthDiff,
  monthOfTimestamp,
  monthRange,
  monthsToArchive,
  monthsToEmail,
  monthsToPurge,
  shiftMonth,
} from '../server/services/auditArchiveRules.ts';
import { registerAuditArchiveRoutes } from '../server/routes/auditArchiveRoutes.ts';

process.env.AUDIT_ARCHIVE_DISABLED = '1'; // no timers in the test
let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => {
  await fn();
  n++;
  console.log('PASS', name);
};

// ---------------- rules ----------------
await t('IST month boundaries: 31 Oct 19:00 UTC is already November in India', () => {
  assert.equal(monthOfTimestamp('2026-10-31 19:00:00'), '2026-11');
  assert.equal(monthOfTimestamp('2026-10-31 18:29:59'), '2026-10');
  assert.equal(monthOfTimestamp('2026-10-15T10:00:00.000Z'), '2026-10');
  assert.deepEqual(monthRange('2026-11'), { from: '2026-10-31 18:30:00', to: '2026-11-30 18:30:00' });
});
await t('month arithmetic across years', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(monthDiff('2025-11', '2026-02'), 3);
});
const counts = [
  { month: '2026-06', count: 10 },
  { month: '2026-07', count: 5 },
  { month: '2026-10', count: 7 },
  { month: '2026-11', count: 2 },
];
await t('on 1 November: October (and older un-archived months) are archived, not the running month', () => {
  assert.deepEqual(monthsToArchive(counts, [], '2026-11'), ['2026-06', '2026-07', '2026-10']);
});
await t('an archived month is not written again, unless new entries arrived', () => {
  const arch = [{ month: '2026-10', count: 7, verified: true, fileKey: 'k' }];
  assert.deepEqual(monthsToArchive([{ month: '2026-10', count: 7 }], arch, '2026-11'), []);
  assert.deepEqual(monthsToArchive([{ month: '2026-10', count: 9 }], arch, '2026-11'), ['2026-10']);
});
await t('3 months kept: October is removed from the database only from 1 February, and only with a confirmed archive', () => {
  const ok = [{ month: '2026-10', count: 7, verified: true, fileKey: 'k' }];
  assert.deepEqual(monthsToPurge([{ month: '2026-10', count: 7 }], ok, '2027-01'), []);
  assert.deepEqual(monthsToPurge([{ month: '2026-10', count: 7 }], ok, '2027-02'), ['2026-10']);
  assert.deepEqual(monthsToPurge([{ month: '2026-10', count: 7 }], [{ ...ok[0], verified: false }], '2027-02'), [], 'unconfirmed file → keep');
  assert.deepEqual(monthsToPurge([{ month: '2026-10', count: 7 }], [], '2027-02'), [], 'no archive → keep');
  assert.deepEqual(monthsToPurge([{ month: '2026-10', count: 8 }], ok, '2027-02'), [], 'more entries than the file → keep');
});
await t('failed e-mails are retried up to 5 times', () => {
  assert.deepEqual(monthsToEmail([{ month: '2026-10', count: 1, verified: true, emailAttempts: 2 }]), ['2026-10']);
  assert.deepEqual(monthsToEmail([{ month: '2026-10', count: 1, verified: true, emailAttempts: 5 }]), []);
  assert.deepEqual(monthsToEmail([{ month: '2026-10', count: 1, verified: true, emailedAt: 'x' }]), []);
});
await t('Excel row: IST time, who, what, changes', () => {
  const row = archiveRow({ timestamp: '2026-10-31 04:30:00', userName: 'Rohit', role: 'SUPER_ADMIN', action: 'FEE_COLLECTED', entity: 'Fee', entityId: 'f1', details: 'Paid', ipAddress: '1.2.3.4', id: 'log-1', metadata: { category: 'FINANCE', severity: 'critical', changes: { amount: { from: 100, to: 200 } } } });
  assert.equal(row[0], '2026-10-31 10:00:00');
  assert.equal(row[7], 'FINANCE');
  assert.match(row[10], /amount: 100 → 200/);
});

// ---------------- Excel file opens ----------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-'));
await t('the .xlsx opens in a spreadsheet reader (openpyxl) with header, data, special characters', () => {
  assert.equal(columnName(0), 'A');
  assert.equal(columnName(27), 'AB');
  const buf = buildXlsx([{ name: 'Audit 2026/10', rows: [['A', 'B'], ['x < y & "z"', 42], ['हिंदी', '']] }, { name: 'About', rows: [['k', 'v']] }]);
  const f = path.join(tmp, 't.xlsx');
  fs.writeFileSync(f, buf);
  const out = execFileSync('python3', ['-c', `import openpyxl,json;wb=openpyxl.load_workbook(${JSON.stringify(f)});ws=wb.worksheets[0];print(json.dumps([wb.sheetnames,[[c for c in r] for r in ws.iter_rows(values_only=True)]],ensure_ascii=False))`]).toString();
  const [names, rows] = JSON.parse(out);
  assert.deepEqual(names, ['Audit 2026 10', 'About']);
  assert.deepEqual(rows, [['A', 'B'], ['x < y & "z"', 42], ['हिंदी', null]]);
});

// ---------------- the whole job with fake storage + e-mail ----------------
const cur = istMonth();
const ts = (month: string, day = 15) => `${month}-${String(day).padStart(2, '0')} 06:00:00`;
let memory: any[] = [];
for (const [m, k] of [[shiftMonth(cur, -5), 3], [shiftMonth(cur, -4), 2], [shiftMonth(cur, -1), 4], [cur, 2]] as const) {
  for (let i = 0; i < k; i++) memory.push({ id: `log-${m}-${i}`, timestamp: ts(m, 10 + i), userName: 'Admin', role: 'SUPER_ADMIN', action: 'FEE_COLLECTED', entity: 'Fee', entityId: `f${i}`, details: `Fee ${i}`, ipAddress: '1.1.1.1' });
}
const r2 = new Map<string, Buffer>();
let corruptReads = false;
let emailFails = false;
const emails: any[] = [];
const removedFromDisk: string[] = [];
const audit: string[] = [];
const app = express();
const pass = (_req: any, _res: any, next: any) => next();
const deny = (_req: any, res: any) => res.status(403).json({ success: false, error: 'Forbidden' });
const guards = { view: pass as any, admin: pass as any };
const handle = registerAuditArchiveRoutes(app, {
  viewGuard: (req, res, next) => guards.view(req, res, next),
  adminGuard: (req, res, next) => guards.admin(req, res, next),
  getMemoryLogs: () => memory,
  setMemoryLogs: (l) => {
    memory = l;
  },
  removeFromDisk: (ids) => removedFromDisk.push(...ids),
  storage: {
    isConfigured: () => true,
    upload: async (k, b) => {
      r2.set(k, b);
    },
    get: async (k) => (r2.has(k) ? { buffer: corruptReads ? Buffer.from('x') : r2.get(k)! } : null),
  },
  sendEmail: async (o) => {
    if (emailFails) return { success: false, error: 'Brevo down' };
    emails.push(o);
    return { success: true };
  },
  getSchoolEmail: () => 'office@school.test',
  getSchoolName: () => 'Test School',
  getPortalUrl: () => 'https://school.test',
  logAudit: (_n, _r, action, _e, id) => audit.push(`${action}:${id}`),
  saveLocal: () => undefined,
  readLocal: () => null,
});
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

await t('a corrupt / missing cloud copy: archived but NOT confirmed, nothing deleted', async () => {
  corruptReads = true;
  const r = await handle.runCycle();
  assert.deepEqual(r.purged, []);
  assert.equal(memory.length, 11);
  corruptReads = false;
});
await t('job: every finished month archived to cloud storage and e-mailed with the Excel attached', async () => {
  const r = await handle.runCycle();
  assert.deepEqual(r.archived.sort(), [shiftMonth(cur, -5), shiftMonth(cur, -4), shiftMonth(cur, -1)].sort());
  assert.ok(!r.archived.includes(cur), 'running month not archived');
  assert.ok(r2.has(`archives/audit-logs/audit-logs-${shiftMonth(cur, -1)}.xlsx`));
  const mail = emails.find((e) => e.subject.includes(shiftMonth(cur, -1)));
  assert.equal(mail.to, 'office@school.test');
  assert.equal(mail.attachments?.[0]?.name, `audit-logs-${shiftMonth(cur, -1)}.xlsx`);
});
await t('job: only months older than 3 months were removed from the database, after their confirmed archive', async () => {
  const left = new Set(memory.map((l) => monthOfTimestamp(l.timestamp)));
  assert.ok(!left.has(shiftMonth(cur, -5)) && !left.has(shiftMonth(cur, -4)), 'old months removed');
  assert.ok(left.has(shiftMonth(cur, -1)) && left.has(cur), 'recent months kept');
  assert.equal(removedFromDisk.length, 5);
  assert.ok(audit.some((a) => a.startsWith('AUDIT_LOGS_ARCHIVED_REMOVED:')));
});
await t('a removed month is still downloadable from its archive file (opens, 3 entries)', async () => {
  const res = await fetch(`${base}/api/audit-logs/archives/${shiftMonth(cur, -5)}/download`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /spreadsheetml/);
  const f = path.join(tmp, 'd.xlsx');
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  const rows = Number(execFileSync('python3', ['-c', `import openpyxl;print(openpyxl.load_workbook(${JSON.stringify(f)}).worksheets[0].max_row)`]).toString());
  assert.equal(rows, 4); // header + 3
});
await t('the running month can be downloaded too (built from the database)', async () => {
  const res = await fetch(`${base}/api/audit-logs/archives/${cur}/download`);
  assert.equal(res.status, 200);
});
await t('running the job again changes nothing (no duplicate archives or e-mails)', async () => {
  const before = emails.length;
  const r = await handle.runCycle();
  assert.deepEqual([r.archived, r.purged], [[], []]);
  assert.equal(emails.length, before);
});
await t('a failed e-mail is retried on the next run', async () => {
  memory.push({ id: 'late-1', timestamp: ts(shiftMonth(cur, -1), 20), userName: 'A', role: 'X', action: 'Y', entity: 'Z', entityId: '1', details: 'late' });
  emailFails = true;
  const r1 = await handle.runCycle();
  assert.deepEqual(r1.archived, [shiftMonth(cur, -1)], 'month rewritten because a new entry appeared');
  assert.deepEqual(r1.emailed, []);
  emailFails = false;
  const r2run = await handle.runCycle();
  assert.deepEqual(r2run.emailed, [shiftMonth(cur, -1)]);
});
await t('archive list for the Audit Logs page', async () => {
  const j: any = await (await fetch(`${base}/api/audit-logs/archives`)).json();
  const old = j.data.find((x: any) => x.month === shiftMonth(cur, -5));
  assert.equal(j.keepMonths, 3);
  assert.equal(j.emailTo, 'office@school.test');
  assert.ok(old.archived && old.removedFromDatabaseAt && old.entriesInDatabase === 0);
  const recent = j.data.find((x: any) => x.month === shiftMonth(cur, -1));
  assert.ok(recent.archived && !recent.removedFromDatabaseAt && recent.entriesInDatabase === 5);
});
await t('guards: download needs audit view; run / resend need Super Admin', async () => {
  guards.view = deny as any;
  guards.admin = deny as any;
  assert.equal((await fetch(`${base}/api/audit-logs/archives/${cur}/download`)).status, 403);
  assert.equal((await fetch(`${base}/api/audit-logs/archives/run`, { method: 'POST' })).status, 403);
  assert.equal((await fetch(`${base}/api/system/storage`)).status, 403);
  assert.equal((await fetch(`${base}/api/audit-logs/archives/bad/download`)).status, 403);
  guards.view = pass as any;
  assert.equal((await fetch(`${base}/api/audit-logs/archives/bad/download`)).status, 400);
});

server.close();
console.log(`\nAUDIT ARCHIVE: ${n} passed`);
process.exit(0);
