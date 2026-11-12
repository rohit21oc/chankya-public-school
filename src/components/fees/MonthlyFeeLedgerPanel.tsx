import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Printer, RefreshCw, Search, X } from 'lucide-react';
import { AcademicClass, FeeLedgerEntry, FeePayment } from '../../types';
import { api } from '../../services/api';
import { StatusPill } from '../modals/CollectPaymentModal';
import { classLabel, formatDate, inr, ledgerDue, ledgerPeriod, ledgerStatus } from './feeFormat';

interface MonthlyFeeLedgerPanelProps {
  onOpenReceipt: (payment: FeePayment) => void;
  classes: AcademicClass[];
  onSelectStudent?: (studentId: string) => void;
  /** Opens the full-page payment screen for this student. */
  onCollect?: (studentId: string) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "April 2026" … "March 2027" for the active session (e.g. 2026-2027). */
function sessionMonths(session: string): string[] {
  const start = Number(String(session).split('-')[0]) || new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const m = (3 + i) % 12;
    return `${MONTHS[m]} ${m >= 3 ? start : start + 1}`;
  });
}

export const MonthlyFeeLedgerPanel: React.FC<MonthlyFeeLedgerPanelProps> = ({ onOpenReceipt, classes, onSelectStudent, onCollect }) => {
  const [ledgers, setLedgers] = useState<FeeLedgerEntry[]>(() => api.getFeeLedgersSync());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | 'UNPAID' | 'OVERDUE' | 'PARTIAL' | 'PAID'>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');

  const session = api.getActiveAcademicSession()?.name || '2026-2027';
  const months = sessionMonths(session);
  const currentMonth = `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;
  const [genOpen, setGenOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(months.includes(currentMonth) ? currentMonth : months[0]);
  const [genClass, setGenClass] = useState('ALL');
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setLedgers(await api.getFeeLedgers());
    } catch {
      setLoadError('Could not load invoices. Showing the last saved copy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenBusy(true);
    setGenError(null);
    const res = await api.generateMonthlyFees({
      academicSession: session,
      monthYear: genMonth,
      classId: genClass === 'ALL' ? undefined : genClass,
    });
    setGenBusy(false);
    if (!res.success) {
      setGenError(res.message);
      return;
    }
    setGenOpen(false);
    await load();
    setFeedback({ ok: true, text: res.message });
  };

  const printReceipt = (l: FeeLedgerEntry) => {
    const payment = api
      .getFeePayments(l.studentId)
      .find((p) => (p as any).ledgerId === l.id || (l.receiptNumber && p.receiptNumber === l.receiptNumber) || String(p.invoiceNumber || '').split(', ').includes(String(l.invoiceNumber)));
    if (payment) onOpenReceipt(payment);
    else setFeedback({ ok: false, text: `No saved receipt was found for ${l.invoiceNumber || 'this invoice'}. Open the student's account to see their payments.` });
  };

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    ledgers.forEach((l) => l.monthYear && set.add(l.monthYear));
    return months.filter((m) => set.has(m)).concat(Array.from(set).filter((m) => !months.includes(m)));
  }, [ledgers, months]);

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return ledgers
      .filter((l) => {
        if (!l?.id || seen.has(l.id)) return false;
        seen.add(l.id);
        const st = ledgerStatus(l).label;
        if (status === 'UNPAID' && ledgerDue(l) <= 0) return false;
        if (status === 'OVERDUE' && st !== 'Overdue') return false;
        if (status === 'PARTIAL' && !(Number(l.paidAmount) > 0 && ledgerDue(l) > 0)) return false;
        if (status === 'PAID' && st !== 'Paid') return false;
        if (classFilter !== 'ALL' && l.className !== classFilter) return false;
        if (monthFilter !== 'ALL' && (l.monthYear || l.feeMonth) !== monthFilter) return false;
        if (term && ![l.studentName, l.admissionNumber, l.invoiceNumber].some((v) => String(v || '').toLowerCase().includes(term))) return false;
        return true;
      })
      .sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')) || String(a.studentName).localeCompare(String(b.studentName)));
  }, [ledgers, status, classFilter, monthFilter, term]);

  const billed = rows.reduce((s, l) => s + Number(l.total ?? l.totalAmount ?? l.amount ?? 0), 0);
  const received = rows.reduce((s, l) => s + (Number(l.paidAmount) || 0), 0);
  const pending = rows.reduce((s, l) => s + ledgerDue(l), 0);
  const selectCls = 'h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Billed" value={inr(billed)} note={`${rows.length} invoice${rows.length === 1 ? '' : 's'}`} />
        <Stat label="Received" value={inr(received)} tone="success" />
        <Stat label="Still due" value={inr(pending)} tone={pending > 0 ? 'danger' : undefined} />
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg border text-sm ${
            feedback.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span className="flex gap-2">
            {feedback.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
            {feedback.text}
          </span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss" className="shrink-0">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Student, admission no. or invoice no."
              aria-label="Search invoices"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
            />
          </div>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} aria-label="Month" className={selectCls}>
            <option value="ALL">All months</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Class" className={selectCls}>
            <option value="ALL">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="Status" className={selectCls}>
            <option value="ALL">Any status</option>
            <option value="UNPAID">Not fully paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PARTIAL">Part paid</option>
            <option value="PAID">Paid</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          <button
            id="btn-open-generate-monthly-fees"
            type="button"
            onClick={() => {
              setGenError(null);
              setGenOpen(true);
            }}
            className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Create monthly bills
          </button>
        </div>

        {loadError && <p className="px-4 py-2 text-sm text-amber-800 bg-amber-50 border-b border-amber-200">{loadError}</p>}

        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-600">
            {ledgers.length === 0 ? 'No invoices yet. Bills are created automatically each month once students are admitted.' : 'No invoice matches these filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Bill</th>
                  <th className="px-4 py-3 font-medium">Fee heads</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((l) => {
                  const due = ledgerDue(l);
                  const st = ledgerStatus(l);
                  const heads = (l.breakdown || []).filter((b) => Number(b.amount) > 0);
                  return (
                    <tr key={l.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {onSelectStudent ? (
                          <button type="button" onClick={() => onSelectStudent(l.studentId)} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline text-left">
                            {l.studentName}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-900">{l.studentName}</span>
                        )}
                        <span className="block text-xs text-slate-500">
                          {classLabel(l.className, l.section)} · {l.admissionNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-slate-900">{ledgerPeriod(l)}</span>
                        <span className="block text-xs text-slate-500 font-mono">{l.invoiceNumber || l.id}</span>
                        {l.dueDate && <span className="block text-xs text-slate-500">Due {formatDate(l.dueDate)}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 min-w-[14rem]">
                        {heads.length === 0 ? (
                          <span>{l.feeType}</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {heads.map((b, i) => (
                              <li key={i} className="flex justify-between gap-3 text-xs">
                                <span>{b.head}</span>
                                <span className="tabular-nums">{inr(b.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900 whitespace-nowrap">{inr(l.total ?? l.totalAmount ?? l.amount)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap ${due > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{inr(due)}</td>
                      <td className="px-4 py-3">
                        <StatusPill {...st} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {due > 0 && onCollect && (
                            <button
                              id={`btn-collect-ledger-${l.id}`}
                              type="button"
                              onClick={() => onCollect(l.studentId)}
                              className="h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
                            >
                              Collect
                            </button>
                          )}
                          {Number(l.paidAmount) > 0 && (
                            <button
                              id={`btn-print-ledger-${l.id}`}
                              type="button"
                              onClick={() => printReceipt(l)}
                              aria-label={`Receipt for ${l.invoiceNumber || 'this invoice'}`}
                              title="Receipt"
                              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                            >
                              <Printer className="w-4 h-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {genOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="gen-title">
          <form onSubmit={handleGenerate} className="bg-white rounded-xl w-full max-w-md border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="gen-title" className="text-base font-semibold text-slate-900">Create monthly bills</h3>
              <button type="button" onClick={() => setGenOpen(false)} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                Uses each class's fee setup plus the student's transport and hostel charges. Students who already have a bill for the month are skipped.
              </p>
              <div>
                <label htmlFor="gen-month" className="block text-sm font-medium text-slate-700 mb-1.5">Month</label>
                <select id="gen-month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} className={`${selectCls} w-full`}>
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gen-class" className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
                <select id="gen-class" value={genClass} onChange={(e) => setGenClass(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="ALL">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {genError && (
                <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{genError}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setGenOpen(false)} className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={genBusy} className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-sm font-semibold">
                {genBusy ? 'Creating…' : 'Create bills'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; note?: string; tone?: 'success' | 'danger' }> = ({ label, value, note, tone }) => (
  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
    <p className="text-sm text-slate-600">{label}</p>
    <p className={`text-xl font-semibold tabular-nums ${tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p>
    {note && <p className="text-xs text-slate-500">{note}</p>}
  </div>
);
