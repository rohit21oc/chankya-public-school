import type { Express, Request, RequestHandler, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.ts';
import { Store } from '../services/memoryStore.ts';
import { buildXlsx } from '../services/xlsxWriter.ts';
import {
  ARCHIVE_COLUMNS,
  ARCHIVE_WIDTHS,
  archiveFileKey,
  archiveFileName,
  archiveRow,
  isMonthKey,
  istMonth,
  KEEP_MONTHS,
  monthDiff,
  monthOfTimestamp,
  monthRange,
  monthsToArchive,
  monthsToEmail,
  monthsToPurge,
  shiftMonth,
  type ArchiveRecord,
} from '../services/auditArchiveRules.ts';

/**
 * Monthly audit-log archive (see server/services/auditArchiveRules.ts for the rules):
 *  - every hour the server checks; finished months are written to an Excel file, saved in Cloudflare R2
 *    (read back to confirm) and e-mailed to the school's e-mail (School Settings);
 *  - entries older than KEEP_MONTHS full months are deleted from MongoDB only when that month's confirmed
 *    archive file holds all of them;
 *  - Audit Logs page: list of archives, download any month, run now, resend e-mail; storage use per collection.
 */

const AuditArchiveSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    month: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    fileKey: { type: String },
    sizeBytes: { type: Number },
    verified: { type: Boolean, default: false },
    createdAt: { type: String },
    emailedAt: { type: String },
    emailedTo: { type: String },
    emailAttempts: { type: Number, default: 0 },
    emailError: { type: String },
    purgedAt: { type: String },
    purgedCount: { type: Number },
  },
  { collection: 'audit_archives' }
);
export const AuditArchiveModel: mongoose.Model<any> = mongoose.models.AuditArchive || mongoose.model('AuditArchive', AuditArchiveSchema);

