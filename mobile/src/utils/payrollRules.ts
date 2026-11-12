/**
 * Pure helpers for the My Payroll screen.
 * The server record shape (src/types StaffPayrollRecord) differs from what the screen
 * used to read (deductionsTotal vs totalDeductions, paymentMode vs paymentMethod) and
 * several amounts are optional. Missing amounts stay undefined and render as "—";
 * they are never replaced by invented numbers.
 */
import type { User } from '../types';

export interface PayrollView {
  id: string;
  month: string;
  slipNumber?: string;
  status: string;
  net?: number;
  gross?: number;
  basic?: number;
  allowances?: number;
  deductions?: number;
  paymentDate?: string;
  paymentMethod?: string;
  transactionReference?: string;
  /** One day's salary (monthly ÷ 30). */
  dailySalary?: number;
  /** Working days marked Absent, and working days with no attendance mark (each = one day's salary). */
  absentDays?: number;
  notMarkedDays?: number;
  notMarkedDeduction?: number;
  /** Absent + unpaid / extra leave days and their amount. */
  unpaidLeaveDays?: number;
  unpaidLeaveDeduction?: number;
  lateDays?: number;
  lateDeduction?: number;
  weeklyOffDays?: number;
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && isFinite(v) ? v : undefined;

export function normalizePayrollRecord(raw: any): PayrollView {
  return {
    id: String(raw?.id ?? `${raw?.staffId ?? ''}-${raw?.month ?? ''}`),
    month: String(raw?.month ?? raw?.payrollMonth ?? 'Unknown month'),
    slipNumber: raw?.salarySlipNumber || undefined,
    status: String(raw?.paymentStatus || 'PENDING').toUpperCase(),
    net: num(raw?.netSalary),
    gross: num(raw?.grossSalary),
    basic: num(raw?.basicSalary),
    allowances: num(raw?.totalAllowances ?? raw?.allowancesTotal),
    deductions: num(raw?.totalDeductions ?? raw?.deductionsTotal),
    paymentDate: raw?.paymentDate || undefined,
    paymentMethod: raw?.paymentMethod || raw?.paymentMode || undefined,
    transactionReference: raw?.transactionReference || undefined,
    dailySalary: num(raw?.dailySalary),
    absentDays: num(raw?.absentDays),
    notMarkedDays: num(raw?.notMarkedDays),
    notMarkedDeduction: num(raw?.notMarkedDeduction),
    unpaidLeaveDays: num(raw?.unpaidLeaveDays),
    unpaidLeaveDeduction: num(raw?.unpaidLeaveDeduction),
    lateDays: num(raw?.lateDays),
    lateDeduction: num(raw?.lateDeduction),
    weeklyOffDays: num(raw?.weeklyOffDays),
  };
}

/** "₹1,234" for a real number, "—" when the amount is not available. */
export function formatRupees(value?: number): string {
  if (value === undefined || value === null || !isFinite(value)) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

/**
 * Keep only records that belong to the signed-in user. The server already scopes
 * non-privileged users; this is a second guard for privileged roles (whose
 * /my-salary response can contain everyone). If the user's identity cannot be
 * resolved, nothing is returned rather than someone else's pay.
 */
export function selectOwnPayroll(records: any[], user: Pick<User, 'id' | 'employeeId'>): any[] {
  const empId = (user.employeeId || '').trim().toUpperCase();
  const uid = (user.id || '').trim();
  if (!empId && !uid) return [];
  return (records || []).filter((r) => {
    const rEmp = String(r?.employeeId || '').trim().toUpperCase();
    const rStaff = String(r?.staffId || '').trim();
    return (empId !== '' && rEmp === empId) || (uid !== '' && rStaff === uid);
  });
}
