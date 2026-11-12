/**
 * Mobile reports: period presets, class/section options and the shareable text of a report.
 * Every figure comes from /api/analytics/official-reports (the same endpoint and access rules
 * as the website). Pure module (no React Native imports) so it can be tested offline.
 */
import { NOT_CONFIGURED, SchoolIdentity, affiliationLine } from './schoolIdentityModel';

export type ReportTab = 'SUMMARY' | 'STUDENTS' | 'FEES' | 'ATTENDANCE' | 'STAFF' | 'EXAMS';
export const REPORT_TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'SUMMARY', label: 'Summary' },
  { id: 'STUDENTS', label: 'Students' },
  { id: 'FEES', label: 'Fees' },
  { id: 'ATTENDANCE', label: 'Attendance' },
  { id: 'STAFF', label: 'Staff' },
  { id: 'EXAMS', label: 'Exams' },
];

/** Roles the server lets open reports (keep in step with server.ts REPORT_ROLES). */
export const REPORT_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'HR_STAFF'];

export type PeriodPreset = 'SESSION' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30';
export const PERIOD_PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'SESSION', label: 'Whole session' },
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'LAST_MONTH', label: 'Last month' },
  { id: 'LAST_30', label: 'Last 30 days' },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Date range for a preset; SESSION leaves both empty so the server uses the session dates. */
export function presetRange(p: PeriodPreset, today: string): { dateFrom?: string; dateTo?: string } {
  const t = new Date(`${today}T00:00:00Z`);
  if (p === 'THIS_MONTH') return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
  if (p === 'LAST_MONTH') {
    const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
    return { dateFrom: iso(first), dateTo: iso(last) };
  }
  if (p === 'LAST_30') {
    const from = new Date(t.getTime() - 29 * 86400000);
    return { dateFrom: iso(from), dateTo: today };
  }
  return {};
}

/** Active classes with their active sections. */
export function classOptions(classes: any[]): Array<{ id: string; name: string; sections: string[] }> {
  return (classes || [])
    .filter((c) => String(c?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && c?.isActive !== false)
    .map((c) => {
      const ds: any[] = Array.isArray(c.detailedSections) ? c.detailedSections : [];
      const sections = ds.length
        ? ds.filter((d) => String(d?.status || 'ACTIVE').toUpperCase() === 'ACTIVE').map((d) => String(d.name).toUpperCase())
        : (Array.isArray(c.sections) && c.sections.length ? c.sections : ['A']).map((s: any) => String(typeof s === 'string' ? s : s?.name || '').toUpperCase()).filter(Boolean);
      return { id: String(c.id), name: String(c.name), sections, order: Number(c.numericOrder ?? c.order ?? 0) };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...rest }) => rest);
}

