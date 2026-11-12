import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, Loader2, X } from 'lucide-react';
import { StaffPayrollRecord, SchoolSettings, TeacherStaff } from '../../types';
import { numberToWords } from '../../utils/numberToWords';
import { api } from '../../services/api';
import { schoolIdentity } from '../../utils/schoolIdentity';

interface PrintableSalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StaffPayrollRecord;
  staff?: TeacherStaff | null;
  settings?: SchoolSettings | null;
}

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (v?: string) => {
  if (!v) return '';
  const d = new Date(`${String(v).substring(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const METHOD: Record<string, string> = { BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', UPI: 'UPI', CASH: 'Cash' };
const days = (n?: number) => `${Number(n) || 0} day${Number(n) === 1 ? '' : 's'}`;
/** Only the last 4 digits of a bank account are printed. */
const maskAccount = (v?: string) => {
  const digits = String(v || '').replace(/\s/g, '');
  return digits.length > 4 ? `XXXX${digits.slice(-4)}` : digits;
};

/**
 * On-screen payslip. Every figure comes from the stored payroll record; nothing is assumed. The PDF
 * (Download) is built by the server from the same record, so web and mobile get the same document.
 */
export const PrintableSalarySlipModal: React.FC<PrintableSalarySlipModalProps> = ({ isOpen, onClose, record, staff, settings }) => {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const sid = schoolIdentity(settings);
  const isPaid = record.paymentStatus === 'PAID';
  const monthly = Number(record.monthlySalary ?? record.basicSalary) || 0;
  const daily = Number(record.dailySalary) || Math.round((monthly / 30) * 100) / 100;

  const allowanceRows = Object.entries(record.allowances || {}).filter(([, v]) => Number(v));
  const ALLOWANCE_LABELS: Record<string, string> = { hra: 'House rent allowance', da: 'Dearness allowance', ta: 'Travel allowance', special: 'Special allowance', other: 'Other allowance' };
  const earnings: [string, number][] = allowanceRows.length
    ? [['Basic salary', Number(record.basicSalary) || 0], ...allowanceRows.map(([k, v]) => [ALLOWANCE_LABELS[k] || k, Number(v)] as [string, number])]
    : [['Monthly salary', monthly]];
  const gross = earnings.reduce((s, [, v]) => s + v, 0);

  const deductions: { label: string; detail: string; amount: number }[] = [
    { label: 'Late arrival', detail: `${days(record.lateDays)} × 25% of ${inr(daily)}`, amount: Number(record.lateDeduction) || 0 },
    { label: 'Unpaid leave / absence', detail: `${days(record.unpaidLeaveDays)} × ${inr(daily)}`, amount: Number(record.unpaidLeaveDeduction) || 0 },
    { label: 'Attendance not marked', detail: `${days(record.notMarkedDays)} × ${inr(daily)}`, amount: Number(record.notMarkedDeduction) || 0 },
    { label: 'Before salary start', detail: days(record.notEmployedDays), amount: Number(record.notEmployedDeduction) || 0 },
    { label: 'Other deductions', detail: '', amount: Number(record.otherDeductions) || 0 },
  ].filter((d) => d.amount > 0);
  const totalDeductions = Number(record.totalDeductions) || deductions.reduce((s, d) => s + d.amount, 0);
  const net = Number(record.netSalary) || 0;

  const employee: [string, string][] = (
    [
      ['Name', record.staffName],
      ['Employee ID', record.employeeId],
      ['Designation', record.designation || staff?.designation || ''],
      ['Department', record.department || staff?.department || ''],
      ['Date of joining', fmtDate(staff?.joiningDate)],
      ['Bank', [staff?.bankName, maskAccount(staff?.bankAccountNo)].filter(Boolean).join(' · ')],
      ['IFSC', staff?.ifscCode || ''],
      ['PAN', staff?.panNumber || ''],
      ['UAN', record.uanNumber || staff?.uanNumber || ''],
    ] as [string, string][]
  ).filter(([, v]) => v);

  const attendance: [string, string][] = (
    [
      ['Present', record.presentDays],
      ['Late', record.lateDays],
      ['Leave taken', record.leaveDaysTaken],
      ['Leave forgiven', record.waivedLeaveDays],
      ['Unpaid', record.unpaidLeaveDays],
      ['Holidays', record.holidayDays],
      ['Before salary start', Number(record.notEmployedDays) > 0 ? record.notEmployedDays : undefined],
    ] as [string, number | undefined][]
  )
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)]);

  const handleDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    const res = await api.downloadPayslip(record.id);
    setDownloading(false);
    if (!res.ok) setDownloadError(res.error || 'Could not download the payslip.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-slate-900/60 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Payslip ${record.month}`}>
      <div className="bg-white w-full max-w-3xl rounded-xl border border-slate-200 my-auto flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">Payslip · {record.month}</h2>
            <p className="text-sm text-slate-500 truncate">{record.staffName} · {record.employeeId}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!isPaid || downloading}
              title={isPaid ? 'Download PDF' : 'Available after the salary is paid'}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}
              PDF
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </div>
        {downloadError && <p role="alert" className="px-5 py-2 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">{downloadError}</p>}

        <div className="overflow-y-auto p-5 sm:p-8 text-slate-800">
          {/* School */}
          <div className="text-center pb-4 border-b-2 border-slate-900">
            <p className="text-lg sm:text-xl font-bold text-slate-900">{sid.name}</p>
            {sid.address && <p className="text-sm text-slate-600">{sid.address}</p>}
            <p className="text-xs text-slate-500 mt-0.5">
              {[sid.affiliationNo && `${sid.board ? `${sid.board} ` : ''}Affiliation No. ${sid.affiliationNo}`, sid.phones[0], sid.email].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2 pt-4">
            <div>
              <p className="text-sm text-slate-500">Payslip for</p>
              <p className="text-lg font-semibold text-slate-900">{record.month}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-slate-500">Payslip no.</p>
              <p className="font-mono text-slate-900">{record.salarySlipNumber || record.id}</p>
            </div>
          </div>

          {/* Employee */}
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {employee.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-900 text-right">{v}</dd>
              </div>
            ))}
          </dl>

          {/* Attendance */}
          {attendance.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Attendance · {fmtDate(record.salaryPeriodStart)} to {fmtDate(record.salaryPeriodEnd)}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-7 border border-slate-200 rounded-lg divide-x divide-slate-200 text-center">
                {attendance.map(([k, v]) => (
                  <div key={k} className="py-2 px-1">
                    <p className="text-[11px] text-slate-500 leading-tight">{k}</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Earnings and deductions */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Earnings</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {earnings.map(([k, v]) => (
                  <tr key={k}>
                    <td className="px-3 py-2">{k}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(v)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2">Gross</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(gross)}</td>
                </tr>
              </tfoot>
            </table>

            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Deductions</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deductions.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-slate-500" colSpan={2}>No deductions</td>
                  </tr>
                ) : (
                  deductions.map((d) => (
                    <tr key={d.label}>
                      <td className="px-3 py-2">
                        {d.label}
                        {d.detail && <span className="block text-xs text-slate-500">{d.detail}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(d.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2">Total deductions</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(totalDeductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Net */}
          <div className="mt-5 rounded-lg border-2 border-slate-900 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Net salary</p>
              <p className="text-sm text-slate-600">{numberToWords(Math.round(net))}</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{inr(net)}</p>
          </div>

          {/* Payment */}
          <div className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${isPaid ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
            {isPaid ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
            <p>
              {isPaid ? (
                <>
                  Paid on {fmtDate(record.paymentDate)} by {METHOD[String(record.paymentMethod)] || record.paymentMethod}
                  {record.transactionReference ? <> · Ref <span className="font-mono">{record.transactionReference}</span></> : null}
                </>
              ) : (
                'Not paid yet. The PDF payslip is available once the salary is marked as paid.'
              )}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
            <div className="border-t border-slate-400 pt-2 text-slate-700">Employee signature</div>
            <div className="border-t border-slate-400 pt-2 text-slate-700">Authorised signatory</div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">Computer-generated payslip.</p>
        </div>
      </div>
    </div>
  );
};
