import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../../services/api';
import { AcademicClass, User } from '../../types';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';
import { getSchoolLogoSrc } from '../../constants/schoolLogo';

/**
 * Institutional Analytics & Official Reports (school MIS).
 *
 * Every number on this page comes from /api/analytics/official-reports, which
 * aggregates saved records on the server with the filters applied there. Exports
 * (CSV for Excel, PDF, print) are built from that same response, so a download
 * always matches what is on screen. Salary and fee data appear only when the
 * server says this role may see them.
 */

interface ReportsViewProps {
  userRole?: string;
  currentUser?: User;
  onNavigateModule?: (module: string) => void;
}

type Tab = 'SUMMARY' | 'STUDENTS' | 'FEES' | 'ATTENDANCE' | 'STAFF' | 'EXAMS';
const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'SUMMARY', label: 'Executive Summary', icon: LayoutDashboard },
  { id: 'STUDENTS', label: 'Student Strength', icon: Users },
  { id: 'FEES', label: 'Fees & Dues', icon: IndianRupee },
  { id: 'ATTENDANCE', label: 'Attendance', icon: CalendarCheck },
  { id: 'STAFF', label: 'Faculty & Payroll', icon: ShieldCheck },
  { id: 'EXAMS', label: 'Exams & Results', icon: GraduationCap },
];

const NAVY = '#0B1F4B';
const ROYAL = '#123B8C';
const PALETTE = ['#123B8C', '#D9A441', '#12B76A', '#F04438', '#7A5AF8', '#2E90FA', '#F79009', '#667085'];

const inr = (n: unknown) => (n === null || n === undefined || n === '' || !Number.isFinite(Number(n)) ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`);
const num = (n: unknown) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-IN'));
const pctText = (n: unknown) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : `${Number(n)}%`);
const fmtDate = (iso?: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const monthText = (ym: string) => (/^\d{4}-\d{2}$/.test(ym) ? new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : ym);

function activeSections(c?: AcademicClass): string[] {
  if (!c) return [];
  const ds: any[] = (c as any).detailedSections || [];
  if (ds.length) return ds.filter((d) => String(d?.status || 'ACTIVE').toUpperCase() === 'ACTIVE').map((d) => String(d.name).toUpperCase());
  return (c.sections && c.sections.length ? c.sections : ['A']).map((s) => String(s).toUpperCase());
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

const Kpi: React.FC<{ label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'warn' | 'bad' }> = ({ label, value, hint, tone = 'default' }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 min-w-0">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</div>
    <div className={`mt-1 text-2xl font-extrabold tabular-nums ${tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div>
    {hint && <div className="text-xs text-slate-500 mt-0.5 truncate">{hint}</div>}
  </div>
);

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 min-w-0 ${className}`}>
    <h3 className="text-sm font-bold text-slate-900">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <div className="text-sm text-slate-500 py-8 text-center">{text}</div>;

/** Horizontal bars: label, bar, value. Accessible as a list. */
const Bars: React.FC<{ items: Array<{ label: string; value: number; display?: string }>; color?: string; max?: number; emptyText?: string }> = ({ items, color = ROYAL, max, emptyText = 'No data for these filters.' }) => {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length || items.every((i) => !i.value)) return <Empty text={emptyText} />;
  return (
    <ul className="space-y-2" aria-label="Bar chart">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(70px,140px)_1fr_auto] items-center gap-3 text-xs">
          <span className="text-slate-700 truncate" title={i.label}>{i.label}</span>
          <span className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (i.value / m) * 100)}%`, background: color }} />
          </span>
          <span className="font-semibold text-slate-900 tabular-nums">{i.display ?? num(i.value)}</span>
        </li>
      ))}
    </ul>
  );
};

