import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, RefreshCw, Search } from 'lucide-react';
import { SmsLog, UserRole } from '../../../types';
import { api } from '../../../services/api';
import { SmsLogDetailsModal } from './SmsLogDetailsModal';

interface SmsHistoryTabProps {
  userRole: UserRole;
}

const TRIGGER_LABELS: Record<string, string> = {
  DAILY_ABSENTEE: 'Absent today',
  FEE_REMINDER: 'Fee dues',
  EXAM_ANNOUNCEMENT: 'Exam schedule',
  ADMIT_CARD_PUBLISHED: 'Admit cards',
  RESULT_PUBLISHED: 'Results',
  EMERGENCY_CIRCULAR: 'Emergency / notice',
  CUSTOM: 'Custom',
};

const STATUS: Record<string, { label: string; cls: string }> = {
  DELIVERED: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  SENT: { label: 'Sent', cls: 'bg-blue-50 text-blue-800 ring-blue-200' },
  SUBMITTED: { label: 'Accepted by provider', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  FAILED: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Every SMS the server tried to send, newest first, with its delivery status. */
export const SmsHistoryTab: React.FC<SmsHistoryTabProps> = () => {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null);
  const limit = 20;

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSmsHistory({
        triggerType: triggerType !== 'ALL' ? triggerType : undefined,
        status: status !== 'ALL' ? status : undefined,
        search: search.trim() || undefined,
        date: date || undefined,
        page,
        limit,
      });
      if (res && res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setLoadError(null);
      } else {
        setLoadError('SMS history could not be loaded from the server.');
      }
    } catch {
      setLoadError('SMS history could not be loaded from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [triggerType, status, date, page]);

  const filtersOn = triggerType !== 'ALL' || status !== 'ALL' || date !== '' || search.trim() !== '';

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          fetchHistory();
        }}
        className="flex flex-wrap gap-2"
      >
        <label className="relative flex-1 min-w-[200px]">
          <span className="sr-only">Search SMS</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone, name or message"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-sm"
          />
        </label>
        <select aria-label="Type" value={triggerType} onChange={(e) => { setTriggerType(e.target.value); setPage(1); }} className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm">
          <option value="ALL">All types</option>
          {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm">
          <option value="ALL">Any status</option>
          {Object.entries(STATUS).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
        <input aria-label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm" />
        <button type="button" onClick={fetchHistory} className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Refresh SMS history">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl">
        {loadError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-rose-700">{loadError}</p>
            <button onClick={fetchHistory} className="mt-2 text-sm font-medium text-blue-700 hover:underline">Try again</button>
          </div>
        ) : isLoading && logs.length === 0 ? (
          <div className="p-4 space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-700">{filtersOn ? 'No SMS match these filters.' : 'No SMS has been sent yet.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => {
              const st = STATUS[log.status] || { label: String(log.status || 'Unknown'), cls: 'bg-slate-100 text-slate-700 ring-slate-300' };
              return (
                <li key={log.id}>
                  <button onClick={() => setSelectedLog(log)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {log.recipientName || 'Recipient'} <span className="font-normal text-slate-500 tabular-nums">· {log.recipientPhone}</span>
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-1">{log.message}</p>
                      {log.status === 'FAILED' && log.errorReason && <p className="text-xs text-rose-700 truncate">{log.errorReason}</p>}
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-slate-500">
                        {TRIGGER_LABELS[log.triggerType] || log.triggerType} · {formatTime(log.sentAt) || log.date}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && !loadError && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span className="tabular-nums">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-300 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 tabular-nums">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-300 disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedLog && (
        <SmsLogDetailsModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onStatusUpdated={(updated) => {
            setSelectedLog(updated);
            setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          }}
        />
      )}
    </div>
  );
};
