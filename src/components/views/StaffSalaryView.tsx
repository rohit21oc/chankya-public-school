import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  Search,
  Filter,
  Calendar,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  CreditCard,
  Building2,
  User,
  ShieldCheck,
  Plus,
  Sparkles,
  DollarSign,
  Download,
  History,
  Check,
  ChevronRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import { StaffPayrollRecord, TeacherStaff, UserRole, SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { SalaryDetailModal } from '../modals/SalaryDetailModal';
import { PrintableSalarySlipModal } from '../modals/PrintableSalarySlipModal';
import { MarkSalaryPaidModal } from '../modals/MarkSalaryPaidModal';

interface StaffSalaryViewProps {
  userRole?: UserRole;
  currentUser?: any;
  settings?: SchoolSettings | null;
}

const MONTH_OPTIONS = [
  { value: '01', name: 'January' },
  { value: '02', name: 'February' },
  { value: '03', name: 'March' },
  { value: '04', name: 'April' },
  { value: '05', name: 'May' },
  { value: '06', name: 'June' },
  { value: '07', name: 'July' },
  { value: '08', name: 'August' },
  { value: '09', name: 'September' },
  { value: '10', name: 'October' },
  { value: '11', name: 'November' },
  { value: '12', name: 'December' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = { BANK_TRANSFER: 'Bank transfer', UPI: 'UPI', CHEQUE: 'Cheque', CASH: 'Cash' };
const formatPaymentMethod = (m?: string) => (m ? PAYMENT_METHOD_LABELS[m] || m : '—');

export const StaffSalaryView: React.FC<StaffSalaryViewProps> = ({
  userRole = 'SUPER_ADMIN',
  currentUser,
  settings,
}) => {
  // Authorization Check
  const canViewPayroll = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'HR_STAFF'].includes(
    userRole
  );
  const canManagePayroll = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'HR_STAFF'].includes(
    userRole
  );

  // School timezone (Asia/Kolkata). Payroll is generated for completed months, so the screen opens
  // on the most recent completed month.
  const istParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date());
  const istYear = Number(istParts.find((p) => p.type === 'year')?.value);
  const istMonth = Number(istParts.find((p) => p.type === 'month')?.value);
  const currentYear = istMonth === 1 ? istYear - 1 : istYear;
  const defaultMonthStr = String(istMonth === 1 ? 12 : istMonth - 1).padStart(2, '0');

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  // Data States
  const [payrollRecords, setPayrollRecords] = useState<StaffPayrollRecord[]>([]);
  const [staffList, setStaffList] = useState<TeacherStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Modal States
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<StaffPayrollRecord | null>(null);
  const [selectedPrintRecord, setSelectedPrintRecord] = useState<StaffPayrollRecord | null>(null);
  const [selectedPayRecord, setSelectedPayRecord] = useState<StaffPayrollRecord | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showHistoryStaffId, setShowHistoryStaffId] = useState<string | null>(null);

  // Generate Modal Form State
  const [genMonth, setGenMonth] = useState(defaultMonthStr);
  const [genYear, setGenYear] = useState(currentYear);
  const [genForce, setGenForce] = useState(false);

  // Load Data
  const loadPayrollData = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const monthPrefix = `${selectedYear}-${selectedMonth}`;
      const staffMembers = api.getStaff();
      setStaffList(staffMembers);

      const res = await api.fetchStaffPayrollAsync({
        month: monthPrefix,
        year: selectedYear,
      });

      if (res && res.records) {
        setPayrollRecords(res.records);
      } else {
        setPayrollRecords(api.getStaffPayroll());
        setActionMessage({ type: 'error', text: 'Unable to load the latest payroll. Showing the last saved data — please refresh.' });
      }
    } catch (err: any) {
      console.error('Error loading payroll data:', err);
      setPayrollRecords(api.getStaffPayroll());
      setActionMessage({ type: 'error', text: 'Unable to load the latest payroll. Showing the last saved data — please refresh.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canViewPayroll) {
      loadPayrollData();
    }
  }, [selectedMonth, selectedYear, canViewPayroll]);

  // Handle Manual Payroll Generation
  const handleGeneratePayroll = async () => {
    setIsGenerating(true);
    setActionMessage(null);
    try {
      const targetMonthKey = `${genYear}-${genMonth}`;
      const res = await api.generateStaffPayrollAsync(targetMonthKey, genYear, genForce);
      if (res.success) {
        const missing = res.notConfigured || [];
        setActionMessage({
          type: missing.length ? 'error' : 'success',
          text:
            res.message +
            (missing.length
              ? ` Set a salary for: ${missing.map((m) => `${m.name}${m.employeeId ? ` (${m.employeeId})` : ''}`).join(', ')}.`
              : ''),
        });
        setShowGenerateModal(false);
        // Switch view filter to generated month to view results immediately
        setSelectedMonth(genMonth);
        setSelectedYear(genYear);
        await loadPayrollData();
      } else {
        setActionMessage({
          type: 'error',
          text: res.message || 'Failed to generate payroll. Please try again.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Error occurred while generating payroll.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered Records for Selected Month & Criteria
  const filteredRecords = useMemo(() => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
    const monthName = MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.name || '';

    return payrollRecords.filter((rec) => {
      // Month match (either payrollMonth format YYYY-MM or month name)
      const matchesMonth =
        rec.payrollMonth === monthKey ||
        (rec.year === selectedYear && rec.month.toLowerCase().includes(monthName.toLowerCase()));

      if (!matchesMonth) return false;

      // Status filter
      if (statusFilter !== 'ALL' && rec.paymentStatus !== statusFilter) {
        return false;
      }

      // Department filter
      if (departmentFilter !== 'ALL' && (rec.department || '').toUpperCase() !== departmentFilter) {
        return false;
      }

      // Search Query: Name, Employee ID, or UAN Number
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (rec.staffName || '').toLowerCase().includes(q);
        const matchesEmpId = (rec.employeeId || '').toLowerCase().includes(q);
        const matchesUan = (rec.uanNumber || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmpId && !matchesUan) {
          return false;
        }
      }

      return true;
    });
  }, [payrollRecords, selectedMonth, selectedYear, statusFilter, departmentFilter, searchQuery]);

  // Aggregate Dashboard Metrics
  const metrics = useMemo(() => {
    let totalMonthlyGross = 0;
    let totalNetPayable = 0;
    let totalLateDeductions = 0;
    let totalLeaveDeductions = 0;
    let totalOtherDeductions = 0;
    let totalDeductions = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    filteredRecords.forEach((rec) => {
      const gross = rec.monthlySalary || rec.grossSalary || 0;
      const net = rec.netSalary || 0;
      const late = rec.lateDeduction || 0;
      // Absence, extra leave and working days without attendance are all one day's salary each.
      const leave = (rec.unpaidLeaveDeduction || 0) + (rec.notMarkedDeduction || 0);
      const other = rec.otherDeductions || 0;

      totalMonthlyGross += gross;
      totalNetPayable += net;
      totalLateDeductions += late;
      totalLeaveDeductions += leave;
      totalOtherDeductions += other;
      totalDeductions += rec.totalDeductions || late + leave + other;

      if (rec.paymentStatus === 'PAID') {
        paidCount++;
        paidAmount += net;
      } else {
        pendingCount++;
        pendingAmount += net;
      }
    });

    return {
      recordCount: filteredRecords.length,
      totalMonthlyGross,
      totalNetPayable,
      totalLateDeductions,
      totalLeaveDeductions,
      totalOtherDeductions,
      totalDeductions,
      paidCount,
      pendingCount,
      paidAmount,
      pendingAmount,
    };
  }, [filteredRecords]);

  // Staff lookup helper for full details
  const getStaffForRecord = (rec: StaffPayrollRecord): TeacherStaff | null => {
    return (
      staffList.find(
        (s) => s.id === rec.staffId || (s.employeeId && s.employeeId.toUpperCase() === (rec.employeeId || '').toUpperCase())
      ) || null
    );
  };

  // History of one person across all months (the register above holds only the selected month).
  const [historyRecords, setHistoryRecords] = useState<StaffPayrollRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  useEffect(() => {
    if (!showHistoryStaffId) return;
    let alive = true;
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryRecords([]);
    api.fetchStaffPayrollHistory(showHistoryStaffId).then((res) => {
      if (!alive) return;
      setHistoryLoading(false);
      if (res.ok) setHistoryRecords(res.records);
      else setHistoryError(res.error || 'Could not load the salary history.');
    });
    return () => {
      alive = false;
    };
  }, [showHistoryStaffId]);

  if (!canViewPayroll) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" aria-hidden />
        <h2 className="text-lg font-semibold text-slate-900">No access to staff salaries</h2>
        <p className="mt-1 text-sm text-slate-600">Salary records are visible to payroll staff only. Your own payslips are under My Profile.</p>
      </div>
    );
  }

  const monthLabel = `${MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.name} ${selectedYear}`;
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const departments: string[] = Array.from(new Set<string>(payrollRecords.map((r) => String(r.department || '').toUpperCase()).filter(Boolean))).sort();
  const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmtDate = (v?: string) => {
    if (!v) return '';
    const d = new Date(`${String(v).substring(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const selectCls = 'h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';
  const StatusPill = ({ paid }: { paid: boolean }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${paid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
      {paid ? 'Paid' : 'Not paid'}
    </span>
  );
  const deductionOf = (rec: StaffPayrollRecord) =>
    Number(rec.totalDeductions) ||
    (rec.lateDeduction || 0) + (rec.unpaidLeaveDeduction || 0) + (rec.notMarkedDeduction || 0) + (rec.notEmployedDeduction || 0) + (rec.otherDeductions || 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-4 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Staff Salary</h1>
          <p className="text-sm text-slate-600">Salaries are calculated from attendance after each month ends.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPayrollData}
            disabled={isLoading}
            aria-label="Refresh"
            title="Refresh"
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          {canManagePayroll && (
            <button
              type="button"
              onClick={() => {
                setGenMonth(selectedMonth);
                setGenYear(selectedYear);
                setShowGenerateModal(true);
              }}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
            >
              <Calendar className="w-4 h-4" aria-hidden />
              Calculate salary
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg border text-sm ${
            actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="flex gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
            {actionMessage.text}
          </span>
          <button type="button" onClick={() => setActionMessage(null)} className="font-medium hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Gross salary', value: inr(metrics.totalMonthlyGross), note: `${metrics.recordCount} staff` },
          { label: 'Deductions', value: inr(metrics.totalDeductions), note: `Late ${inr(metrics.totalLateDeductions)} · Leave ${inr(metrics.totalLeaveDeductions)}` },
          { label: 'Paid', value: inr(metrics.paidAmount), note: `${metrics.paidCount} staff` },
          { label: 'Still to pay', value: inr(metrics.pendingAmount), note: `${metrics.pendingCount} staff`, warn: metrics.pendingAmount > 0 },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${c.warn ? 'text-amber-700' : 'text-slate-900'}`}>{c.value}</p>
            <p className="text-xs text-slate-500">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-5 gap-2">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} aria-label="Month" className={selectCls}>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.name}</option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} aria-label="Year" className={selectCls}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="Department" className={selectCls}>
            <option value="ALL">All depts</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} aria-label="Payment status" className={selectCls}>
            <option value="ALL">All status</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Not paid</option>
          </select>
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, employee ID or UAN"
              aria-label="Search staff"
              className="h-10 w-full pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {monthLabel} · {filteredRecords.length} staff
          </h2>
          <p className="text-xs text-slate-500">Day's pay = monthly ÷ 30 · Late = 25% of a day · Unpaid leave = 1 day</p>
        </div>

        {isLoading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-600" role="status">Loading salaries…</p>
        ) : filteredRecords.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-700">No salary records for {monthLabel}.</p>
            <p className="mt-1 text-sm text-slate-500">
              Salaries appear after the month ends, for staff whose "Salary from" date is on or before it and who have a monthly salary set.
            </p>
            {canManagePayroll && (
              <button
                type="button"
                onClick={() => {
                  setGenMonth(selectedMonth);
                  setGenYear(selectedYear);
                  setShowGenerateModal(true);
                }}
                className="mt-4 h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Calculate {monthLabel}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Phones: one card per person */}
            <ul className="md:hidden divide-y divide-slate-200" aria-label="Salaries">
              {filteredRecords.map((rec) => {
                const paid = rec.paymentStatus === 'PAID';
                return (
                  <li key={`card-${rec.id}`} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 break-words">{rec.staffName}</p>
                        <p className="text-xs text-slate-500">{[rec.employeeId, rec.designation].filter(Boolean).join(' · ')}</p>
                      </div>
                      <StatusPill paid={paid} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div><dt className="text-xs text-slate-500">Monthly</dt><dd className="tabular-nums">{inr(rec.monthlySalary || rec.grossSalary || 0)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Deductions</dt><dd className="tabular-nums">{inr(deductionOf(rec))}</dd></div>
                      <div><dt className="text-xs text-slate-500">Net</dt><dd className="font-semibold tabular-nums">{inr(rec.netSalary)}</dd></div>
                    </dl>
                    {paid && <p className="text-xs text-slate-500">Paid {fmtDate(rec.paymentDate)} · {formatPaymentMethod(rec.paymentMethod)}{rec.transactionReference ? ` · ${rec.transactionReference}` : ''}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedDetailRecord(rec)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm">Details</button>
                      <button type="button" onClick={() => setSelectedPrintRecord(rec)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm">Payslip</button>
                      <button type="button" onClick={() => setShowHistoryStaffId(rec.staffId)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm">History</button>
                      {canManagePayroll && !paid && (
                        <button type="button" onClick={() => setSelectedPayRecord(rec)} className="h-10 px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold">Mark paid</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Tablets and desktops */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Staff</th>
                    <th className="px-4 py-3 font-medium text-right">Monthly</th>
                    <th className="px-4 py-3 font-medium text-right">Late</th>
                    <th className="px-4 py-3 font-medium text-right">Leave</th>
                    <th className="px-4 py-3 font-medium text-right">Other</th>
                    <th className="px-4 py-3 font-medium text-right">Net pay</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const paid = rec.paymentStatus === 'PAID';
                    const other = (rec.notEmployedDeduction || 0) + (rec.otherDeductions || 0);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 align-middle">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{rec.staffName}</p>
                          <p className="text-xs text-slate-500">{[rec.employeeId, rec.designation].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{inr(rec.monthlySalary || rec.grossSalary || 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {rec.lateDeduction ? <>{inr(rec.lateDeduction)}<span className="block text-xs text-slate-500">{rec.lateDays} day{rec.lateDays === 1 ? '' : 's'}</span></> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {(rec.unpaidLeaveDeduction || 0) + (rec.notMarkedDeduction || 0) ? (
                            <>
                              {inr((rec.unpaidLeaveDeduction || 0) + (rec.notMarkedDeduction || 0))}
                              {rec.unpaidLeaveDays ? <span className="block text-xs text-slate-500">{rec.unpaidLeaveDays} day{rec.unpaidLeaveDays === 1 ? '' : 's'} absent / leave</span> : null}
                              {rec.notMarkedDays ? <span className="block text-xs text-rose-700">{rec.notMarkedDays} day{rec.notMarkedDays === 1 ? '' : 's'} not marked</span> : null}
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {other ? <>{inr(other)}{rec.notEmployedDays ? <span className="block text-xs text-slate-500">{rec.notEmployedDays} day{rec.notEmployedDays === 1 ? '' : 's'} before start</span> : null}</> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{inr(rec.netSalary)}</td>
                        <td className="px-4 py-3">
                          <StatusPill paid={paid} />
                          {paid && <span className="block mt-1 text-xs text-slate-500">{fmtDate(rec.paymentDate)} · {formatPaymentMethod(rec.paymentMethod)}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setSelectedDetailRecord(rec)} title="Calculation" aria-label={`Calculation for ${rec.staffName}`} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                              <Eye className="w-4 h-4" aria-hidden />
                            </button>
                            <button type="button" onClick={() => setSelectedPrintRecord(rec)} title="Payslip" aria-label={`Payslip for ${rec.staffName}`} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                              <Printer className="w-4 h-4" aria-hidden />
                            </button>
                            <button type="button" onClick={() => setShowHistoryStaffId(rec.staffId)} title="History" aria-label={`Salary history of ${rec.staffName}`} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                              <History className="w-4 h-4" aria-hidden />
                            </button>
                            {canManagePayroll && !paid && (
                              <button type="button" onClick={() => setSelectedPayRecord(rec)} className="h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium">
                                Mark paid
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
          </>
        )}
      </div>

      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby="gen-salary-title">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="gen-salary-title" className="text-base font-semibold text-slate-900">Calculate salary</h3>
              <button type="button" onClick={() => setShowGenerateModal(false)} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="gen-m" className="block font-medium text-slate-700 mb-1.5">Month</label>
                  <select id="gen-m" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} className={selectCls}>
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="gen-y" className="block font-medium text-slate-700 mb-1.5">Year</label>
                  <select id="gen-y" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} className={selectCls}>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Only a month that has ended can be calculated.</li>
                <li>Staff are included from their "Salary from" date; a mid-month start pays only the days from that date.</li>
                <li>Late: 25% of a day's pay. Unpaid leave or absence: one day's pay. One leave day a month is forgiven.</li>
                <li>Days with no attendance marked are not deducted. Paid salaries are never changed.</li>
              </ul>
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={genForce} onChange={(e) => setGenForce(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                Recalculate salaries of this month that are not paid yet
              </label>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setShowGenerateModal(false)} className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={isGenerating} onClick={handleGeneratePayroll} className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-sm font-semibold">
                {isGenerating ? 'Calculating…' : 'Calculate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryStaffId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby="hist-title">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 id="hist-title" className="text-base font-semibold text-slate-900">Salary history</h3>
                <p className="text-sm text-slate-500">{historyRecords[0]?.staffName || ''}{historyRecords[0]?.employeeId ? ` · ${historyRecords[0].employeeId}` : ''}</p>
              </div>
              <button type="button" onClick={() => setShowHistoryStaffId(null)} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {historyLoading ? (
                <p className="px-5 py-10 text-center text-sm text-slate-600">Loading…</p>
              ) : historyError ? (
                <p className="px-5 py-10 text-center text-sm text-rose-700">{historyError}</p>
              ) : historyRecords.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-600">No salary records yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Month</th>
                      <th className="px-4 py-2.5 font-medium text-right">Gross</th>
                      <th className="px-4 py-2.5 font-medium text-right">Deductions</th>
                      <th className="px-4 py-2.5 font-medium text-right">Net</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5"><span className="sr-only">Payslip</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyRecords.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 text-slate-900">{item.month}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{inr(item.monthlySalary || item.grossSalary || 0)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{inr(deductionOf(item))}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{inr(item.netSalary)}</td>
                        <td className="px-4 py-2.5"><StatusPill paid={item.paymentStatus === 'PAID'} /></td>
                        <td className="px-4 py-2.5 text-right">
                          <button type="button" onClick={() => setSelectedPrintRecord(item)} aria-label={`Payslip for ${item.month}`} title="Payslip" className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                            <Printer className="w-4 h-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Salary Breakdown Modal */}
      {selectedDetailRecord && (
        <SalaryDetailModal
          isOpen={!!selectedDetailRecord}
          onClose={() => setSelectedDetailRecord(null)}
          record={selectedDetailRecord}
          canManage={canManagePayroll}
          onMarkPaidClick={(rec) => {
            setSelectedDetailRecord(null);
            setSelectedPayRecord(rec);
          }}
          onPrintClick={(rec) => {
            setSelectedDetailRecord(null);
            setSelectedPrintRecord(rec);
          }}
        />
      )}

      {/* 8. Official Salary Slip Print Modal */}
      {selectedPrintRecord && (
        <PrintableSalarySlipModal
          isOpen={!!selectedPrintRecord}
          onClose={() => setSelectedPrintRecord(null)}
          record={selectedPrintRecord}
          staff={getStaffForRecord(selectedPrintRecord)}
          settings={settings}
        />
      )}

      {/* 9. Mark Salary as Paid Modal */}
      {selectedPayRecord && (
        <MarkSalaryPaidModal
          isOpen={!!selectedPayRecord}
          onClose={() => setSelectedPayRecord(null)}
          record={selectedPayRecord}
          onSuccess={(updated) => {
            // Update in local records list
            setPayrollRecords((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setActionMessage({
              type: 'success',
              text: `Salary of ${updated.staffName} for ${updated.month} recorded as paid.`,
            });
          }}
        />
      )}
    </div>
  );
};
