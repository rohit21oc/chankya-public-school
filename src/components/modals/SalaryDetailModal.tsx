import React from 'react';
import { X, CheckCircle2, Printer, CreditCard } from 'lucide-react';
import { StaffPayrollRecord } from '../../types';

interface SalaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StaffPayrollRecord;
  onMarkPaidClick?: (record: StaffPayrollRecord) => void;
  onPrintClick?: (record: StaffPayrollRecord) => void;
  canManage?: boolean;
}

export const SalaryDetailModal: React.FC<SalaryDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onMarkPaidClick,
  onPrintClick,
  canManage = false,
}) => {
  if (!isOpen || !record) return null;

  const monthlySalary = record.monthlySalary || record.basicSalary || 0;
  const dailyRate = record.dailySalary || (monthlySalary > 0 ? Math.round((monthlySalary / 30) * 100) / 100 : 0);
  const lateDays = record.lateDays || 0;
  const lateDeduction = record.lateDeduction ?? Math.round((dailyRate * 0.25 * lateDays) * 100) / 100;
  const unpaidDays = record.unpaidLeaveDays || 0;
  const unpaidDeduction = record.unpaidLeaveDeduction ?? Math.round((dailyRate * unpaidDays) * 100) / 100;
  const notMarkedDays = record.notMarkedDays || 0;
  const notMarkedDeduction = record.notMarkedDeduction || 0;
  const otherDeductions = record.otherDeductions || 0;
  const beforeStartDays = record.notEmployedDays || 0;
  const beforeStartDeduction = record.notEmployedDeduction || 0;
  const totalDeductions =
    record.totalDeductions ?? Math.round((lateDeduction + unpaidDeduction + notMarkedDeduction + beforeStartDeduction + otherDeductions) * 100) / 100;
  const netSalary = record.netSalary ?? Math.max(0, Math.round((monthlySalary - totalDeductions) * 100) / 100);
  const isPaid = record.paymentStatus === 'PAID';
  const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const METHOD: Record<string, string> = { BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', UPI: 'UPI', CASH: 'Cash' };
  const d = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

  const rows: { label: string; formula: string; amount: number }[] = [
    { label: 'Late arrival', formula: `${d(lateDays)} × 25% × ${inr(dailyRate)}`, amount: lateDeduction },
    { label: 'Unpaid leave / absence', formula: `${d(unpaidDays)} × ${inr(dailyRate)}${record.absentDays ? ` (${d(record.absentDays)} marked absent)` : ''}`, amount: unpaidDeduction },
    ...(notMarkedDeduction > 0 ? [{ label: 'Attendance not marked', formula: `${d(notMarkedDays)} (working days without a mark) × ${inr(dailyRate)}`, amount: notMarkedDeduction }] : []),
    ...(beforeStartDeduction > 0 ? [{ label: 'Before salary start', formula: `${d(beforeStartDays)} of the month before "Salary from"`, amount: beforeStartDeduction }] : []),
    ...(otherDeductions > 0 ? [{ label: 'Other deductions', formula: '', amount: otherDeductions }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-slate-900/50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Salary calculation for ${record.staffName}`}>
      <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 my-auto flex flex-col max-h-[92vh]">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{record.staffName} · {record.month}</h3>
            <p className="text-sm text-slate-500">
              {[record.employeeId, record.designation, record.uanNumber && `UAN ${record.uanNumber}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 shrink-0">
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-sm text-slate-700">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2">Monthly salary</td>
                <td className="py-2 text-right tabular-nums text-slate-900">{inr(monthlySalary)}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500" colSpan={2}>One day's pay = monthly ÷ 30 = {inr(dailyRate)}</td>
              </tr>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2">
                    {r.label}
                    {r.formula && <span className="block text-xs text-slate-500">{r.formula}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.amount > 0 ? `− ${inr(r.amount)}` : inr(0)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-slate-900">
                <td className="pt-3">Net salary</td>
                <td className="pt-3 text-right text-lg tabular-nums">{inr(netSalary)}</td>
              </tr>
            </tbody>
          </table>

          {typeof record.leaveDaysTaken === 'number' && record.leaveDaysTaken > 0 && (
            <p className="text-sm text-slate-600">
              Leave taken: {d(record.leaveDaysTaken)}, {d(record.waivedLeaveDays || 0)} not deducted.
            </p>
          )}

          <div className={`rounded-lg px-4 py-3 ${isPaid ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
            {isPaid ? (
              <p className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                <span>
                  Paid on {record.paymentDate} by {METHOD[String(record.paymentMethod)] || record.paymentMethod}
                  {record.transactionReference ? <> · Ref <span className="font-mono">{record.transactionReference}</span></> : null}
                  {record.paidByName ? ` · recorded by ${record.paidByName}` : ''}
                </span>
              </p>
            ) : (
              <p>Not paid yet.</p>
            )}
          </div>

          {record.auditLog && record.auditLog.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">History of this record ({record.auditLog.length})</summary>
              <ul className="mt-2 space-y-1.5">
                {record.auditLog.map((log, idx) => (
                  <li key={idx} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-800">{log.details || log.action}</span>
                    <span className="block text-xs text-slate-500">
                      {[log.performedBy, log.timestamp && new Date(log.timestamp).toLocaleString('en-IN')].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
          {onPrintClick && (
            <button type="button" onClick={() => onPrintClick(record)} className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50">
              <Printer className="w-4 h-4" aria-hidden />
              Payslip
            </button>
          )}
          {canManage && !isPaid && onMarkPaidClick && (
            <button type="button" onClick={() => onMarkPaidClick(record)} className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold">
              <CreditCard className="w-4 h-4" aria-hidden />
              Mark paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
