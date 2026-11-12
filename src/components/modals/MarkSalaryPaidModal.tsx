import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { StaffPayrollRecord } from '../../types';
import { api } from '../../services/api';

interface MarkSalaryPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StaffPayrollRecord;
  onSuccess: (updated: StaffPayrollRecord) => void;
}

export const MarkSalaryPaidModal: React.FC<MarkSalaryPaidModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  // Today in the school's timezone; a payment cannot be dated in the future.
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  // Hooks run before any early return (React requires the same hooks on every render).
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CHEQUE' | 'UPI' | 'CASH'>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  // Left empty: only the reference of the real transfer/cheque is recorded, never a generated one.
  const [transactionReference, setTransactionReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !record) return null;
  const referenceRequired = paymentMethod !== 'CASH';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (referenceRequired && !transactionReference.trim()) {
      setErrorMessage('Enter the UTR / transaction or cheque number for this payment.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.markSalaryAsPaidAsync(record.id, {
        paymentMethod,
        paymentDate,
        transactionReference: transactionReference.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (res.success && res.record) {
        onSuccess(res.record);
        onClose();
      } else {
        setErrorMessage(res.error || 'Could not save the payment. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error. Please check the connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const net = `₹${(record.netSalary || 0).toLocaleString('en-IN')}`;
  const field = 'w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-600';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-slate-900/50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Record salary payment">
      <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 my-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Mark salary paid</h3>
            <p className="text-sm text-slate-500">{record.staffName} · {record.month}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          <div className="rounded-lg bg-emerald-50 px-4 py-3 flex items-center justify-between">
            <span className="text-emerald-900">Amount to pay</span>
            <span className="text-xl font-semibold tabular-nums text-emerald-800">{net}</span>
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
              {errorMessage}
            </p>
          )}

          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">Paid by</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className={field}>
              <option value="BANK_TRANSFER">Bank transfer (NEFT / RTGS / IMPS)</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
            </select>
          </label>

          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">Payment date</span>
            <input type="date" required max={todayStr} min={record.salaryPeriodStart || undefined} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={field} />
          </label>

          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">
              {paymentMethod === 'CHEQUE' ? 'Cheque number' : referenceRequired ? 'UTR / transaction number' : 'Voucher number (optional)'}
            </span>
            <input type="text" required={referenceRequired} maxLength={100} value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} className={`${field} font-mono`} />
          </label>

          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">Note (optional)</span>
            <input type="text" maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} />
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-800 font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60">
              <CheckCircle2 className="w-4 h-4" aria-hidden />
              {isSubmitting ? 'Saving…' : `Mark ${net} paid`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