export interface AuditArchiveDeps {
  viewGuard: RequestHandler; // audit_logs.view
  adminGuard: RequestHandler; // Super Admin
  /** In-memory copy of the audit log (newest first). */
  getMemoryLogs: () => any[];
  setMemoryLogs: (logs: any[]) => void;
  removeFromDisk: (ids: Set<string>) => void;
  storage: {
    isConfigured: () => boolean;
    upload: (key: string, buf: Buffer, contentType: string) => Promise<unknown>;
    get: (key: string) => Promise<{ buffer: Buffer } | null>;
  };
  sendEmail: (o: { to: string; subject: string; html: string; attachments?: Array<{ name: string; contentBase64: string }> }) => Promise<{ success: boolean; error?: string }>;
  getSchoolEmail: () => string;
  getSchoolName: () => string;
  getPortalUrl: () => string;
  logAudit: (userName: string, role: string, action: string, entity: string, entityId: string, details: string) => void;
  /** Local disk fallback for the archive file when R2 is not set up (preview / tests). Never used for deletion. */
  saveLocal: (name: string, buf: Buffer) => void;
  readLocal: (name: string) => Buffer | null;
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Attach the file when it is small enough for e-mail; otherwise only the download link is sent. */
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
const mongoUp = () => mongoose.connection.readyState === 1;
const nowIso = () => new Date().toISOString();

/** MongoDB filter for one IST month (timestamps are "YYYY-MM-DD HH:mm:ss" UTC; a few older ones are ISO). */
function monthFilter(month: string) {
  const { from, to } = monthRange(month);
  return {
    $or: [
      { timestamp: { $gte: from, $lt: to, $not: /T/ } },
      { timestamp: { $gte: from.replace(' ', 'T'), $lt: to.replace(' ', 'T'), $regex: /T/ } },
    ],
  };
}

export function registerAuditArchiveRoutes(app: Express, d: AuditArchiveDeps) {
  const archives = new Store<any>(AuditArchiveModel, 'month', 'AuditArchive');
  let running: Promise<any> | null = null;
  let lastRun: { at: string; archived: string[]; emailed: string[]; purged: string[]; errors: string[] } | null = null;

  /** Entries of one month, oldest first. */
  const logsOfMonth = async (month: string): Promise<any[]> => {
    if (mongoUp()) {
      const docs = await AuditLogModel.find(monthFilter(month)).sort({ timestamp: 1 }).lean();
      return docs.map(({ _id, __v, ...rest }: any) => rest);
    }
    return d
      .getMemoryLogs()
      .filter((l) => monthOfTimestamp(l.timestamp) === month)
      .sort((x, y) => String(x.timestamp).localeCompare(String(y.timestamp)));
  };

  /** How many entries each past month has (up to 5 years back), plus the current month. */
  const monthCounts = async (current: string): Promise<Array<{ month: string; count: number }>> => {
    if (mongoUp()) {
      const oldest: any = await AuditLogModel.findOne({}, { timestamp: 1 }).sort({ timestamp: 1 }).lean();
      const first = oldest ? monthOfTimestamp(oldest.timestamp) : null;
      if (!first) return [];
      const out: Array<{ month: string; count: number }> = [];
      for (let m = monthDiff(first, current) > 60 ? shiftMonth(current, -60) : first; monthDiff(m, current) >= 0; m = shiftMonth(m, 1)) {
        const count = await AuditLogModel.countDocuments(monthFilter(m));
        if (count) out.push({ month: m, count });
      }
      return out;
    }
    const map = new Map<string, number>();
    for (const l of d.getMemoryLogs()) {
      const m = monthOfTimestamp(l.timestamp);
      if (m) map.set(m, (map.get(m) || 0) + 1);
    }
    return [...map.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
  };

  const workbookFor = (month: string, logs: any[]) =>
    buildXlsx([
      { name: `Audit ${month}`, rows: [ARCHIVE_COLUMNS, ...logs.map(archiveRow)], widths: ARCHIVE_WIDTHS },
      {
        name: 'About',
        rows: [
          ['School', d.getSchoolName()],
          ['Month', month],
          ['Entries', logs.length],
          ['Times', 'India Standard Time (IST)'],
          ['Created', new Date(Date.now() + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' IST'],
          ['Note', 'Secrets (passwords, tokens) were masked when the entries were written.'],
        ],
        widths: [14, 80],
      },
    ]);

  /** Writes one month's file to R2 and confirms it by reading it back. */
  const archiveMonth = async (month: string) => {
    const logs = await logsOfMonth(month);
    const buf = workbookFor(month, logs);
    const key = archiveFileKey(month);
    let verified = false;
    if (d.storage.isConfigured()) {
      await d.storage.upload(key, buf, XLSX_TYPE);
      const back = await d.storage.get(key);
      verified = !!back && back.buffer.length === buf.length;
    } else {
      d.saveLocal(archiveFileName(month), buf); // preview only: kept on disk, never counts as a safe copy
    }
    await archives.ready();
    const prev = archives.items.find((a) => a.month === month);
    const rec = {
      ...(prev || {}),
      id: prev?.id || `aa-${month}`,
      month,
      count: logs.length,
      fileKey: key,
      sizeBytes: buf.length,
      verified,
      createdAt: nowIso(),
      // A rewritten file is e-mailed again.
      ...(prev && prev.count !== logs.length ? { emailedAt: undefined, emailAttempts: 0, emailError: undefined } : {}),
    };
    await archives.upsert(rec);
    return { rec, buf };
  };

  const emailMonth = async (month: string, buf?: Buffer) => {
    await archives.ready();
    const rec = archives.items.find((a) => a.month === month);
    if (!rec) return { ok: false, error: 'No archive for this month.' };
    const to = String(d.getSchoolEmail() || process.env.AUDIT_ARCHIVE_EMAIL || '').trim();
    if (!to) {
      await archives.upsert({ ...rec, emailError: 'No school e-mail in School Settings.' });
      return { ok: false, error: 'Add the school e-mail in School Settings first.' };
    }
    const file = buf || (rec.verified ? (await d.storage.get(rec.fileKey))?.buffer : d.readLocal(archiveFileName(month))) || null;
    const attach = !!file && file.length <= MAX_ATTACHMENT_BYTES;
    const link = `${d.getPortalUrl().replace(/\/+$/, '')}/audit-logs`;
    const r = await d.sendEmail({
      to,
      subject: `Audit log archive ${month} · ${d.getSchoolName()}`,
      html: `<p>Audit log archive for <b>${month}</b>: ${rec.count} entries.</p>
<p>${attach ? 'The Excel file is attached.' : 'The file is too large to attach.'} It is also saved safely in the school's cloud storage and can be downloaded any time from <a href="${link}">Audit Logs → Monthly archives</a> (Super Admin / School Admin / Principal login).</p>
<p>Entries stay searchable on the website for ${KEEP_MONTHS} months after the month ends; after that only this archive keeps them.</p>`,
      attachments: attach ? [{ name: archiveFileName(month), contentBase64: file!.toString('base64') }] : undefined,
    });
    const next = { ...rec, emailAttempts: (rec.emailAttempts || 0) + 1, ...(r.success ? { emailedAt: nowIso(), emailedTo: to, emailError: undefined } : { emailError: r.error || 'E-mail failed.' }) };
    await archives.upsert(next);
    return { ok: r.success, error: r.error };
  };

  const purgeMonth = async (month: string) => {
    const logs = await logsOfMonth(month);
    const ids = new Set(logs.map((l) => l.id));
    if (mongoUp()) await AuditLogModel.deleteMany(monthFilter(month));
    d.setMemoryLogs(d.getMemoryLogs().filter((l) => !ids.has(l.id)));
    d.removeFromDisk(ids);
    await archives.ready();
    const rec = archives.items.find((a) => a.month === month);
    await archives.upsert({ ...rec, purgedAt: nowIso(), purgedCount: ids.size });
    return ids.size;
  };

  /** One pass: archive finished months, (re)send e-mails, delete what is safely archived and old enough. */
  const runCycle = (): Promise<any> => {
    if (running) return running;
    running = (async () => {
      const result = { at: nowIso(), archived: [] as string[], emailed: [] as string[], purged: [] as string[], errors: [] as string[] };
      try {
        await archives.ready();
        const current = istMonth();
        const counts = await monthCounts(current);
        const due = monthsToArchive(counts, archives.items as ArchiveRecord[], current).filter((m) => {
          // Without cloud storage a month is written once (kept on disk, never deleted) unless new entries appear.
          if (d.storage.isConfigured()) return true;
          const a = archives.items.find((x) => x.month === m);
          return !a || a.count !== counts.find((c) => c.month === m)?.count;
        });
        for (const m of due) {
          try {
            const { rec, buf } = await archiveMonth(m);
            result.archived.push(m);
            if (rec.verified || !d.storage.isConfigured()) {
              const e = await emailMonth(m, buf);
              if (e.ok) result.emailed.push(m);
              else if (e.error) result.errors.push(`${m} e-mail: ${e.error}`);
            }
          } catch (err: any) {
            result.errors.push(`${m}: ${err?.message || err}`);
          }
        }
        for (const m of monthsToEmail(archives.items as ArchiveRecord[])) {
          if (result.emailed.includes(m) || result.archived.includes(m)) continue;
          const e = await emailMonth(m);
          if (e.ok) result.emailed.push(m);
        }
        const fresh = await monthCounts(current);
        for (const m of monthsToPurge(fresh, archives.items as ArchiveRecord[], current)) {
          try {
            const n = await purgeMonth(m);
            result.purged.push(m);
            d.logAudit('System', 'SYSTEM', 'AUDIT_LOGS_ARCHIVED_REMOVED', 'AuditLog', m, `${n} audit entries of ${m} removed from the database after the Excel archive was confirmed in cloud storage (${archiveFileKey(m)})`);
          } catch (err: any) {
            result.errors.push(`${m} delete: ${err?.message || err}`);
          }
        }
        if (result.archived.length) {
          d.logAudit('System', 'SYSTEM', 'AUDIT_LOGS_ARCHIVED', 'AuditLog', result.archived.join(','), `Monthly audit archive written for ${result.archived.join(', ')}`);
        }
      } catch (err: any) {
        result.errors.push(String(err?.message || err));
      }
      if (result.archived.length || result.purged.length || result.errors.length) console.log('[AuditArchive]', JSON.stringify(result));
      lastRun = result;
      return result;
    })().finally(() => {
      running = null;
    });
    return running;
  };

  // Every hour (first check 3 minutes after start, when the database is up).
  if (process.env.NODE_ENV !== 'test' && process.env.AUDIT_ARCHIVE_DISABLED !== '1') {
    setTimeout(() => void runCycle().catch(() => undefined), 3 * 60 * 1000);
    setInterval(() => void runCycle().catch(() => undefined), 60 * 60 * 1000).unref?.();
  }

  // ------------------------------------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------------------------------------

  app.get('/api/audit-logs/archives', d.viewGuard, async (_req: Request, res: Response) => {
    await archives.ready();
    const current = istMonth();
    const counts = await monthCounts(current).catch(() => []);
    const months = new Set<string>([...counts.map((c) => c.month), ...archives.items.map((a) => a.month)]);
    const rows = [...months]
      .sort()
      .reverse()
      .map((m) => {
        const a = archives.items.find((x) => x.month === m);
        const inDb = counts.find((c) => c.month === m)?.count || 0;
        return {
          month: m,
          entriesInDatabase: inDb,
          archived: !!a?.verified,
          archivedCount: a?.count ?? null,
          sizeBytes: a?.sizeBytes ?? null,
          archivedAt: a?.createdAt ?? null,
          emailedAt: a?.emailedAt ?? null,
          emailedTo: a?.emailedTo ?? null,
          emailError: a?.emailError ?? null,
          removedFromDatabaseAt: a?.purgedAt ?? null,
          removalDue: monthDiff(m, current) > KEEP_MONTHS ? 'now' : shiftMonth(m, KEEP_MONTHS + 1) + '-01',
          current: m === current,
        };
      });
    res.json({
      success: true,
      keepMonths: KEEP_MONTHS,
      cloudStorage: d.storage.isConfigured(),
      emailTo: d.getSchoolEmail() || null,
      lastRun,
      data: rows,
    });
  });

  /** Excel for one month: the saved archive file, or (not archived yet) built from the database now. */
  app.get('/api/audit-logs/archives/:month/download', d.viewGuard, async (req: Request, res: Response) => {
    const month = String(req.params.month);
    if (!isMonthKey(month)) return res.status(400).json({ success: false, error: 'Month must be YYYY-MM.' });
    await archives.ready();
    const a = archives.items.find((x) => x.month === month);
    let buf: Buffer | null = null;
    if (a?.verified) buf = (await d.storage.get(a.fileKey))?.buffer || null;
    if (!buf && !a?.purgedAt) {
      const logs = await logsOfMonth(month);
      if (logs.length) buf = workbookFor(month, logs);
    }
    if (!buf && a && !a.verified) buf = d.readLocal(archiveFileName(month));
    if (!buf) return res.status(404).json({ success: false, error: 'No audit entries or archive for this month.' });
    const me: any = (req as any).currentUser;
    d.logAudit(me?.name || 'User', me?.role || '', 'AUDIT_ARCHIVE_DOWNLOADED', 'AuditLog', month, `Audit log Excel for ${month} downloaded`);
    res.setHeader('Content-Type', XLSX_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${archiveFileName(month)}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  });

  /** Super Admin: run the monthly job now (archive finished months, e-mail, delete what is due). */
  app.post('/api/audit-logs/archives/run', d.adminGuard, async (_req: Request, res: Response) => {
    try {
      const r = await runCycle();
      res.json({ success: true, result: r });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'The archive job failed.' });
    }
  });

  /** Super Admin: e-mail one month's archive again. */
  app.post('/api/audit-logs/archives/:month/email', d.adminGuard, async (req: Request, res: Response) => {
    const month = String(req.params.month);
    if (!isMonthKey(month)) return res.status(400).json({ success: false, error: 'Month must be YYYY-MM.' });
    const r = await emailMonth(month);
    if (!r.ok) return res.status(400).json({ success: false, error: r.error || 'E-mail failed.' });
    res.json({ success: true });
  });

  /** Super Admin: how much space each MongoDB collection uses. */
  app.get('/api/system/storage', d.adminGuard, async (_req: Request, res: Response) => {
    if (!mongoUp() || !mongoose.connection.db) return res.json({ success: true, connected: false, data: [] });
    const db = mongoose.connection.db;
    const cols = await db.listCollections({}, { nameOnly: true }).toArray();
    const data: Array<{ name: string; count: number; sizeBytes: number; storageBytes: number; indexBytes: number }> = [];
    for (const c of cols) {
      try {
        const [st]: any[] = await db.collection(c.name).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
        const s = st?.storageStats || {};
        data.push({ name: c.name, count: Number(s.count) || 0, sizeBytes: Number(s.size) || 0, storageBytes: Number(s.storageSize) || 0, indexBytes: Number(s.totalIndexSize) || 0 });
      } catch {
        data.push({ name: c.name, count: await db.collection(c.name).estimatedDocumentCount().catch(() => 0), sizeBytes: 0, storageBytes: 0, indexBytes: 0 });
      }
    }
    data.sort((x, y) => y.storageBytes + y.indexBytes - (x.storageBytes + x.indexBytes) || y.count - x.count);
    let dbStats: any = null;
    try {
      dbStats = await db.stats();
    } catch {}
    res.json({
      success: true,
      connected: true,
      totalBytes: data.reduce((n, c) => n + c.storageBytes + c.indexBytes, 0),
      dataBytes: dbStats ? Number(dbStats.dataSize) || null : null,
      data,
    });
  });

  return { runCycle };
}
