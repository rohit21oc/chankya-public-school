import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plus, Printer, Search } from 'lucide-react';
import { FeeLedgerEntry, FeePayment, SchoolSettings, Student, UserRole, User } from '../../types';
import { api } from '../../services/api';
import { PrintableReceiptModal } from '../modals/PrintableReceiptModal';
import { CollectPaymentModal } from '../modals/CollectPaymentModal';
import { useRealtimeListener } from '../../hooks/useRealtime';
import { ClassFeeConfigPanel } from '../fees/ClassFeeConfigPanel';
import { MonthlyFeeLedgerPanel } from '../fees/MonthlyFeeLedgerPanel';
import { StudentFeeProfile } from '../fees/StudentFeeProfile';
import { StudentFeeSearchPanel } from '../fees/StudentFeeSearchPanel';
import { ParentFeesView } from '../parent/ParentFeesView';
import { classLabel, formatDate, inr, ledgerDue, methodLabel } from '../fees/feeFormat';

type FeesTab = 'STUDENT_LEDGER' | 'LEDGER' | 'CONFIG' | 'TRANSACTIONS' | 'STRUCTURES' | 'DEFAULTERS';

interface FeesViewProps {
  userRole: UserRole;
  currentUser?: User;
  settings: SchoolSettings;
  initialTab?: FeesTab;
  onTabChange?: (tab: FeesTab) => void;
}

const TABS: { id: Exclude<FeesTab, 'STRUCTURES'>; domId: string; label: string }[] = [
  { id: 'STUDENT_LEDGER', domId: 'tab-student-fee-profile', label: 'Students' },
  { id: 'LEDGER', domId: 'tab-monthly-ledger', label: 'Invoices' },
  { id: 'TRANSACTIONS', domId: 'tab-payment-transactions', label: 'Payments' },
  { id: 'DEFAULTERS', domId: 'tab-fee-defaulters', label: 'Dues' },
  { id: 'CONFIG', domId: 'tab-fee-configurations', label: 'Fee setup' },
];

export const FeesView: React.FC<FeesViewProps> = (props) => {
  // Parents pay for their child, students for themselves; the server allows only their own bills.
  if (props.userRole === 'PARENT' || props.userRole === 'STUDENT') {
    return <ParentFeesView currentUser={props.currentUser} settings={props.settings} />;
  }
  return <StaffFeesView {...props} />;
};

