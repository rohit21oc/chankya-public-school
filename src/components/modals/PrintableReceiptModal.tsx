import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X, Scissors, GraduationCap, CheckCircle2 } from 'lucide-react';
import { FeePayment, SchoolSettings, Student, FeeLedgerEntry } from '../../types';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { api } from '../../services/api';
import { numberToIndianWords } from '../../utils/numberToWords';
import { exportReceiptToPdf, formatPaymentMethod, getLogoBase64Async } from '../../utils/receiptPdfExporter';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';

// Re-export numberToIndianWords for backwards compatibility across other modals
export { numberToIndianWords };

interface PrintableReceiptModalProps {
  payment: FeePayment | null;
  student?: Student | null;
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
}

interface ReceiptSlipProps {
  copyType: 'SCHOOL COPY' | 'STUDENT COPY';
  payment: FeePayment;
  student: Student | null;
  ledger: FeeLedgerEntry | null;
  settings: SchoolSettings;
  logoBase64?: string;
}

const ReceiptSlip: React.FC<ReceiptSlipProps> = ({
  copyType,
  payment,
  student,
  ledger,
  settings,
  logoBase64,
}) => {
  const isSchoolCopy = copyType === 'SCHOOL COPY';
  const paidAmount = Number(payment.amount) || 0;
  // Only what was added or taken off at this payment. A late fee the bill already carries is one of its heads
  // below, so falling back to ledger.fine here printed it twice.
  const discountAmount = Number(payment.discount || 0);
  const fineAmount = Number(payment.fine || 0);

  // Dynamic breakdown items from payment or ledger if available, else standard payment item
  const rawBreakdownItems =
    (payment as any)?.breakdown && (payment as any).breakdown.length > 0
      ? (payment as any).breakdown
      : ledger?.breakdown && ledger.breakdown.length > 0
      ? ledger.breakdown
      : [
          {
            head: payment.feeType || 'Tuition & School Fee',
            amount: paidAmount,
          },
        ];

  // Group excess breakdown items if more than 5 to preserve exact total without overflow
  const breakdownItems =
    rawBreakdownItems.length <= 5
      ? rawBreakdownItems
      : [
          ...rawBreakdownItems.slice(0, 4),
          {
            head: `Other Sundry Fees (${rawBreakdownItems.length - 4} Heads)`,
            amount: rawBreakdownItems
              .slice(4)
              .reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
          },
        ];

  const itemsTotal = rawBreakdownItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

  // Outstanding dues calculation
  const totalBillAmount = ledger ? Number(ledger.total ?? ledger.amount ?? 0) : paidAmount;
  const balanceDue = (payment as any).balanceDue !== undefined
    ? Number((payment as any).balanceDue)
    : (ledger
      ? Number(ledger.pendingAmount ?? Math.max(0, totalBillAmount - (ledger.paidAmount || paidAmount)))
      : 0);

  const invoiceNumStr = ledger?.invoiceNumber || (payment as any).invoiceNumber || 'INV-AUTO';

  // Actual dynamic Period / Fee Month from MongoDB ledger / payment
  const periodLabel =
    ledger?.feeMonth ||
    ledger?.monthYear ||
    (payment as any).feeMonth ||
    (payment as any).monthYear ||
    (payment as any).billingPeriod ||
    ledger?.billingPeriod ||
    payment.feeType ||
    'Admission 2026';

  const paymentModeStr = formatPaymentMethod(
    payment.paymentMethod,
    (payment as any).paymentMode || ledger?.paymentMethod || (ledger as any)?.paymentMode
  );

  const rawTxn =
    payment.transactionReference ||
    (payment as any).transactionNumber ||
    (payment as any).txnNumber ||
    (payment as any).referenceNo ||
    '';
  const ledgerTxn =
    ledger?.transactionReference ||
    (ledger as any)?.transactionNumber ||
    (ledger as any)?.txnNumber ||
    (ledger as any)?.referenceNo ||
    '';

  let transactionRefStr = rawTxn;
  if (
    !transactionRefStr ||
    transactionRefStr === 'N/A' ||
    transactionRefStr === 'Cash Counter' ||
    transactionRefStr === 'COUNTER-CASH'
  ) {
    if (ledgerTxn && ledgerTxn !== 'N/A' && ledgerTxn !== 'Cash Counter') {
      transactionRefStr = ledgerTxn;
    }
  }
  if (!transactionRefStr) {
    transactionRefStr =
      ((payment.paymentMethod || (payment as any).paymentMode || ledger?.paymentMethod || '').toUpperCase() === 'CASH'
        ? 'Cash Counter'
        : 'N/A');
  }

  const parentNameStr =
    student?.fatherName ||
    student?.guardianName ||
    student?.parentName ||
    'Parent / Guardian';

  const logoSrc = getSchoolLogoSrc(settings?.schoolLogo || (settings as any)?.logoFileKey);
  const effectiveLogo = logoBase64 || logoSrc;

  return (
    <div className="receipt-slip-item border border-slate-300 rounded-xl p-3 sm:p-3.5 bg-white text-slate-900 print:border-slate-400 print:p-2.5 print:rounded-none flex flex-col justify-between h-auto print:h-[132mm] print:max-h-[132mm] print:overflow-hidden box-border">
      {/* 1. Header */}
      <div>
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-1.5 mb-1.5 gap-2">
          <div className="flex items-center gap-2.5">
            {effectiveLogo ? (
              <img
                src={effectiveLogo}
                alt={settings?.schoolName || 'Residential PDS Public School Sheohar'}
                className="w-10 h-10 sm:w-11 sm:h-11 object-contain border border-slate-200 rounded-md p-0.5 bg-white shrink-0 block print:w-11 print:h-11"
                referrerPolicy="no-referrer"
                onError={handleLogoError}
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-md bg-[#0B1F4B] text-amber-300 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              </div>
            )}
            <div>
              <h3 className="text-xs sm:text-[13px] font-black uppercase tracking-wide text-slate-900 leading-tight font-serif">
                {settings?.schoolName || 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR'}
              </h3>
              <p className="text-[9px] text-slate-600 leading-tight mt-0.5">
                {settings?.schoolAddress || NOT_CONFIGURED}
              </p>
              <p className="text-[8px] text-slate-500 mt-0.5 font-medium">
                {letterheadLine(schoolIdentity(settings), { phone: true }) || 'School details not configured'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`inline-block px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider rounded border ${
                isSchoolCopy
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-blue-100 text-blue-900 border-blue-300'
              }`}
            >
              {copyType}
            </span>
            <div className="text-[8.5px] sm:text-[9px] font-bold text-slate-700 mt-0.5">
              Session: {payment.academicSession || settings?.currentAcademicSession || '2026-2027'}
            </div>
          </div>
        </div>

        {/* 2. Meta Particulars Bar: 5 Columns on Desktop & Print, 2 Columns on Mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-5 print:grid-cols-5 gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[9.5px] sm:text-[9px] print:text-[9px] mb-1.5">
          {/* Row 1 */}
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Receipt No.</span>
            <strong className="text-blue-950 font-mono font-bold text-[9.5px] break-all block">
              {payment.receiptNumber || 'REC-N/A'}
            </strong>
            {invoiceNumStr && invoiceNumStr !== 'INV-AUTO' && (
              <span className="text-slate-600 font-mono text-[8px] break-all block leading-tight mt-0.5">Invoice {invoiceNumStr}</span>
            )}
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Date of Deposit</span>
            <strong className="text-slate-900 font-semibold truncate block">
              {payment.paymentDate || 'N/A'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Admission Number</span>
            <strong className="text-slate-900 font-mono font-semibold truncate block">
              {student?.admissionNumber || payment.admissionNumber || 'N/A'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Student Name</span>
            <strong className="text-slate-900 text-[10px] font-bold truncate block">
              {student?.name || payment.studentName || 'Student'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Class & Section</span>
            <strong className="text-slate-900 font-semibold truncate block">
              {payment.className || student?.className || 'Class 6'} -{' '}
              {payment.section || student?.section || 'A'}
            </strong>
          </div>

          {/* Row 2 */}
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Payment Mode</span>
            <strong className="text-emerald-800 font-bold block truncate">
              {paymentModeStr}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Transaction Ref / No.</span>
            <strong
              className="text-slate-900 font-mono font-bold truncate block text-[9px] sm:text-[9.5px] print:text-[8.5px]"
              title={transactionRefStr}
            >
              {transactionRefStr}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Period / Fee Month</span>
            <strong className="text-slate-800 font-semibold truncate block" title={periodLabel}>
              {periodLabel}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Parent / Guardian</span>
            <span className="text-slate-800 font-medium truncate block" title={parentNameStr}>
              {parentNameStr}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[8px] leading-tight">Payment Status</span>
            <strong className={`font-bold block truncate ${balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {balanceDue > 0 ? 'PART PAID' : 'PAID / CLEARED'}
            </strong>
          </div>
        </div>

        {/* 3. Fee Breakdown Table */}
        <div className="overflow-x-auto print:overflow-visible mb-1">
          <table className="w-full text-left border border-slate-300 text-[9.5px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <th className="p-1 border-r border-slate-300 w-6 sm:w-8 text-center text-[8.5px] sm:text-[9px]">#</th>
                <th className="p-1 border-r border-slate-300 text-[8.5px] sm:text-[9px]">Fee Particulars / Head</th>
                <th className="p-1 border-r border-slate-300 w-20 sm:w-28 text-center text-[8.5px] sm:text-[9px]">Period</th>
                <th className="p-1 text-right w-20 sm:w-24 text-[8.5px] sm:text-[9px]">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {breakdownItems.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-1 border-r border-slate-300 text-center text-slate-500 text-[8.5px]">
                    {idx + 1}
                  </td>
                  <td className="p-1 border-r border-slate-300 font-medium text-slate-800 truncate max-w-[140px] sm:max-w-[200px]">
                    {item.head}
                  </td>
                  <td className="p-1 border-r border-slate-300 text-center text-slate-600 text-[8.5px] truncate max-w-[80px] sm:max-w-[100px]">
                    {periodLabel}
                  </td>
                  <td className="p-1 text-right font-semibold text-slate-900 font-mono text-[9px] sm:text-[9.5px]">
                    ₹{(Number(item.amount) || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}

              {/* Discount if applicable */}
              {discountAmount > 0 && (
                <tr className="border-b border-slate-200 text-emerald-800 bg-emerald-50/50">
                  <td className="p-1 border-r border-slate-300 text-center text-[8.5px]">-</td>
                  <td colSpan={2} className="p-1 border-r border-slate-300 font-medium">
                    Less: Scholarship / Fee Concession
                  </td>
                  <td className="p-1 text-right font-bold font-mono">
                    -₹{discountAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              )}

              {/* Fine if applicable */}
              {fineAmount > 0 && (
                <tr className="border-b border-slate-200 text-red-800 bg-red-50/50">
                  <td className="p-1 border-r border-slate-300 text-center text-[8.5px]">+</td>
                  <td colSpan={2} className="p-1 border-r border-slate-300 font-medium">
                    Add: Late Fee Surcharge
                  </td>
                  <td className="p-1 text-right font-bold font-mono">
                    +₹{fineAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              )}

              {/* Bill total, when this payment covers only part of the heads above */}
              {Math.abs(itemsTotal - discountAmount + fineAmount - paidAmount) > 0.5 && (
                <tr className="border-b border-slate-200">
                  <td colSpan={3} className="p-1 border-r border-slate-300 text-right text-[9px] text-slate-600">
                    Bill total:
                  </td>
                  <td className="p-1 text-right font-mono text-[9px] text-slate-700">
                    ₹{(itemsTotal - discountAmount + fineAmount).toLocaleString('en-IN')}
                  </td>
                </tr>
              )}

              {/* Total Row */}
              <tr className="bg-slate-100 font-bold border-t border-slate-400">
                <td colSpan={3} className="p-1 border-r border-slate-300 text-right text-[9.5px]">
                  Total Amount Deposited:
                </td>
                <td className="p-1 text-right text-[10.5px] font-black text-emerald-800 font-mono">
                  ₹{paidAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. Amount in Words & Outstanding Dues Bar */}
        <div className="flex flex-wrap items-center justify-between text-[9px] p-1.5 bg-slate-50 border border-slate-200 rounded mb-1 gap-1">
          <div className="flex-1 min-w-[200px] pr-2">
            <span className="text-slate-500 text-[8px] block">Amount in words:</span>
            <strong className="text-slate-900 italic font-semibold truncate block">
              {numberToIndianWords(paidAmount)}
            </strong>
          </div>
          <div className="text-right border-l border-slate-300 pl-2 shrink-0">
            <span className="text-slate-500 text-[8px] block font-bold">Outstanding Balance:</span>
            {balanceDue > 0 ? (
              <strong className="text-amber-800 font-black font-mono">
                ₹{balanceDue.toLocaleString('en-IN')} (Pending)
              </strong>
            ) : (
              <strong className="text-emerald-700 font-bold font-mono">
                ₹0 (Fully Settled)
              </strong>
            )}
          </div>
        </div>
      </div>

      {/* 5. Footer & Signatures */}
      <div className="flex items-end justify-between pt-1 border-t border-slate-300 text-[8px] text-slate-500 mt-auto">
        <div>
          <p className="italic leading-tight">
            * Computer generated receipt. Retain this receipt for income tax deduction & school records.
          </p>
          <p className="text-[7.5px] text-slate-400 mt-0.5">
            Collected by: {payment.collectedBy || 'Accounts Office'} • System Verified
          </p>
        </div>

        <div className="flex items-end gap-4 sm:gap-5 text-center">
          <div>
            <div className="h-4 border-b border-dashed border-slate-400 w-20 sm:w-22 mb-0.5"></div>
            <span className="font-semibold text-slate-700 block text-[7.5px]">
              Depositor Signature
            </span>
          </div>
          <div>
            <div className="h-4 border-b border-dashed border-slate-400 w-24 sm:w-26 mb-0.5"></div>
            <span className="font-bold text-slate-800 block text-[8px]">
              Authorized Signatory
            </span>
            <span className="text-[7px] text-slate-400 block">Accounts Department</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  payment,
  student,
  isOpen,
  onClose,
  settings,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [fetchedPayment, setFetchedPayment] = useState<FeePayment | null>(null);
  const [fetchedLedger, setFetchedLedger] = useState<FeeLedgerEntry | null>(null);
  const [fetchedStudent, setFetchedStudent] = useState<Student | null>(student || null);
  const [fetchedSettings, setFetchedSettings] = useState<SchoolSettings>(settings || api.getSettings());
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

  // Manage body class for @media print isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('receipt-modal-active');
    } else {
      document.body.classList.remove('receipt-modal-active');
    }
    return () => {
      document.body.classList.remove('receipt-modal-active');
    };
  }, [isOpen]);

  // Fetch authoritative MongoDB records upon opening the modal
  useEffect(() => {
    if (isOpen && payment) {
      // 1. Fetch live payment from server by receiptNumber
      if (payment.receiptNumber) {
        api.fetchFeePayments({ receiptNumber: payment.receiptNumber }).then((payments) => {
          const match = (payments || []).find((p) => p.receiptNumber === payment.receiptNumber || p.id === payment.id);
          if (match) setFetchedPayment(match);
        }).catch(() => {});
      }

      // 2. Fetch live ledger from server by receiptNumber or studentId
      api.fetchFeeLedgers({
        receiptNumber: payment.receiptNumber,
        studentId: payment.studentId,
      }).then((ledgers) => {
        const match =
          (ledgers || []).find(
            (l) =>
              (payment.receiptNumber &&
                (l.receiptNumber === payment.receiptNumber || (l as any).invoiceNumber === payment.receiptNumber)) ||
              l.id === payment.id
          ) || (ledgers && ledgers[0]);
        if (match) setFetchedLedger(match);
      }).catch(() => {});

      // 3. Fetch fresh student
      const targetStudentId = payment.studentId || (student ? student.id : null);
      if (targetStudentId) {
        api.fetchStudentDirect(targetStudentId).then((st) => {
          if (st) setFetchedStudent(st);
        }).catch(() => {});
      }

      // 4. Fetch fresh settings & pre-resolve logo
      api.syncSettings().then((s) => {
        if (s) {
          setFetchedSettings(s);
          getLogoBase64Async(s).then((b64) => {
            if (b64) setLogoBase64(b64);
          }).catch(() => {});
        }
      }).catch(() => {});

      // Pre-resolve logo for passed settings as well
      getLogoBase64Async(settings || api.getSettings()).then((b64) => {
        if (b64) setLogoBase64(b64);
      }).catch(() => {});
    }
  }, [isOpen, payment, student, settings]);

  if (!isOpen || !payment) return null;

  const effectivePayment = fetchedPayment || payment;

  // Resolve associated student
  const allStudents = api.getStudents();
  const resolvedStudent =
    fetchedStudent ||
    student ||
    allStudents.find(
      (s) => s.id === effectivePayment.studentId || s.admissionNumber === effectivePayment.admissionNumber
    ) ||
    null;

  // Resolve associated ledger
  const allLedgers = api.getFeeLedgersSync();
  const resolvedLedger =
    fetchedLedger ||
    allLedgers.find(
      (l) =>
        (effectivePayment.ledgerId && (l.id === effectivePayment.ledgerId || (l as any)._id === effectivePayment.ledgerId)) ||
        (effectivePayment.invoiceNumber && l.invoiceNumber === effectivePayment.invoiceNumber) ||
        (effectivePayment.receiptNumber &&
          (l.receiptNumber === effectivePayment.receiptNumber || (l as any).invoiceNumber === effectivePayment.receiptNumber)) ||
        (l.studentId === effectivePayment.studentId &&
          (l.feeType === effectivePayment.feeType ||
            (effectivePayment.feeType && l.feeMonth && effectivePayment.feeType.includes(l.feeMonth))))
    ) ||
    null;

  const resolvedSettings = fetchedSettings || settings || api.getSettings();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const ok = await exportReceiptToPdf({
        payment: effectivePayment,
        student: resolvedStudent,
        ledger: resolvedLedger,
        settings: resolvedSettings,
        logoBase64,
      });
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const modalContent = (
    <div
      id="receipt-modal-portal-root"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-0 sm:p-3 md:p-5 overflow-hidden print:p-0 print:bg-white print:static print:overflow-visible print:block print:h-auto print:w-full"
    >
      {/* Modal Dialog: 100dvh on mobile, max 94dvh on tablet & desktop */}
      <div
        id="receipt-modal-dialog"
        className="bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200/90 w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[100dvh] sm:h-[94dvh] max-h-[100dvh] sm:max-h-[94dvh] flex flex-col overflow-hidden relative print:border-none print:shadow-none print:max-w-none print:w-full print:m-0 print:rounded-none print:h-auto print:max-h-none print:overflow-visible"
      >
        {/* Sticky Action Header: Always visible, never cut or scrolled out */}
        <div className="sticky top-0 z-30 shrink-0 w-full bg-slate-900 text-white border-b border-slate-800 shadow-md print:hidden">
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {/* Left: Receipt Title & Status Badges */}
            <div className="min-w-0 flex items-center justify-between sm:justify-start gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight text-white truncate">
                    Fee Receipt #{effectivePayment.receiptNumber}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold whitespace-nowrap">
                    2-Copy A4 Slip
                  </span>
                  {downloadSuccess && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>PDF Saved!</span>
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5 hidden xs:block">
                  {resolvedStudent?.name ? `${resolvedStudent.name} • ` : ''}School & Student Copies on 1 A4 Portrait Sheet
                </p>
              </div>

              {/* Close Button on mobile header top row */}
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Close receipt preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Actions Row (Download PDF, Print, Close) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
              <button
                id="btn-download-pdf"
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Download single-page vector A4 PDF"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{isExportingPdf ? 'Exporting...' : 'Download PDF'}</span>
              </button>

              <button
                id="btn-print-action"
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                title="Print 1-page A4 document (School & Student Copy)"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">Print A4 Receipt (2 Copies)</span>
                <span className="md:hidden">Print Receipt</span>
              </button>

              {/* Close Button on Tablet & PC */}
              <button
                type="button"
                onClick={onClose}
                className="hidden sm:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Close receipt preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Printable Container: Independently scrolls while action bar stays pinned */}
        <div
          id="printable-fee-receipt-container"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 bg-slate-100/70 font-sans text-slate-900 flex flex-col w-full h-auto space-y-3 sm:space-y-4 box-border print:p-0 print:bg-white print:overflow-hidden print:h-[272mm] print:max-h-[272mm] print:space-y-0"
        >
          {/* COPY 1: SCHOOL COPY */}
          <ReceiptSlip
            copyType="SCHOOL COPY"
            payment={effectivePayment}
            student={resolvedStudent}
            ledger={resolvedLedger}
            settings={resolvedSettings}
            logoBase64={logoBase64}
          />

          {/* PERFORATION / CUTTING LINE */}
          <div className="relative py-1 text-center my-auto shrink-0 print:my-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dashed border-slate-400"></div>
            </div>
            <div className="relative inline-flex items-center gap-1.5 bg-white px-2.5 text-[8px] font-mono text-slate-500 uppercase tracking-widest print:text-slate-600">
              <Scissors className="w-3 h-3 text-slate-400" />
              <span>Cut Along This Line</span>
              <Scissors className="w-3 h-3 text-slate-400" />
            </div>
          </div>

          {/* COPY 2: STUDENT COPY */}
          <ReceiptSlip
            copyType="STUDENT COPY"
            payment={effectivePayment}
            student={resolvedStudent}
            ledger={resolvedLedger}
            settings={resolvedSettings}
            logoBase64={logoBase64}
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
