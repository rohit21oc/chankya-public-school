import React, { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, Cloud, Database, Download, Loader2, Mail, Play, RefreshCw, TriangleAlert } from 'lucide-react';
import { apiFetch } from '../../services/apiConfig';

/**
 * Audit Logs → Monthly archives. Each finished month is saved as an Excel file in the school's cloud storage
 * (Cloudflare R2) and e-mailed to the school e-mail; entries stay searchable here for `keepMonths` months, then
 * they are removed from the database (the archive keeps them). Super Admin also sees database storage use.
 */

interface ArchiveRow {
  month: string;
  entriesInDatabase: number;
  archived: boolean;
  archivedCount: number | null;
  sizeBytes: number | null;
  archivedAt: string | null;
  emailedAt: string | null;
  emailedTo: string | null;
  emailError: string | null;
  removedFromDatabaseAt: string | null;
  removalDue: string;
  current: boolean;
}

const fmtBytes = (b?: number | null) => {
  if (!b && b !== 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateOf = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');

async function getJson(url: string, init?: RequestInit) {
  try {
    const res = await apiFetch(url, init);
    const data = await res.json().catch(() => null);
    return { ok: res.ok && data?.success !== false, data };
  } catch {
    return { ok: false, data: { error: 'Network error. Check your connection.' } };
  }
}

export const AuditArchivesPanel: React.FC<{ isSuperAdmin: boolean }> = ({ isSuperAdmin }) => {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [info, setInfo] = useState<{ keepMonths: number; cloudStorage: boolean; emailTo: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [storage, setStorage] = useState<any>(null);
  const [showStorage, setShowStorage] = useState(false);

  const load = useCallback(async () => {
    const r = await getJson('/api/audit-logs/archives');
    if (r.ok) {
      setRows(r.data.data || []);
      setInfo({ keepMonths: r.data.keepMonths, cloudStorage: r.data.cloudStorage, emailTo: r.data.emailTo });
      setError(null);
    } else setError(r.data?.error || 'Archives could not be loaded.');
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const download = async (month: string) => {
    setBusy(`dl-${month}`);
    try {
      const res = await apiFetch(`/api/audit-logs/archives/${month}/download`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'Download failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      setFlash(e?.message || 'Download failed.');
    }
    setBusy(null);
  };

  const runNow = async () => {
    setBusy('run');
    const r = await getJson('/api/audit-logs/archives/run', { method: 'POST' });
    setBusy(null);
    if (!r.ok) return setFlash(r.data?.error || 'The archive job failed.');
    const x = r.data.result;
    setFlash(
      [
        x.archived.length ? `Archived: ${x.archived.join(', ')}` : 'No finished month waiting to be archived.',
        x.emailed.length ? `E-mailed: ${x.emailed.join(', ')}` : '',
        x.purged.length ? `Removed from database: ${x.purged.join(', ')}` : '',
        x.errors.length ? `Problems: ${x.errors.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    );
    void load();
  };

  const resend = async (month: string) => {
    setBusy(`em-${month}`);
    const r = await getJson(`/api/audit-logs/archives/${month}/email`, { method: 'POST' });
    setBusy(null);
    setFlash(r.ok ? `Archive for ${month} e-mailed again.` : r.data?.error || 'E-mail failed.');
    void load();
  };

  const loadStorage = async () => {
    setShowStorage(true);
    setStorage(null);
    const r = await getJson('/api/system/storage');
    setStorage(r.ok ? r.data : { error: r.data?.error || 'Could not read storage.' });
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-4 h-4 text-blue-700" /> Monthly archives
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            On the 1st of every month last month's log is saved as an Excel file in the school's cloud storage and e-mailed to{' '}
            <b>{info?.emailTo || 'the school e-mail (set it in School Settings)'}</b>. Entries stay searchable here for {info?.keepMonths ?? 3} months; after
            that they are removed from the database and kept only in the archive file. Download any month below.
          </p>
          {info && !info.cloudStorage && (
            <p className="mt-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5" /> Cloud storage (R2) is not set up: archives are not confirmed, so nothing is removed from the database.
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <button type="button" onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {isSuperAdmin && (
            <>
              <button type="button" onClick={loadStorage} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Database className="w-3.5 h-3.5" /> Database storage
              </button>
              <button type="button" onClick={runNow} disabled={busy === 'run'} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50">
                {busy === 'run' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run archive now
              </button>
            </>
          )}
        </div>
      </div>

      {flash && (
        <div role="status" className="text-xs rounded-lg bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 flex justify-between gap-3">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash(null)} className="font-semibold">
            OK
          </button>
        </div>
      )}

      {showStorage && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700 flex justify-between">
            <span>Database storage (MongoDB)</span>
            <button type="button" onClick={() => setShowStorage(false)} className="text-blue-800">
              Close
            </button>
          </div>
          {!storage ? (
            <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading…
            </div>
          ) : storage.error ? (
            <div className="p-3 text-xs text-red-700">{storage.error}</div>
          ) : !storage.connected ? (
            <div className="p-3 text-xs text-slate-600">The database is not connected (local preview).</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="px-3 pt-2 text-xs text-slate-700">
                Total used: <b>{fmtBytes(storage.totalBytes)}</b> (data + indexes). The free MongoDB Atlas plan has 512 MB.
              </div>
              <table className="w-full text-xs mt-2 min-w-[480px]">
                <thead className="text-slate-500 bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold">Collection</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Records</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Data</th>
                    <th className="text-right px-3 py-1.5 font-semibold">On disk</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Indexes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storage.data.slice(0, 40).map((c: any) => (
                    <tr key={c.name}>
                      <td className="px-3 py-1.5 font-mono text-slate-800">{c.name}</td>
                      <td className="px-3 py-1.5 text-right">{c.count.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-1.5 text-right">{fmtBytes(c.sizeBytes)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtBytes(c.storageBytes)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtBytes(c.indexBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading archives…
        </div>
      ) : error ? (
        <div className="text-xs text-red-700">
          {error}{' '}
          <button type="button" onClick={load} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-slate-500">No audit entries yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs min-w-[720px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Month</th>
                <th className="text-left px-3 py-2 font-semibold">In database</th>
                <th className="text-left px-3 py-2 font-semibold">Archive file</th>
                <th className="text-left px-3 py-2 font-semibold">E-mail</th>
                <th className="text-left px-3 py-2 font-semibold">Removed from database</th>
                <th className="text-right px-3 py-2 font-semibold">Excel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    {monthName(r.month)}
                    {r.current && <span className="ml-1.5 text-[10px] font-bold text-blue-700">(running)</span>}
                  </td>
                  <td className="px-3 py-2">{r.entriesInDatabase.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">
                    {r.archived ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <Cloud className="w-3.5 h-3.5" /> Saved · {r.archivedCount} · {fmtBytes(r.sizeBytes)}
                      </span>
                    ) : r.current ? (
                      <span className="text-slate-500">On 1st of next month</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.emailedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {dateOf(r.emailedAt)}
                      </span>
                    ) : r.emailError ? (
                      <span className="text-red-700" title={r.emailError}>
                        Failed
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {isSuperAdmin && r.archived && (
                      <button type="button" onClick={() => resend(r.month)} disabled={busy === `em-${r.month}`} className="ml-2 inline-flex items-center gap-1 text-blue-800 font-semibold hover:underline disabled:opacity-50">
                        <Mail className="w-3 h-3" /> {r.emailedAt ? 'Resend' : 'Send'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.removedFromDatabaseAt ? dateOf(r.removedFromDatabaseAt) : r.current ? '—' : `Due ${r.removalDue === 'now' ? 'now (after archive)' : r.removalDue}`}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => download(r.month)}
                      disabled={busy === `dl-${r.month}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-900 font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {busy === `dl-${r.month}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