/** Donut with a legend. */
const Donut: React.FC<{ parts: Array<{ label: string; value: number }>; centre?: string }> = ({ parts, centre }) => {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <Empty text="No data for these filters." />;
  let acc = 0;
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 100 100" className="w-32 h-32 shrink-0" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#EEF2F6" strokeWidth="14" />
        {parts.map((p, idx) => {
          const len = (p.value / total) * C;
          const el = (
            <circle key={p.label} cx="50" cy="50" r={R} fill="none" stroke={PALETTE[idx % PALETTE.length]} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />
          );
          acc += len;
          return el;
        })}
        {centre && (
          <text x="50" y="54" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 14, fontWeight: 800 }}>
            {centre}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5 text-xs min-w-0">
        {parts.map((p, idx) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[idx % PALETTE.length] }} />
            <span className="text-slate-700">{p.label}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{num(p.value)} ({Math.round((p.value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Monthly column chart. */
const Columns: React.FC<{ points: Array<{ label: string; value: number; display?: string }>; color?: string; suffix?: string }> = ({ points, color = ROYAL }) => {
  if (!points.length) return <Empty text="No records in this period." />;
  const m = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="flex items-end gap-2 h-40 overflow-x-auto pb-1" role="img" aria-label={points.map((p) => `${p.label}: ${p.display ?? p.value}`).join(', ')}>
      {points.map((p) => (
        <div key={p.label} className="flex flex-col items-center justify-end gap-1 min-w-[36px] flex-1 h-full">
          <span className="text-[10px] font-semibold text-slate-700 tabular-nums whitespace-nowrap">{p.display ?? num(p.value)}</span>
          <span className="w-full max-w-[34px] rounded-t-md" style={{ height: `${Math.max(3, (p.value / m) * 100)}%`, background: color }} />
          <span className="text-[10px] text-slate-500 whitespace-nowrap">{p.label}</span>
        </div>
      ))}
    </div>
  );
};

interface Col<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  text?: (row: T) => string | number;
  align?: 'right';
}

function Table<T>({ cols, rows, searchable, pageSize = 20, emptyText = 'No records for these filters.', rowKey }: { cols: Col<T>[]; rows: T[]; searchable?: (row: T) => string; pageSize?: number; emptyText?: string; rowKey: (row: T, i: number) => string }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => (searchable && q.trim() ? rows.filter((r) => searchable(r).toLowerCase().includes(q.trim().toLowerCase())) : rows), [rows, q, searchable]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = filtered.slice(page * pageSize, page * pageSize + pageSize);
  useEffect(() => setPage(0), [q, rows]);
  return (
    <div>
      {searchable && (
        <div className="flex items-center gap-2 mb-3 rounded-xl border border-slate-200 px-3 max-w-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search table" className="flex-1 py-2 text-sm focus:outline-none bg-transparent" />
        </div>
      )}
      {filtered.length === 0 ? (
        <Empty text={emptyText} />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                {cols.map((c) => (
                  <th key={c.key} className={`py-2 px-2 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.map((r, i) => (
                <tr key={rowKey(r, i)} className="hover:bg-slate-50">
                  {cols.map((c) => (
                    <td key={c.key} className={`py-2 px-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : c.text ? c.text(r) : String((r as any)[c.key] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3 text-xs text-slate-600">
          <span>
            {page * pageSize + 1}–{Math.min(filtered.length, page * pageSize + pageSize)} of {filtered.length}
          </span>
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="w-8 h-8 rounded-lg border border-slate-200 disabled:opacity-40 flex items-center justify-center" aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="w-8 h-8 rounded-lg border border-slate-200 disabled:opacity-40 flex items-center justify-center" aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export model: one description per tab, used by CSV, PDF and print alike
// ---------------------------------------------------------------------------

interface ExportTable {
  title: string;
  head: string[];
  body: Array<Array<string | number>>;
}
interface ExportModel {
  title: string;
  kpis: Array<[string, string]>;
  tables: ExportTable[];
}

function buildExport(tab: Tab, d: any): ExportModel {
  const ex = d?.executiveSummary || {};
  const label = TABS.find((t) => t.id === tab)!.label;
  if (tab === 'SUMMARY') {
    const kpis: Array<[string, string]> = [
      ['Active students', num(ex.students?.totalActive)],
      ['New admissions in period', num(ex.students?.newAdmissions)],
      ['Teaching / non-teaching staff', `${num(ex.staff?.teachingStaff)} / ${num(ex.staff?.nonTeachingStaff)}`],
      ['Attendance', pctText(ex.attendance?.overallAttendancePercentage)],
      ['Exam pass rate', pctText(ex.examination?.passPercentage)],
    ];
    if (ex.fees) kpis.splice(3, 0, ['Fee billed', inr(ex.fees.totalFeeBilled)], ['Fee collected', inr(ex.fees.totalFeeCollected)], ['Outstanding', inr(ex.fees.outstandingFees)], ['Collection', pctText(ex.fees.collectionPercentage)]);
    return { title: label, kpis, tables: [] };
  }
  if (tab === 'STUDENTS') {
    const s = d?.studentStrength || {};
    return {
      title: label,
      kpis: [
        ['Active students', num(s.grandTotals?.totalStudents)],
        ['Boys / Girls', `${num(s.grandTotals?.boys)} / ${num(s.grandTotals?.girls)}`],
        ['Hostel / Day scholars', `${num(s.grandTotals?.hostel)} / ${num(s.grandTotals?.dayScholars)}`],
        ['New admissions', num(s.grandTotals?.newAdmissions)],
        ['Withdrawn', num(s.grandTotals?.withdrawn)],
      ],
      tables: [
        {
          title: 'Class-wise strength',
          head: ['Class', 'Section', 'Students', 'Boys', 'Girls', 'Hostel', 'Day scholars', 'New', 'Withdrawn'],
          body: (s.classWise || []).map((r: any) => [r.className, r.section, r.totalStudents, r.boys, r.girls, r.hostel, r.dayScholars, r.newAdmissions, r.withdrawn]),
        },
      ],
    };
  }
  if (tab === 'FEES') {
    const f = d?.feeCollectionAndAudit;
    if (!f) return { title: label, kpis: [['Access', 'Fee figures are not available for your role']], tables: [] };
    return {
      title: label,
      kpis: [
        ['Billed', inr(f.summary?.totalFeeBilled)],
        ['Collected', inr(f.summary?.totalFeeCollected)],
        ['Outstanding', inr(f.summary?.outstandingFees)],
        ['Collection', pctText(f.summary?.collectionPercentage)],
        ['Received over bill amounts', inr(f.summary?.excessReceived || 0)],
        ['Receipts in period', `${num(f.summary?.totalReceipts)} (${inr(f.summary?.collectedInPeriod)})`],
      ],
      tables: [
        { title: 'Class-wise collection', head: ['Class', 'Students', 'Billed', 'Collected', 'Outstanding', 'Collection %'], body: (f.classWise || []).map((r: any) => [r.className, r.studentsCount, inr(r.amountBilled), inr(r.amountCollected), inr(r.outstanding), pctText(r.collectionPercentage)]) },
        { title: 'Outstanding dues', head: ['Student', 'Adm. no.', 'Class', 'Parent', 'Phone', 'Billed', 'Paid', 'Pending', 'Oldest due', 'Days'], body: (f.outstandingDues || []).map((r: any) => [r.studentName, r.admissionNumber, `${r.className || ''}${r.section ? `-${r.section}` : ''}`, r.parentName || '', r.parentPhone || '', inr(r.totalDue), inr(r.amountPaid), inr(r.pendingAmount), fmtDate(r.oldestDueDate), r.daysOutstanding]) },
      ],
    };
  }
  if (tab === 'ATTENDANCE') {
    const a = d?.attendanceAndDefaulters || {};
    return {
      title: label,
      kpis: [
        ['Overall attendance', pctText(a.summary?.overallAttendancePercentage)],
        ['Marked entries', num(a.summary?.totalMarked)],
        ['Below 75%', num(a.summary?.studentsLt75)],
        ['Below 60%', num(a.summary?.studentsLt60)],
        ['Perfect attendance', num(a.summary?.studentsPerfectAttendance)],
      ],
      tables: [
        { title: 'Class-wise attendance', head: ['Class', 'Section', 'Students', 'Days marked', 'Present', 'Absent', 'Leave', 'Average %', '< 75%'], body: (a.classWise || []).map((r: any) => [r.className, r.section, r.totalStudents, r.workingDays, r.present, r.absent, r.leave, pctText(r.averageAttendancePct), r.below75Count]) },
        { title: 'Students below 75%', head: ['Student', 'Adm. no.', 'Class', 'Days', 'Present', 'Absent', 'Attendance', 'Band'], body: (a.defaulters || []).filter((r: any) => r.attendancePercentage !== null && r.attendancePercentage < 75).map((r: any) => [r.studentName, r.admissionNumber, `${r.className || ''}${r.section ? `-${r.section}` : ''}`, r.workingDays, r.present, r.absent, pctText(r.attendancePercentage), r.status]) },
      ],
    };
  }
  if (tab === 'STAFF') {
    const st = d?.facultyAndPayroll || {};
    const pay = !!st.summary?.canViewPayroll;
    return {
      title: label,
      kpis: [
        ['Active staff', num(st.summary?.totalActiveFaculty)],
        ['Teaching', num(st.summary?.teachingStaff)],
        ['Non-teaching', num(st.summary?.nonTeachingStaff)],
        ...(pay ? ([['Net payroll in period', inr(st.summary?.netPayroll)], ['Deductions in period', inr(st.summary?.totalDeductions)]] as Array<[string, string]>) : []),
      ],
      tables: [
        {
          title: 'Staff',
          head: pay ? ['Emp. ID', 'Name', 'Designation', 'Status', 'Payroll month', 'Gross', 'Deductions', 'Net', 'Payment'] : ['Emp. ID', 'Name', 'Designation', 'Status'],
          body: (st.staffWise || []).map((r: any) => (pay ? [r.employeeId, r.employeeName, r.designation || '', r.employmentStatus, r.payrollMonth || '—', inr(r.grossSalary), inr(r.deductions), inr(r.netSalary), r.paymentStatus === 'NOT_GENERATED' ? 'Not generated' : r.paymentStatus] : [r.employeeId, r.employeeName, r.designation || '', r.employmentStatus])),
        },
      ],
    };
  }
  const e = d?.examinationAnalysis || {};
  return {
    title: label,
    kpis: [
      ['Students appeared', num(e.summary?.appeared)],
      ['Pass rate', pctText(e.summary?.passPercentage)],
      ['Average score', pctText(e.summary?.averagePercentage)],
      ['Highest score', pctText(e.summary?.highestPercentage)],
    ],
    tables: [
      { title: 'Class-wise results', head: ['Class', 'Appeared', 'Marks entries', 'Passed', 'Failed', 'Pass %', 'Average %', 'Highest %'], body: (e.classWise || []).map((r: any) => [r.className, r.studentsAppeared, r.marksRecorded, r.passed, r.failed, pctText(r.passPercentage), pctText(r.averagePercentage), pctText(r.highestPercentage)]) },
      { title: 'Subject-wise results', head: ['Subject', 'Entries', 'Passed', 'Failed', 'Pass %', 'Average marks', 'Highest marks'], body: (e.subjectWise || []).map((r: any) => [r.subjectName, r.studentsAppeared, r.passed, r.failed, pctText(r.passPercentage), r.averageMarks, r.highestMarks]) },
    ],
  };
}

function filterLines(meta: any, classes: AcademicClass[]): string[] {
  const f = meta?.appliedFilters || {};
  const cls = classes.find((c) => c.id === f.classId)?.name;
  return [
    `Session: ${meta?.academicSession || ''}`,
    `Period: ${fmtDate(meta?.period?.from)} – ${fmtDate(meta?.period?.to)}`,
    `Class: ${cls || 'All classes'}${f.section && f.section !== 'All Sections' ? ` · Section ${f.section}` : ''}`,
  ];
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function logoDataUrl(key: string): Promise<string | null> {
  const src = getSchoolLogoSrc(key);
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser }) => {
  const user = currentUser || api.getCurrentUser();
  const settings = api.getSettings();
  const sid = schoolIdentity(settings);
  const sessions = useMemo(() => api.getAcademicSessions(), []);
  const defaultSession = api.getActiveAcademicSession()?.name || settings.currentAcademicSession || '';

  const [session, setSession] = useState(defaultSession);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('');
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [tab, setTab] = useState<Tab>('SUMMARY');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<string | null>(null);
  const seq = useRef(0);

  const classes = useMemo(() => api.getActiveClasses(session).filter((c) => String(c.status || 'ACTIVE') === 'ACTIVE'), [session]);
  const sectionsOfClass = useMemo(() => activeSections(classes.find((c) => c.id === classId)), [classes, classId]);
  const exams = useMemo(() => api.getExams().filter((e: any) => !session || !e.academicSession || String(e.academicSession).slice(0, 4) === session.slice(0, 4)), [session]);
  const subjects = useMemo(() => api.getActiveSubjects(classId || undefined, session), [classId, session]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetchInstitutionalAnalytics({
        academicSession: session || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        classId: classId || undefined,
        section: section || undefined,
        examId: examId || undefined,
        subjectId: subjectId || undefined,
      });
      if (mine !== seq.current) return;
      if (res && res.success) setData(res);
      else setError(res?.error || 'The report could not be loaded.');
    } catch (e: any) {
      if (mine !== seq.current) return;
      setError(e?.message || 'The report could not be loaded. Check your connection.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [session, dateFrom, dateTo, classId, section, examId, subjectId]);

  // Every filter change reloads from the server (short delay so typing a date does not fire many requests).
  useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('The start date is after the end date.');
      return;
    }
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, dateFrom, dateTo]);

  const reset = () => {
    setSession(defaultSession);
    setDateFrom('');
    setDateTo('');
    setClassId('');
    setSection('');
    setExamId('');
    setSubjectId('');
  };

  const meta = data?.meta;
  const ex = data?.executiveSummary;
  const fileBase = `Report_${TABS.find((t) => t.id === tab)!.label.replace(/\W+/g, '_')}_${meta?.period?.from || ''}_${meta?.period?.to || ''}`;

  const exportCsv = () => {
    if (!data) return;
    const m = buildExport(tab, data);
    const lines: string[] = [
      csvCell(sid.name || NOT_CONFIGURED),
      csvCell([sid.address, letterheadLine(sid)].filter(Boolean).join(' | ')),
      csvCell(`${m.title}`),
      ...filterLines(meta, classes).map(csvCell),
      csvCell(`Generated ${new Date().toLocaleString('en-IN')} by ${user?.name || ''}`),
      '',
      ...m.kpis.map(([k, v]) => [csvCell(k), csvCell(v)].join(',')),
    ];
    for (const t of m.tables) {
      lines.push('', csvCell(t.title), t.head.map(csvCell).join(','), ...t.body.map((r) => r.map(csvCell).join(',')));
    }
    // BOM so Excel opens the ₹ sign and Hindi names correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const exportPdf = async () => {
    if (!data) return;
    setBusyExport('pdf');
    try {
      const m = buildExport(tab, data);
      const doc = new jsPDF({ orientation: m.tables.some((t) => t.head.length > 7) ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const logo = await logoDataUrl(meta?.logoFileKey || sid.logoKey);
      let x = 14;
      if (logo) {
        try {
          doc.addImage(logo, 14, 10, 18, 18);
          x = 36;
        } catch {}
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(11, 31, 75);
      doc.text((sid.name || NOT_CONFIGURED).toUpperCase(), x, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 84, 103);
      doc.text([sid.address, letterheadLine(sid, { phone: true })].filter(Boolean).join('  •  ') || 'School details not configured', x, 21, { maxWidth: W - x - 14 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(m.title, 14, 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 84, 103);
      doc.text(`${filterLines(meta, classes).join('   |   ')}   |   Generated ${new Date().toLocaleString('en-IN')} by ${user?.name || ''}`, 14, 39, { maxWidth: W - 28 });
      autoTable(doc, {
        startY: 44,
        head: [['Measure', 'Value']],
        body: m.kpis.map(([k, v]) => [k, v.replace('₹', 'Rs. ')]),
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 1.8 },
        headStyles: { fillColor: [11, 31, 75] },
        tableWidth: Math.min(120, W - 28),
      });
      for (const t of m.tables) {
        const y = ((doc as any).lastAutoTable?.finalY || 44) + 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`${t.title}${t.body.length ? '' : ' — no records'}`, 14, y);
        if (!t.body.length) {
          (doc as any).lastAutoTable = { finalY: y + 2 };
          continue;
        }
        autoTable(doc, {
          startY: y + 2,
          head: [t.head],
          body: t.body.map((r) => r.map((c) => String(c).replace('₹', 'Rs. '))),
          theme: 'striped',
          styles: { fontSize: 7.5, cellPadding: 1.4 },
          headStyles: { fillColor: [18, 59, 140] },
        });
      }
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(120, 130, 145);
        doc.text(`${sid.name || ''} · ${m.title} · Page ${i} of ${pages}`, 14, doc.internal.pageSize.getHeight() - 7);
      }
      doc.save(`${fileBase}.pdf`);
    } catch {
      setError('The PDF could not be created. Please try again.');
    } finally {
      setBusyExport(null);
    }
  };

  const print = () => {
    if (!data) return;
    const m = buildExport(tab, data);
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.title)}</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#101828;margin:24px}h1{font-size:18px;margin:0;color:#0B1F4B}h2{font-size:14px;margin:18px 0 6px}
.sub{font-size:11px;color:#475467}table{border-collapse:collapse;width:100%;font-size:11px;margin-top:4px}th,td{border:1px solid #D0D5DD;padding:4px 6px;text-align:left}th{background:#F2F4F7}
.kpis td:first-child{width:45%}</style></head><body>
<h1>${esc(sid.name || NOT_CONFIGURED)}</h1><div class="sub">${esc([sid.address, letterheadLine(sid, { phone: true })].filter(Boolean).join(' • '))}</div>
<h2>${esc(m.title)}</h2><div class="sub">${esc(filterLines(meta, classes).join(' | '))} | Generated ${esc(new Date().toLocaleString('en-IN'))} by ${esc(user?.name || '')}</div>
<table class="kpis">${m.kpis.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>
${m.tables.map((t) => `<h2>${esc(t.title)}</h2>${t.body.length ? `<table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="sub">No records.</div>'}`).join('')}
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      setError('Allow pop-ups for this site to print the report.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  // ---------------------------------------------------------------------------

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Active students" value={num(ex?.students?.totalActive)} hint={`${num(ex?.students?.newAdmissions)} new in period`} />
        <Kpi label="Staff" value={num(ex?.staff?.totalActiveStaff)} hint={`${num(ex?.staff?.teachingStaff)} teaching · ${num(ex?.staff?.nonTeachingStaff)} non-teaching`} />
        <Kpi label="Attendance" value={pctText(ex?.attendance?.overallAttendancePercentage)} hint={`${num(ex?.attendance?.studentsBelow75)} students below 75%`} tone={ex?.attendance?.totalMarked ? (ex.attendance.overallAttendancePercentage >= 75 ? 'good' : 'warn') : 'default'} />
        <Kpi label="Exam pass rate" value={pctText(ex?.examination?.passPercentage)} hint={`${num(ex?.examination?.appeared)} students appeared`} />
      </div>
      {ex?.fees ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Fee billed" value={inr(ex.fees.totalFeeBilled)} />
          <Kpi label="Fee collected" value={inr(ex.fees.totalFeeCollected)} tone="good" hint={ex.fees.excessReceived > 0 ? `incl. ${inr(ex.fees.excessReceived)} over bill amounts` : undefined} />
          <Kpi label="Outstanding" value={inr(ex.fees.outstandingFees)} tone={ex.fees.outstandingFees > 0 ? 'bad' : 'default'} />
          <Kpi label="Collection" value={pctText(ex.fees.collectionPercentage)} hint={`${num(ex.fees.totalReceipts)} receipts in period`} />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Fee figures are not shown for your role.</div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Attendance by month" subtitle="Share of marked entries that were Present">
          <Columns points={(data?.trends?.monthlyAttendance || []).map((t: any) => ({ label: monthText(t.month), value: t.percentage, display: `${t.percentage}%` }))} color="#12B76A" />
        </Panel>
        {ex?.fees ? (
          <Panel title="Fee receipts by month" subtitle="Amount received in the period">
            <Columns points={(data?.trends?.monthlyFee || []).map((t: any) => ({ label: monthText(t.month), value: t.collected, display: inr(t.collected) }))} color="#D9A441" />
          </Panel>
        ) : (
          <Panel title="Admissions by month">
            <Columns points={(data?.trends?.monthlyAdmission || []).map((t: any) => ({ label: monthText(t.month), value: t.count }))} />
          </Panel>
        )}
      </div>
    </div>
  );

  const renderStudents = () => {
    const s = data?.studentStrength || {};
    const byClass = new Map<string, number>();
    (s.classWise || []).forEach((r: any) => byClass.set(r.className, (byClass.get(r.className) || 0) + r.totalStudents));
    const ag = s.demographics?.ageGroups || {};
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Active students" value={num(s.grandTotals?.totalStudents)} />
          <Kpi label="Boys" value={num(s.grandTotals?.boys)} />
          <Kpi label="Girls" value={num(s.grandTotals?.girls)} />
          <Kpi label="Hostel" value={num(s.grandTotals?.hostel)} hint={`${num(s.grandTotals?.dayScholars)} day scholars`} />
          <Kpi label="New / withdrawn" value={`${num(s.grandTotals?.newAdmissions)} / ${num(s.grandTotals?.withdrawn)}`} />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Panel title="Students by class" className="lg:col-span-2">
            <Bars items={Array.from(byClass.entries()).map(([label, value]) => ({ label, value }))} />
          </Panel>
          <Panel title="Gender">
            <Donut parts={[{ label: 'Boys', value: s.demographics?.gender?.boys || 0 }, { label: 'Girls', value: s.demographics?.gender?.girls || 0 }, { label: 'Other / not recorded', value: s.demographics?.gender?.other || 0 }].filter((p) => p.value)} centre={num(s.grandTotals?.totalStudents)} />
          </Panel>
        </div>
        <Panel title="Age groups" subtitle="Age today, from the recorded date of birth">
          <Bars items={[
            { label: 'Under 5', value: ag.under5 || 0 },
            { label: '5–8', value: ag.age5to8 || 0 },
            { label: '9–12', value: ag.age9to12 || 0 },
            { label: '13–16', value: ag.age13to16 || 0 },
            { label: '17+', value: ag.age17plus || 0 },
            { label: 'DOB not recorded', value: ag.notSpecified || 0 },
          ]} />
        </Panel>
        {s.studentsWithoutActiveClass > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {s.studentsWithoutActiveClass} active student{s.studentsWithoutActiveClass > 1 ? 's are' : ' is'} in a class or section that is not set up. They are counted under “Class not set up” — update their class in Students.
          </div>
        )}
        <Panel title="Class-wise strength">
          <Table
            rowKey={(r: any) => `${r.classId || 'none'}-${r.section}`}
            rows={s.classWise || []}
            cols={[
              { key: 'className', label: 'Class' },
              { key: 'section', label: 'Section' },
              { key: 'totalStudents', label: 'Students', align: 'right' },
              { key: 'boys', label: 'Boys', align: 'right' },
              { key: 'girls', label: 'Girls', align: 'right' },
              { key: 'hostel', label: 'Hostel', align: 'right' },
              { key: 'dayScholars', label: 'Day', align: 'right' },
              { key: 'newAdmissions', label: 'New', align: 'right' },
              { key: 'withdrawn', label: 'Withdrawn', align: 'right' },
            ]}
          />
        </Panel>
      </div>
    );
  };

  const renderFees = () => {
    const f = data?.feeCollectionAndAudit;
    if (!f) return <Panel title="Fees & Dues"><Empty text="Fee figures are not available for your role." /></Panel>;
    const modes = f.summary?.paymentModes || {};
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Billed" value={inr(f.summary?.totalFeeBilled)} />
          <Kpi label="Collected" value={inr(f.summary?.totalFeeCollected)} tone="good" hint={f.summary?.excessReceived > 0 ? `incl. ${inr(f.summary.excessReceived)} over bill amounts` : undefined} />
          <Kpi label="Outstanding" value={inr(f.summary?.outstandingFees)} tone={f.summary?.outstandingFees > 0 ? 'bad' : 'default'} />
          <Kpi label="Collection" value={pctText(f.summary?.collectionPercentage)} />
          <Kpi label="Received in period" value={inr(f.summary?.collectedInPeriod)} hint={`${num(f.summary?.totalReceipts)} receipts`} />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Panel title="Collection by class" subtitle="Collected vs billed for the session" className="lg:col-span-2">
            <Bars items={(f.classWise || []).filter((r: any) => r.amountBilled > 0).map((r: any) => ({ label: r.className, value: r.collectionPercentage, display: `${r.collectionPercentage}% · ${inr(r.outstanding)} due` }))} max={100} color="#12B76A" emptyText="No bills for these filters." />
          </Panel>
          <Panel title="Payment modes (period)">
            <Donut parts={Object.entries(modes).map(([k, v]: any) => ({ label: k.replace('_', ' '), value: Math.round(v.total) })).filter((p) => p.value)} />
          </Panel>
        </div>
        <Panel title="Outstanding dues" subtitle={f.outstandingDuesTotal > (f.outstandingDues || []).length ? `Showing ${f.outstandingDues.length} of ${f.outstandingDuesTotal}, highest first` : 'Highest pending first'}>
          <Table
            rowKey={(r: any) => r.studentId}
            rows={f.outstandingDues || []}
            searchable={(r: any) => `${r.studentName} ${r.admissionNumber} ${r.className} ${r.parentName}`}
            cols={[
              { key: 'studentName', label: 'Student', render: (r: any) => <span className="font-semibold text-slate-900">{r.studentName}</span> },
              { key: 'admissionNumber', label: 'Adm. no.' },
              { key: 'class', label: 'Class', text: (r: any) => `${r.className || ''}${r.section ? `-${r.section}` : ''}` },
              { key: 'parent', label: 'Parent', text: (r: any) => [r.parentName, r.parentPhone].filter(Boolean).join(' · ') },
              { key: 'pendingAmount', label: 'Pending', align: 'right', render: (r: any) => <span className="font-semibold text-rose-700">{inr(r.pendingAmount)}</span> },
              { key: 'oldest', label: 'Oldest due', text: (r: any) => fmtDate(r.oldestDueDate) },
              { key: 'daysOutstanding', label: 'Days', align: 'right' },
            ]}
          />
        </Panel>
        <Panel title="Receipts in period" subtitle="Latest 100 receipts">
          <Table
            rowKey={(r: any) => r.id}
            rows={f.detailedPayments || []}
            searchable={(r: any) => `${r.receiptNumber} ${r.studentName} ${r.admissionNumber}`}
            cols={[
              { key: 'paymentDate', label: 'Date', text: (r: any) => fmtDate(r.paymentDate) },
              { key: 'receiptNumber', label: 'Receipt' },
              { key: 'studentName', label: 'Student' },
              { key: 'className', label: 'Class' },
              { key: 'paymentMode', label: 'Mode' },
              { key: 'amountPaid', label: 'Amount', align: 'right', text: (r: any) => inr(r.amountPaid) },
            ]}
          />
        </Panel>
        {f.audit && !f.audit.clean && (
          <Panel title="Receipt checks" subtitle="Items for the accounts office to review">
            <ul className="space-y-1.5 text-sm">
              {f.audit.issues.map((i: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {i.description}</li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  };

  const renderAttendance = () => {
    const a = data?.attendanceAndDefaulters || {};
    const below = (a.defaulters || []).filter((r: any) => r.attendancePercentage !== null && r.attendancePercentage < 75);
    const noRec = (a.defaulters || []).filter((r: any) => r.attendancePercentage === null).length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Overall attendance" value={pctText(a.summary?.overallAttendancePercentage)} tone={a.summary?.totalMarked ? (a.summary.overallAttendancePercentage >= 75 ? 'good' : 'warn') : 'default'} />
          <Kpi label="Present / absent" value={`${num(a.summary?.present)} / ${num(a.summary?.absent)}`} hint={`${num(a.summary?.totalMarked)} entries marked`} />
          <Kpi label="Below 75%" value={num(a.summary?.studentsLt75)} tone={a.summary?.studentsLt75 ? 'warn' : 'default'} />
          <Kpi label="Below 50%" value={num(a.summary?.studentsLt50)} tone={a.summary?.studentsLt50 ? 'bad' : 'default'} />
          <Kpi label="No records" value={num(noRec)} hint="Students with nothing marked" />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Average attendance by class & section">
            <Bars items={(a.classWise || []).filter((r: any) => r.workingDays > 0).map((r: any) => ({ label: `${r.className}-${r.section}`, value: r.averageAttendancePct, display: `${r.averageAttendancePct}%` }))} max={100} color="#12B76A" emptyText="No attendance marked in this period." />
          </Panel>
          <Panel title="By month">
            <Columns points={(data?.trends?.monthlyAttendance || []).map((t: any) => ({ label: monthText(t.month), value: t.percentage, display: `${t.percentage}%` }))} color="#12B76A" />
          </Panel>
        </div>
        <Panel title="Students below 75%" subtitle="Lowest first. Students with no attendance marked are not listed.">
          <Table
            rowKey={(r: any) => r.studentId}
            rows={below}
            searchable={(r: any) => `${r.studentName} ${r.admissionNumber} ${r.className}`}
            emptyText="No student is below 75% for these filters."
            cols={[
              { key: 'studentName', label: 'Student', render: (r: any) => <span className="font-semibold text-slate-900">{r.studentName}</span> },
              { key: 'admissionNumber', label: 'Adm. no.' },
              { key: 'class', label: 'Class', text: (r: any) => `${r.className || ''}${r.section ? `-${r.section}` : ''}` },
              { key: 'workingDays', label: 'Days', align: 'right' },
              { key: 'present', label: 'Present', align: 'right' },
              { key: 'absent', label: 'Absent', align: 'right' },
              { key: 'pct', label: 'Attendance', align: 'right', render: (r: any) => <span className={r.attendancePercentage < 50 ? 'font-bold text-rose-700' : 'font-semibold text-amber-700'}>{pctText(r.attendancePercentage)}</span> },
            ]}
          />
        </Panel>
      </div>
    );
  };

  const renderStaff = () => {
    const st = data?.facultyAndPayroll || {};
    const pay = !!st.summary?.canViewPayroll;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Active staff" value={num(st.summary?.totalActiveFaculty)} />
          <Kpi label="Teaching" value={num(st.summary?.teachingStaff)} />
          <Kpi label="Non-teaching" value={num(st.summary?.nonTeachingStaff)} />
          {pay && <Kpi label="Net payroll (period)" value={inr(st.summary?.netPayroll)} />}
          {pay && <Kpi label="Deductions (period)" value={inr(st.summary?.totalDeductions)} />}
        </div>
        {pay && (
          <Panel title="Payroll by month" subtitle="Net salary of generated payroll records">
            <Columns points={(data?.trends?.monthlyPayroll || []).map((t: any) => ({ label: monthText(String(t.month).slice(0, 7)), value: t.net, display: inr(t.net) }))} color={NAVY} />
          </Panel>
        )}
        <Panel title="Staff" subtitle={pay ? 'Salary shows the latest payroll record in the period; empty when none was generated.' : 'Salary details are visible to payroll roles only.'}>
          <Table
            rowKey={(r: any, i) => `${r.employeeId}-${i}`}
            rows={st.staffWise || []}
            searchable={(r: any) => `${r.employeeId} ${r.employeeName} ${r.designation}`}
            cols={[
              { key: 'employeeId', label: 'Emp. ID' },
              { key: 'employeeName', label: 'Name', render: (r: any) => <span className="font-semibold text-slate-900">{r.employeeName}</span> },
              { key: 'designation', label: 'Designation' },
              { key: 'employmentStatus', label: 'Status' },
              ...(pay
                ? ([
                    { key: 'payrollMonth', label: 'Month', text: (r: any) => r.payrollMonth || '—' },
                    { key: 'netSalary', label: 'Net', align: 'right', text: (r: any) => inr(r.netSalary) },
                    { key: 'paymentStatus', label: 'Payment', text: (r: any) => (r.paymentStatus === 'NOT_GENERATED' ? 'Not generated' : r.paymentStatus) },
                  ] as Col<any>[])
                : []),
            ]}
          />
        </Panel>
      </div>
    );
  };

  const renderExams = () => {
    const e = data?.examinationAnalysis || {};
    const gd = e.gradeDistribution || {};
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-semibold text-slate-600">
            Exam
            <select value={examId} onChange={(ev) => setExamId(ev.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white min-w-[200px]">
              <option value="">All exams</option>
              {exams.map((x: any) => (
                <option key={x.id} value={x.id}>{x.name || x.title}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Subject
            <select value={subjectId} onChange={(ev) => setSubjectId(ev.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white min-w-[180px]">
              <option value="">All subjects</option>
              {subjects.map((x: any) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Students appeared" value={num(e.summary?.appeared)} />
          <Kpi label="Pass rate" value={pctText(e.summary?.passPercentage)} tone={e.summary?.appeared ? (e.summary.passPercentage >= 80 ? 'good' : 'warn') : 'default'} />
          <Kpi label="Average score" value={pctText(e.summary?.averagePercentage)} />
          <Kpi label="Highest score" value={pctText(e.summary?.highestPercentage)} hint={e.summary?.appeared ? e.summary?.highestScorer : undefined} />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Panel title="Pass rate by class" className="lg:col-span-2">
            <Bars items={(e.classWise || []).map((r: any) => ({ label: r.className, value: r.passPercentage, display: `${r.passPercentage}% · avg ${r.averagePercentage}%` }))} max={100} emptyText="No marks entered for these filters." />
          </Panel>
          <Panel title="Grades">
            <Donut parts={Object.entries(gd).map(([k, v]: any) => ({ label: k, value: v })).filter((p) => p.value)} />
          </Panel>
        </div>
        <Panel title="Subject-wise results">
          <Table
            rowKey={(r: any, i) => `${r.subjectId || r.subjectName}-${i}`}
            rows={e.subjectWise || []}
            cols={[
              { key: 'subjectName', label: 'Subject' },
              { key: 'studentsAppeared', label: 'Entries', align: 'right' },
              { key: 'passed', label: 'Passed', align: 'right' },
              { key: 'failed', label: 'Failed', align: 'right' },
              { key: 'passPercentage', label: 'Pass %', align: 'right', text: (r: any) => pctText(r.passPercentage) },
              { key: 'averageMarks', label: 'Avg marks', align: 'right' },
            ]}
          />
        </Panel>
        {(e.academicSupportNeeded || []).length > 0 && (
          <Panel title="Students needing support" subtitle="Overall score below 40%">
            <Table
              rowKey={(r: any, i) => `${r.admissionNo}-${i}`}
              rows={e.academicSupportNeeded}
              cols={[
                { key: 'name', label: 'Student' },
                { key: 'admissionNo', label: 'Adm. no.' },
                { key: 'section', label: 'Section' },
                { key: 'percentage', label: 'Score', align: 'right', text: (r: any) => pctText(r.percentage) },
              ]}
            />
          </Panel>
        )}
      </div>
    );
  };

  const body = () => {
    switch (tab) {
      case 'STUDENTS':
        return renderStudents();
      case 'FEES':
        return renderFees();
      case 'ATTENDANCE':
        return renderAttendance();
      case 'STAFF':
        return renderStaff();
      case 'EXAMS':
        return renderExams();
      default:
        return renderSummary();
    }
  };

  const filtersActive = !!(dateFrom || dateTo || classId || section || examId || subjectId || session !== defaultSession);

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-800" /> Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {[sid.name || NOT_CONFIGURED, affiliationText(sid)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={exportCsv} disabled={!data || loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Excel (CSV)
          </button>
          <button type="button" onClick={exportPdf} disabled={!data || loading || !!busyExport} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {busyExport === 'pdf' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-rose-700" />} PDF
          </button>
          <button type="button" onClick={print} disabled={!data || loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B1F4B] text-white text-sm font-semibold hover:bg-[#123B8C] disabled:opacity-60">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
          <label className="text-xs font-semibold text-slate-600">
            Session
            <select value={session} onChange={(e) => { setSession(e.target.value); setClassId(''); setSection(''); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
              {sessions.map((s) => (
                <option key={s.id || s.name} value={s.name}>{s.name}{String(s.status).toUpperCase() === 'ACTIVE' ? ' (current)' : ''}</option>
              ))}
              {!sessions.some((s) => s.name === session) && session && <option value={session}>{session}</option>}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            To
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Class
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSection(''); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Section
            <select value={section} onChange={(e) => setSection(e.target.value)} disabled={!classId} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">{classId ? 'All sections' : 'Choose a class'}</option>
              {sectionsOfClass.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={reset} disabled={!filtersActive} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Reset filters
          </button>
        </div>
        {meta && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {filterLines(meta, classes).map((l) => (
              <span key={l} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">{l}</span>
            ))}
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-medium">Updated {new Date(meta.generatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border ${on ? 'bg-[#0B1F4B] text-white border-[#0B1F4B]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between gap-3" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 font-semibold">Try again</button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>{body()}</div>
      ) : null}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" /> Downloads use the same figures and filters shown above.
      </p>
    </div>
  );
};