export const inr = (n: unknown) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`);
export const num = (n: unknown) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-IN'));
export const pctText = (n: unknown) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : `${Number(n)}%`);
export const dateText = (v?: string) =>
  v && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : v || '';

export const monthText = (ym: string) =>
  /^\d{4}-\d{2}$/.test(String(ym)) ? new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : String(ym || '');

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad';
}
export interface Row {
  title: string;
  detail: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad';
}
export interface TabView {
  kpis: Kpi[];
  sections: Array<{ title: string; note?: string; rows: Row[]; empty: string }>;
  notice?: string;
}

/** Figures shown for one tab. Withheld data (fees, salaries) stays withheld. */
export function tabView(tab: ReportTab, d: any): TabView {
  const ex = d?.executiveSummary || {};
  if (tab === 'SUMMARY') {
    const kpis: Kpi[] = [
      { label: 'Active students', value: num(ex.students?.totalActive), hint: `${num(ex.students?.newAdmissions)} new in period` },
      { label: 'Staff', value: num(ex.staff?.totalActiveStaff), hint: `${num(ex.staff?.teachingStaff)} teaching` },
      { label: 'Attendance', value: pctText(ex.attendance?.overallAttendancePercentage), hint: `${num(ex.attendance?.studentsBelow75)} below 75%`, tone: ex.attendance?.totalMarked ? (ex.attendance.overallAttendancePercentage >= 75 ? 'good' : 'warn') : undefined },
      { label: 'Exam pass rate', value: pctText(ex.examination?.passPercentage), hint: `${num(ex.examination?.appeared)} appeared` },
    ];
    if (ex.fees) {
      kpis.push(
        { label: 'Fee collected', value: inr(ex.fees.totalFeeCollected), hint: `of ${inr(ex.fees.totalFeeBilled)} billed`, tone: 'good' },
        { label: 'Outstanding', value: inr(ex.fees.outstandingFees), hint: `${pctText(ex.fees.collectionPercentage)} collected`, tone: ex.fees.outstandingFees > 0 ? 'bad' : undefined }
      );
    }
    return {
      kpis,
      sections: [
        {
          title: 'Attendance by month',
          rows: (d?.trends?.monthlyAttendance || []).map((t: any) => ({ title: monthText(t.month), detail: `${num(t.present)} present of ${num(t.total)}`, value: pctText(t.percentage) })),
          empty: 'No attendance marked in this period.',
        },
      ],
      notice: ex.fees ? undefined : 'Fee figures are not shown for your role.',
    };
  }
  if (tab === 'STUDENTS') {
    const s = d?.studentStrength || {};
    return {
      kpis: [
        { label: 'Active students', value: num(s.grandTotals?.totalStudents) },
        { label: 'Boys / Girls', value: `${num(s.grandTotals?.boys)} / ${num(s.grandTotals?.girls)}` },
        { label: 'Hostel', value: num(s.grandTotals?.hostel), hint: `${num(s.grandTotals?.dayScholars)} day scholars` },
        { label: 'New / Withdrawn', value: `${num(s.grandTotals?.newAdmissions)} / ${num(s.grandTotals?.withdrawn)}` },
      ],
      sections: [
        {
          title: 'Class-wise strength',
          rows: (s.classWise || []).filter((r: any) => r.totalStudents > 0 || r.withdrawn > 0).map((r: any) => ({ title: `${r.className}${r.section && r.section !== '—' ? `-${r.section}` : ''}`, detail: `${num(r.boys)} boys · ${num(r.girls)} girls · ${num(r.hostel)} hostel`, value: num(r.totalStudents), tone: r.needsAttention ? 'warn' : undefined })),
          empty: 'No students for these filters.',
        },
      ],
      notice: s.studentsWithoutActiveClass > 0 ? `${s.studentsWithoutActiveClass} active student(s) are in a class or section that is not set up.` : undefined,
    };
  }
  if (tab === 'FEES') {
    const f = d?.feeCollectionAndAudit;
    if (!f) return { kpis: [], sections: [], notice: 'Fee figures are not available for your role.' };
    return {
      kpis: [
        { label: 'Billed', value: inr(f.summary?.totalFeeBilled) },
        { label: 'Collected', value: inr(f.summary?.totalFeeCollected), tone: 'good', hint: f.summary?.excessReceived > 0 ? `incl. ${inr(f.summary.excessReceived)} over bills` : undefined },
        { label: 'Outstanding', value: inr(f.summary?.outstandingFees), tone: f.summary?.outstandingFees > 0 ? 'bad' : undefined },
        { label: 'Received in period', value: inr(f.summary?.collectedInPeriod), hint: `${num(f.summary?.totalReceipts)} receipts` },
      ],
      sections: [
        {
          title: 'Collection by class',
          rows: (f.classWise || []).filter((r: any) => r.amountBilled > 0).map((r: any) => ({ title: r.className, detail: `${inr(r.amountCollected)} of ${inr(r.amountBilled)}`, value: pctText(r.collectionPercentage), tone: r.collectionPercentage >= 75 ? 'good' : r.collectionPercentage < 40 ? 'bad' : 'warn' })),
          empty: 'No bills for these filters.',
        },
        {
          title: 'Highest dues',
          note: f.outstandingDuesTotal > 20 ? `Top 20 of ${f.outstandingDuesTotal}` : undefined,
          rows: (f.outstandingDues || []).slice(0, 20).map((r: any) => ({ title: r.studentName, detail: `${r.className || ''}${r.section ? `-${r.section}` : ''} · ${r.daysOutstanding} days · ${[r.parentName, r.parentPhone].filter(Boolean).join(' ')}`, value: inr(r.pendingAmount), tone: 'bad' })),
          empty: 'No dues outstanding.',
        },
      ],
    };
  }
  if (tab === 'ATTENDANCE') {
    const a = d?.attendanceAndDefaulters || {};
    const below = (a.defaulters || []).filter((r: any) => r.attendancePercentage !== null && r.attendancePercentage < 75);
    return {
      kpis: [
        { label: 'Overall attendance', value: pctText(a.summary?.overallAttendancePercentage), tone: a.summary?.totalMarked ? (a.summary.overallAttendancePercentage >= 75 ? 'good' : 'warn') : undefined },
        { label: 'Present / Absent', value: `${num(a.summary?.present)} / ${num(a.summary?.absent)}` },
        { label: 'Below 75%', value: num(a.summary?.studentsLt75), tone: a.summary?.studentsLt75 ? 'warn' : undefined },
        { label: 'Below 50%', value: num(a.summary?.studentsLt50), tone: a.summary?.studentsLt50 ? 'bad' : undefined },
      ],
      sections: [
        {
          title: 'By class & section',
          rows: (a.classWise || []).filter((r: any) => r.workingDays > 0).map((r: any) => ({ title: `${r.className}-${r.section}`, detail: `${num(r.present)} present · ${num(r.absent)} absent`, value: pctText(r.averageAttendancePct), tone: r.averageAttendancePct >= 75 ? 'good' : 'warn' })),
          empty: 'No attendance marked in this period.',
        },
        {
          title: 'Students below 75%',
          rows: below.slice(0, 50).map((r: any) => ({ title: r.studentName, detail: `${r.className || ''}${r.section ? `-${r.section}` : ''} · ${num(r.present)}/${num(r.workingDays)} days`, value: pctText(r.attendancePercentage), tone: r.attendancePercentage < 50 ? 'bad' : 'warn' })),
          empty: 'No student is below 75%.',
        },
      ],
    };
  }
  if (tab === 'STAFF') {
    const st = d?.facultyAndPayroll || {};
    const pay = !!st.summary?.canViewPayroll;
    return {
      kpis: [
        { label: 'Active staff', value: num(st.summary?.totalActiveFaculty) },
        { label: 'Teaching / Non-teaching', value: `${num(st.summary?.teachingStaff)} / ${num(st.summary?.nonTeachingStaff)}` },
        ...(pay ? [{ label: 'Net payroll (period)', value: inr(st.summary?.netPayroll) }, { label: 'Deductions (period)', value: inr(st.summary?.totalDeductions) }] : []),
      ],
      sections: [
        {
          title: 'Staff',
          rows: (st.staffWise || []).map((r: any) => ({
            title: r.employeeName,
            detail: [r.designation, r.employeeId, pay && r.payrollMonth ? r.payrollMonth : ''].filter(Boolean).join(' · '),
            value: pay ? (r.paymentStatus === 'NOT_GENERATED' ? 'Not generated' : inr(r.netSalary)) : String(r.employmentStatus || ''),
          })),
          empty: 'No staff for these filters.',
        },
      ],
      notice: pay ? undefined : 'Salary details are visible to payroll roles only.',
    };
  }
  const e = d?.examinationAnalysis || {};
  return {
    kpis: [
      { label: 'Appeared', value: num(e.summary?.appeared) },
      { label: 'Pass rate', value: pctText(e.summary?.passPercentage), tone: e.summary?.appeared ? (e.summary.passPercentage >= 80 ? 'good' : 'warn') : undefined },
      { label: 'Average', value: pctText(e.summary?.averagePercentage) },
      { label: 'Highest', value: pctText(e.summary?.highestPercentage), hint: e.summary?.appeared ? e.summary?.highestScorer : undefined },
    ],
    sections: [
      { title: 'By class', rows: (e.classWise || []).map((r: any) => ({ title: r.className, detail: `${num(r.studentsAppeared)} appeared · avg ${pctText(r.averagePercentage)}`, value: pctText(r.passPercentage) })), empty: 'No marks entered for these filters.' },
      { title: 'By subject', rows: (e.subjectWise || []).map((r: any) => ({ title: r.subjectName, detail: `${num(r.studentsAppeared)} entries · avg ${r.averageMarks}`, value: pctText(r.passPercentage) })), empty: 'No marks entered for these filters.' },
    ],
  };
}

/** Plain-text report for the share sheet (WhatsApp, email, Drive …). */
export function shareText(tab: ReportTab, d: any, sid: SchoolIdentity, filtersLabel: string, generatedBy: string, now = new Date()): string {
  const v = tabView(tab, d);
  const label = REPORT_TABS.find((t) => t.id === tab)!.label;
  const out: string[] = [
    sid.name || NOT_CONFIGURED,
    [affiliationLine(sid), sid.address].filter(Boolean).join(' · '),
    '',
    `${label} report`,
    filtersLabel,
    `Generated ${now.toLocaleString('en-IN')} by ${generatedBy}`,
    '',
  ];
  if (v.notice) out.push(v.notice, '');
  v.kpis.forEach((k) => out.push(`${k.label}: ${k.value}${k.hint ? ` (${k.hint})` : ''}`));
  v.sections.forEach((sec) => {
    out.push('', `${sec.title}${sec.note ? ` — ${sec.note}` : ''}`);
    if (!sec.rows.length) out.push(sec.empty);
    sec.rows.forEach((r) => out.push(`• ${r.title} — ${r.value}${r.detail ? ` (${r.detail})` : ''}`));
  });
  return out.join('\n');
}