const StaffFeesView: React.FC<FeesViewProps> = ({ settings, initialTab, onTabChange }) => {
  // "Fee schedules" was an old, unused list; its links now open Fee setup.
  const normalise = (t?: FeesTab): FeesTab => (t === 'STRUCTURES' ? 'CONFIG' : t || 'STUDENT_LEDGER');
  const [activeTab, setActiveTab] = useState<FeesTab>(() => normalise(initialTab));
  // Read the shared cache on every render; `refresh` only triggers a re-render. A snapshot taken on first render
  // went stale while data was still loading, so Dues showed "no dues" and Collect fee showed no students.
  const [, setTick] = useState(0);
  const [ledgersLoaded, setLedgersLoaded] = useState(() => api.getFeeLedgersSync().length > 0);
  const payments = api.getFeePayments();
  const ledgers = api.getFeeLedgersSync();
  const students = api.getStudents();
  const classes = api.getClasses();

  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [collectFor, setCollectFor] = useState<{ student: Student; ledgers: FeeLedgerEntry[] } | null>(null);
  const [receipt, setReceipt] = useState<FeePayment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    api.fetchFeePayments().then(refresh).catch(() => {});
    api
      .getFeeLedgers()
      .catch(() => {})
      .finally(() => {
        setLedgersLoaded(true);
        refresh();
      });
  }, []);

  useRealtimeListener(['FEE_PAYMENT', 'FEE_STRUCTURE', 'STUDENT', 'SESSION', 'FEE_LEDGER'], refresh);

  useEffect(() => {
    if (initialTab && normalise(initialTab) !== activeTab) setActiveTab(normalise(initialTab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const changeTab = (tab: FeesTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const openStudent = (id: string) => {
    setProfileStudentId(id);
    changeTab('STUDENT_LEDGER');
  };

  const startCollect = async (student: Student) => {
    setLauncherOpen(false);
    const overview = await api.getStudentFeeOverview(student.id).catch(() => null);
    const list = overview?.ledgers?.length ? overview.ledgers : api.getFeeLedgersSync(student.id);
    setCollectFor({ student: overview?.student || student, ledgers: list });
  };

  const monthKey = new Date().toISOString().substring(0, 7);
  const collectedThisMonth = payments
    .filter((p) => String(p.paymentDate || '').substring(0, 7) === monthKey)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Fees & Accounts</h2>
          <p className="text-sm text-slate-600">
            Collected this month: <span className="font-semibold text-slate-900 tabular-nums">{inr(collectedThisMonth)}</span>
          </p>
        </div>
        <button
          id="btn-collect-fee"
          type="button"
          onClick={() => setLauncherOpen(true)}
          className="h-10 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Collect fee
        </button>
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-800 font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={t.domId}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => changeTab(t.id)}
            className={`h-11 px-4 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'border-emerald-700 text-emerald-800 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
            {t.id === 'TRANSACTIONS' && payments.length > 0 && <span className="ml-1.5 text-slate-500 font-normal">({payments.length})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'STUDENT_LEDGER' &&
        (profileStudentId ? (
          <StudentFeeProfile
            studentId={profileStudentId}
            onBack={() => setProfileStudentId(null)}
            onSelectStudent={(id) => setProfileStudentId(id)}
            settings={settings}
          />
        ) : (
          <StudentFeeSearchPanel onSelectStudent={(id) => setProfileStudentId(id)} settings={settings} />
        ))}

      {activeTab === 'LEDGER' && (
        <MonthlyFeeLedgerPanel
          onOpenReceipt={(p) => setReceipt(p)}
          classes={classes}
          onSelectStudent={openStudent}
          onCollect={(studentId) => {
            const st = students.find((s) => s.id === studentId);
            if (st) startCollect(st);
          }}
        />
      )}

      {activeTab === 'CONFIG' && <ClassFeeConfigPanel />}

      {activeTab === 'TRANSACTIONS' && (
        <PaymentsTable payments={payments} students={students} onOpenStudent={openStudent} onPrint={setReceipt} />
      )}

      {activeTab === 'DEFAULTERS' && (
        <DuesList ledgers={ledgers} students={students} loaded={ledgersLoaded} onOpenStudent={openStudent} onCollect={startCollect} />
      )}

      {launcherOpen && (
        <CollectLauncher students={students} ledgers={ledgers} onClose={() => setLauncherOpen(false)} onPick={startCollect} />
      )}

      {collectFor && (
        <CollectPaymentModal
          isOpen
          student={collectFor.student}
          ledgers={collectFor.ledgers}
          onClose={() => setCollectFor(null)}
          onPaymentSuccess={(payment) => {
            refresh();
            setReceipt(payment);
            setNotice(`${inr(payment.amount)} received from ${payment.studentName}. Receipt ${payment.receiptNumber}.`);
          }}
        />
      )}

      {receipt && (
        <PrintableReceiptModal
          payment={receipt}
          student={students.find((s) => s.id === receipt.studentId)}
          isOpen
          onClose={() => setReceipt(null)}
          settings={settings}
        />
      )}
    </div>
  );
};

/** Full-page student picker in front of the payment page. */
const CollectLauncher: React.FC<{
  students: Student[];
  ledgers: FeeLedgerEntry[];
  onClose: () => void;
  onPick: (s: Student) => void;
}> = ({ students, ledgers, onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const dueByStudent = useMemo(() => {
    const m = new Map<string, number>();
    ledgers.forEach((l) => m.set(l.studentId, (m.get(l.studentId) || 0) + ledgerDue(l)));
    return m;
  }, [ledgers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Until the student list has loaded, offer the students who have bills.
  const pool = useMemo(() => {
    if (students.length > 0) return students;
    const seen = new Map<string, Student>();
    ledgers.forEach((l) => {
      if (l.studentId && !seen.has(l.studentId)) {
        seen.set(l.studentId, { id: l.studentId, name: l.studentName, admissionNumber: l.admissionNumber, className: l.className, section: l.section } as Student);
      }
    });
    return Array.from(seen.values());
  }, [students, ledgers]);

  const term = q.trim().toLowerCase();
  const list = pool
    .filter((s) => s.status !== 'TRANSFERRED' && s.status !== 'WITHDRAWN')
    .filter((s) => {
      if (!term) return true;
      return [s.name, s.admissionNumber, s.registrationNumber, s.fatherName, s.parentName, s.fatherMobile, s.parentPhone, s.mobile]
        .some((v) => String(v || '').toLowerCase().includes(term));
    })
    .sort((a, b) => (dueByStudent.get(b.id) || 0) - (dueByStudent.get(a.id) || 0) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 50);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Collect fee">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back
          </button>
          <h1 className="text-base font-semibold text-slate-900">Collect fee</h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <label htmlFor="collect-search" className="block text-sm font-medium text-slate-700">
          Find the student
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="collect-search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, admission no., parent name or mobile"
            className="w-full h-12 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
          {list.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-600">
              {pool.length === 0 ? 'No students have been admitted yet.' : 'No student matches this search.'}
            </p>
          ) : (
            list.map((s) => {
              const due = dueByStudent.get(s.id) || 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => {
                    setBusyId(s.id);
                    onPick(s);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      {classLabel(s.className, s.section)} · Adm. no. {s.admissionNumber}
                      {s.fatherName ? ` · ${s.fatherName}` : ''}
                    </span>
                  </span>
                  {busyId === s.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" aria-hidden />
                  ) : due > 0 ? (
                    <span className="text-sm font-semibold tabular-nums text-rose-700">{inr(due)} due</span>
                  ) : (
                    <span className="text-sm text-emerald-700">No dues</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentsTable: React.FC<{
  payments: FeePayment[];
  students: Student[];
  onOpenStudent: (id: string) => void;
  onPrint: (p: FeePayment) => void;
}> = ({ payments, onOpenStudent, onPrint }) => {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = payments
    .filter((p) => !term || [p.receiptNumber, p.studentName, p.admissionNumber, p.transactionReference].some((v) => String(v || '').toLowerCase().includes(term)))
    .sort((a, b) => String(b.paymentDate || b.createdAt || '').localeCompare(String(a.paymentDate || a.createdAt || '')));
  const total = rows.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {rows.length} payment{rows.length === 1 ? '' : 's'} · <span className="font-semibold text-slate-900 tabular-nums">{inr(total)}</span>
        </p>
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Receipt no., student or reference"
            aria-label="Search payments"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-600">
          {payments.length === 0 ? 'No fee has been collected yet. Use “Collect fee” to record the first payment.' : 'No payment matches this search.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">For</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Received by</th>
                <th className="px-4 py-3"><span className="sr-only">Print</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id || p.receiptNumber} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-900 whitespace-nowrap">{p.receiptNumber}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-3">
                    {p.studentId ? (
                      <button type="button" onClick={() => onOpenStudent(p.studentId)} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline text-left">
                        {p.studentName}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-900">{p.studentName}</span>
                    )}
                    <span className="block text-xs text-slate-500">
                      {classLabel(p.className, p.section)}
                      {p.admissionNumber ? ` · ${p.admissionNumber}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[16rem]">{(p as any).feeMonth || p.feeType}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {methodLabel(p.paymentMethod)}
                    {p.transactionReference && p.transactionReference !== 'CASH-COUNTER' && (
                      <span className="block text-xs text-slate-500 font-mono">{p.transactionReference}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">{inr(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-700">{p.collectedBy || ''}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onPrint(p)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                      aria-label={`Print receipt ${p.receiptNumber}`}
                      title="Print receipt"
                    >
                      <Printer className="w-4 h-4" aria-hidden />
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

const DuesList: React.FC<{
  ledgers: FeeLedgerEntry[];
  students: Student[];
  loaded: boolean;
  onOpenStudent: (id: string) => void;
  onCollect: (s: Student) => void;
}> = ({ ledgers, students, loaded, onOpenStudent, onCollect }) => {
  const [q, setQ] = useState('');
  const today = new Date().toISOString().substring(0, 10);
  const rows = useMemo(() => {
    const map = new Map<string, { student: Student; due: number; overdue: number; bills: number }>();
    ledgers.forEach((l) => {
      const due = ledgerDue(l);
      if (due <= 0 || l.status === 'WAIVED') return;
      // Fall back to the names stored on the bill, so a due never disappears because the student list is still loading.
      const st =
        students.find((s) => s.id === l.studentId) ||
        ({ id: l.studentId, name: l.studentName, admissionNumber: l.admissionNumber, className: l.className, section: l.section } as Student);
      if (!st.id) return;
      const row = map.get(st.id) || { student: st, due: 0, overdue: 0, bills: 0 };
      row.due += due;
      row.bills += 1;
      if (l.dueDate && String(l.dueDate).substring(0, 10) < today) row.overdue += due;
      map.set(st.id, row);
    });
    return Array.from(map.values()).sort((a, b) => b.due - a.due);
  }, [ledgers, students, today]);

  const term = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) => !term || [r.student.name, r.student.admissionNumber, r.student.fatherName, r.student.className].some((v) => String(v || '').toLowerCase().includes(term))
  );
  const total = rows.reduce((s, r) => s + r.due, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {rows.length} student{rows.length === 1 ? '' : 's'} with dues · <span className="font-semibold text-rose-700 tabular-nums">{inr(total)}</span> outstanding
        </p>
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Student, admission no. or class"
            aria-label="Search dues"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
          />
        </div>
      </div>
      {!loaded && rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-600 inline-flex w-full items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading bills…
        </p>
      ) : shown.length === 0 ? (
        <div className="px-5 py-12 text-center">
          {rows.length === 0 && <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" aria-hidden />}
          <p className="text-sm text-slate-600">{rows.length === 0 ? 'No dues. Every bill is paid.' : 'No student matches this search.'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {shown.map(({ student, due, overdue, bills }) => (
            <li key={student.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpenStudent(student.id)} className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left">
                  {student.name}
                </button>
                <p className="text-sm text-slate-600">
                  {classLabel(student.className, student.section)} · Adm. no. {student.admissionNumber}
                </p>
                <p className="text-xs text-slate-500">
                  {[student.fatherName || student.parentName, student.fatherMobile || student.parentPhone || student.mobile].filter(Boolean).join(' · ')}
                  {` · ${bills} unpaid bill${bills === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums text-slate-900">{inr(due)}</p>
                  {overdue > 0 && (
                    <p className="text-xs text-rose-700 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" aria-hidden />
                      {inr(overdue)} overdue
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onCollect(student)}
                  className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
                >
                  Collect
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
