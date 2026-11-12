import React, { useState, useMemo } from 'react';
import { X, FileText, Calendar, Plus, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { Student, FeeLedgerEntry, ClassFeeConfiguration, TransportSlab } from '../../types';
import { api } from '../../services/api';
import {
  isMonthOnOrAfterEnrollmentDate,
  getApplicableBillingMonths,
  formatDateDisplay,
} from '../../utils/feeDateHelper';
import { buildStudentMonthlyBreakdown } from '../../utils/studentMonthlyFee';

interface GenerateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  existingLedgers: FeeLedgerEntry[];
  onInvoiceGenerated: (newLedger: FeeLedgerEntry) => void;
}

export const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({
  isOpen,
  onClose,
  student,
  existingLedgers,
  onInvoiceGenerated,
}) => {
  const effectiveEnrollmentDate = student.enrollmentDate || student.feeStartDate || student.admissionDate || '2026-04-01';
  const effectiveFeeStartDate = student.feeStartDate || effectiveEnrollmentDate;

  const applicableMonths = useMemo(() => {
    return getApplicableBillingMonths(effectiveEnrollmentDate, 12);
  }, [effectiveEnrollmentDate]);

  const defaultMonth = useMemo(() => {
    const now = new Date();
    const current = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return applicableMonths.includes(current) ? current : (applicableMonths[0] || 'October 2026');
  }, [applicableMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  React.useEffect(() => {
    setSelectedMonth(defaultMonth);
  }, [defaultMonth]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10)
  );

  // Optional extra fee head
  const [includeExtraFee, setIncludeExtraFee] = useState<boolean>(false);
  const [extraHeadName, setExtraHeadName] = useState<string>('Activity / Assessment Fee');
  const [extraHeadAmount, setExtraHeadAmount] = useState<number>(500);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check enrollment constraint
  const isBeforeEnrollment = useMemo(() => {
    return !isMonthOnOrAfterEnrollmentDate(selectedMonth, effectiveEnrollmentDate);
  }, [selectedMonth, effectiveEnrollmentDate]);

  // Pull class fee configuration and transport slab
  // Pull effective class fee configuration (Section override > Class default) and transport slabs
  const transportSlabs = api.getTransportSlabsSync();

  const classConfig = useMemo(() => {
    return api.getEffectiveFeeConfig(
      student.classId,
      student.section,
      student.academicSession,
      student.category
    );
  }, [student]);

  // Compute breakdown preview
  const breakdown = useMemo(() => {
    // Same amounts the server puts on the bill: the student's own fee profile first
    const items: { head: string; amount: number; isOneTime?: boolean }[] = buildStudentMonthlyBreakdown(
      student,
      classConfig,
      transportSlabs
    );

    if (includeExtraFee && extraHeadAmount > 0) {
      items.push({
        head: extraHeadName || 'One-Time Additional Fee',
        amount: Number(extraHeadAmount),
        isOneTime: true,
      });
    }

    return items;
  }, [classConfig, student, transportSlabs, includeExtraFee, extraHeadName, extraHeadAmount]);

  const totalCalculated = useMemo(() => {
    return breakdown.reduce((sum, item) => sum + item.amount, 0);
  }, [breakdown]);

  // Check duplicate invoice
  const alreadyExists = useMemo(() => {
    return existingLedgers.some(
      (l) =>
        l.feeMonth === selectedMonth ||
        l.monthYear === selectedMonth ||
        l.billingPeriod === selectedMonth ||
        (l.feeType && l.feeType.includes(selectedMonth))
    );
  }, [existingLedgers, selectedMonth]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBeforeEnrollment) {
      setErrorMsg(`Monthly fee cannot be generated for ${selectedMonth}: Student was enrolled on ${formatDateDisplay(effectiveEnrollmentDate)}. Applicable monthly fee starts from enrollment date onward.`);
      return;
    }

    if (alreadyExists) {
      setErrorMsg(`An invoice for ${selectedMonth} has already been issued for this student.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (includeExtraFee && extraHeadAmount > 0) {
        // If extra fee head was specified, we can use addFeeLedgerBill with full custom breakdown
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const newLedger: FeeLedgerEntry = {
          id: `fl-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          invoiceNumber,
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: student.name,
          className: student.className,
          section: student.section,
          academicSession: student.academicSession || '2026-2027',
          feeMonth: selectedMonth,
          monthYear: selectedMonth,
          billingPeriod: selectedMonth,
          feeType: `Monthly School Fee (${selectedMonth})`,
          breakdown,
          amount: totalCalculated,
          discount: 0,
          fine: 0,
          total: totalCalculated,
          paidAmount: 0,
          pendingAmount: totalCalculated,
          status: 'PENDING',
          dueDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const res = await api.addFeeLedgerBill({
          studentId: student.id,
          feeType: `Monthly School Fee (${selectedMonth})`,
          description: `Monthly billing for ${selectedMonth} with custom heads`,
          amount: totalCalculated,
          dueDate,
          frequency: 'MONTHLY',
          applicableMonth: selectedMonth,
          academicSession: student.academicSession,
          breakdown,
        });

        if (res.success && res.ledger) {
          onInvoiceGenerated(res.ledger);
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to generate invoice.');
        }
      } else {
        const res = await api.generateStudentMonthlyInvoice(student.id, {
          monthYear: selectedMonth,
          dueDate,
          academicSession: student.academicSession,
        });

        if (res.success && res.ledger) {
          onInvoiceGenerated(res.ledger);
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to generate invoice.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while generating invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Generate Student Fee Invoice</h3>
              <p className="text-xs text-blue-200">
                {student.name} • {student.admissionNumber} ({student.className})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Enrollment Timeline Banner */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-800">Enrollment Date:</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                  {formatDateDisplay(effectiveEnrollmentDate)}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-bold text-slate-800">Fee Start Date:</span>
                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">
                  {formatDateDisplay(effectiveFeeStartDate)}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Core rule: Monthly fee billing starts from the student's Enrollment Date onward.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">
              {errorMsg}
            </div>
          )}

          {isBeforeEnrollment && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Cannot bill {selectedMonth}: Student was enrolled on {formatDateDisplay(effectiveEnrollmentDate)}. Monthly fees can only be generated from enrollment date onward.
              </span>
            </div>
          )}

          {alreadyExists && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>An invoice for {selectedMonth} already exists for this student. Duplicate billing prevented.</span>
            </div>
          )}

          {/* Month & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Billing Month / Period *</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {applicableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Payment Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Breakdown Preview based on student profile */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
              <span>Configured Breakdown Heads</span>
              <span>Amount (₹)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2">
                  <span className="text-slate-700 font-medium">{item.head}</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{item.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
              <div className="bg-blue-50/70 px-3.5 py-2.5 flex items-center justify-between font-bold text-blue-950 border-t border-blue-200">
                <span>Calculated Invoice Total</span>
                <span className="font-mono text-sm text-blue-900">
                  ₹{totalCalculated.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Option to Add One-Time Fee */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/60">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={includeExtraFee}
                  onChange={(e) => setIncludeExtraFee(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Include One-Time Fee Head in this Invoice</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Optional</span>
            </div>

            {includeExtraFee && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-slate-600 text-[11px] font-semibold mb-1">Fee Head Name</label>
                  <input
                    type="text"
                    value={extraHeadName}
                    onChange={(e) => setExtraHeadName(e.target.value)}
                    placeholder="e.g. Lab Charges, Sports Kit"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-[11px] font-semibold mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={extraHeadAmount}
                    onChange={(e) => setExtraHeadAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || alreadyExists || isBeforeEnrollment}
              className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Generating Invoice...</span>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Issue Invoice (₹{totalCalculated.toLocaleString('en-IN')})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
