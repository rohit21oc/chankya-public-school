import React, { useEffect, useState } from 'react';
import { X, Printer, Calendar, FileText, CheckCircle2, AlertTriangle, Clock, GraduationCap, Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { getStoredUser } from '../../services/apiConfig';
import { FeeLedgerEntry, FeePayment, SchoolSettings, Student } from '../../types';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { numberToIndianWords } from './PrintableReceiptModal';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledger: FeeLedgerEntry | null;
  student?: Student | null;
  settings: SchoolSettings;
  payments?: FeePayment[];
  onCollectPayment?: (ledger: FeeLedgerEntry) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  isOpen,
  onClose,
  ledger: ledgerProp,
  student,
  settings,
  payments = [],
  onCollectPayment,
}) => {
  // Edit state (Super Admin only)
  const [savedLedger, setSavedLedger] = useState<FeeLedgerEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftHeads, setDraftHeads] = useState<{ head: string; amount: string }[]>([]);
  const [draftDiscount, setDraftDiscount] = useState('0');
  const [draftFine, setDraftFine] = useState('0');
  const [draftDue, setDraftDue] = useState('');
  const [draftReason, setDraftReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setSavedLedger(null);
    setEditError(null);
  }, [ledgerProp?.id, isOpen]);

  // Show the edited copy until the parent hands us a newer one
  const ledger =
    savedLedger && ledgerProp && savedLedger.id === ledgerProp.id ? savedLedger : ledgerProp;
  const canEdit = String(getStoredUser()?.role || '').toUpperCase() === 'SUPER_ADMIN';

  if (!isOpen || !ledger) return null;

  const isLateHead = (h: string) => /late fee|fine/i.test(h);
  const startEdit = () => {
    setDraftHeads(
      (ledger.breakdown && ledger.breakdown.length > 0
        ? ledger.breakdown
        : [{ head: ledger.feeType || 'Fee', amount: Number(ledger.amount) || 0 }]
      )
        .filter((b) => !isLateHead(b.head))
        .map((b) => ({ head: b.head, amount: String(b.amount ?? 0) }))
    );
    setDraftDiscount(String(Number(ledger.discount || 0)));
    setDraftFine(String(Number(ledger.fine || 0)));
    setDraftDue(ledger.dueDate || '');
    setDraftReason('');
    setEditError(null);
    setEditing(true);
  };
  const draftBase = draftHeads.reduce((t, h) => t + (Number(h.amount) || 0), 0);
  const draftTotal = Math.max(0, draftBase - (Number(draftDiscount) || 0) + (Number(draftFine) || 0));
  const saveEdit = async () => {
    setEditError(null);
    const cleaned = draftHeads.map((h) => ({ head: h.head.trim(), amount: Number(h.amount) }));
    if (cleaned.length === 0 || cleaned.some((h) => !h.head || !Number.isFinite(h.amount) || h.amount < 0)) {
      setEditError('Every fee head needs a name and an amount of 0 or more.');
      return;
    }
    if (draftReason.trim().length < 3) {
      setEditError('Please write the reason for this change.');
      return;
    }
    setSaving(true);
    const res = await api.updateFeeLedgerAsync(ledger.id, {
      breakdown: cleaned,
      discount: Number(draftDiscount) || 0,
      fine: Number(draftFine) || 0,
      dueDate: draftDue || undefined,
      reason: draftReason.trim(),
    });
    setSaving(false);
    if (!res.success || !res.ledger) {
      setEditError(res.error || 'The invoice could not be changed.');
      return;
    }
    setSavedLedger(res.ledger);
    setEditing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const relatedPayments = payments.filter(
    (p) =>
      p &&
      (p.receiptNumber === ledger.receiptNumber ||
        (p.studentId === ledger.studentId &&
          Boolean(p.feeType && p.feeType.toLowerCase().includes((ledger.feeMonth || '').toLowerCase()))))
  );

  const isOverdue =
    ledger.pendingAmount > 0 &&
    ledger.dueDate &&
    new Date(ledger.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header (No Print) */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Official Fee Invoice</h3>
              <p className="text-xs text-slate-400 font-mono">
                {ledger.invoiceNumber || ledger.id} • {ledger.feeMonth || ledger.feeType}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Invoice</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
          {/* Institution Header */}
          <div className="border-b border-slate-200 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {getSchoolLogoSrc(settings?.schoolLogo) ? (
                  <img
                    src={getSchoolLogoSrc(settings?.schoolLogo)}
                    onError={handleLogoError}
                    alt="School Logo"
                    className="w-14 h-14 object-contain rounded-lg border border-slate-100 p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-blue-900 text-amber-300 flex items-center justify-center font-bold text-xs p-1">
                    <GraduationCap className="w-6 h-6 text-amber-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight">
                    {settings.schoolName || ''}
                  </h1>
                  {settings.schoolAddress && (
                    <p className="text-xs text-slate-600 mt-0.5">{settings.schoolAddress}</p>
                  )}
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {[
                      settings.affiliationNumber ? `Affiliation No: ${settings.affiliationNumber}` : '',
                      settings.contactNumber ? `Ph: ${settings.contactNumber}` : '',
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                  Fee Invoice
                </span>
                <p className="text-xs font-mono font-bold text-slate-900 mt-1.5">
                  {ledger.invoiceNumber || `INV-${ledger.id.substring(0, 8)}`}
                </p>
                <p className="text-[11px] text-slate-500">
                  Date: {ledger.createdAt ? ledger.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10)}
                </p>
              </div>
            </div>
          </div>

          {/* Student & Session Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Student Name</p>
              <p className="font-bold text-slate-900 mt-0.5">{ledger.studentName}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Admission No</p>
              <p className="font-bold font-mono text-emerald-800 mt-0.5">{ledger.admissionNumber}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Class / Sec</p>
              <p className="font-bold text-slate-900 mt-0.5">
                {ledger.className} {ledger.section ? `- ${ledger.section}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Academic Session</p>
              <p className="font-bold text-slate-900 mt-0.5">{ledger.academicSession || '2026-2027'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Billing Period</p>
              <p className="font-medium text-slate-800 mt-0.5">{ledger.feeMonth || ledger.feeType}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due Date</p>
              <p className={`font-semibold mt-0.5 ${isOverdue ? 'text-rose-700' : 'text-slate-800'}`}>
                {ledger.dueDate || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</p>
              <div className="mt-0.5">
                {ledger.status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PAID
                  </span>
                ) : isOverdue ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> OVERDUE
                  </span>
                ) : ledger.status === 'PARTIAL' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                    <Clock className="w-3.5 h-3.5" /> PARTIAL
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                    <Clock className="w-3.5 h-3.5" /> UNPAID
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Guardian</p>
              <p className="font-medium text-slate-800 mt-0.5">
                {student?.fatherName || student?.parentName || 'Parent/Guardian'}
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>Fee Breakdown Heads</span>
              <span>Amount (₹)</span>
            </div>
            {editing ? (
              <div className="p-4 space-y-3 text-xs print:hidden">
                <div className="space-y-2">
                  {draftHeads.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={h.head}
                        onChange={(e) => setDraftHeads((d) => d.map((x, j) => (j === i ? { ...x, head: e.target.value } : x)))}
                        placeholder="Fee head"
                        className="flex-1 min-w-0 px-2.5 py-2 border border-slate-300 rounded-lg"
                      />
                      <span className="text-slate-500">₹</span>
                      <input
                        value={h.amount}
                        inputMode="decimal"
                        onChange={(e) => setDraftHeads((d) => d.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^0-9.]/g, '') } : x)))}
                        className="w-24 px-2.5 py-2 border border-slate-300 rounded-lg font-mono text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setDraftHeads((d) => d.filter((_, j) => j !== i))}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Remove this fee head"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraftHeads((d) => [...d, { head: '', amount: '0' }])}
                    className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add fee head
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="block font-semibold text-slate-600">Discount (₹)</span>
                    <input value={draftDiscount} inputMode="decimal" onChange={(e) => setDraftDiscount(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono" />
                  </label>
                  <label className="space-y-1">
                    <span className="block font-semibold text-slate-600">Late fee (₹)</span>
                    <input value={draftFine} inputMode="decimal" onChange={(e) => setDraftFine(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono" />
                  </label>
                  <label className="space-y-1">
                    <span className="block font-semibold text-slate-600">Due date</span>
                    <input type="date" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="block font-semibold text-slate-600">Reason for this change *</span>
                  <input value={draftReason} onChange={(e) => setDraftReason(e.target.value)} placeholder="e.g. Transport fee was added twice" className="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
                </label>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900">
                  <span>New total</span>
                  <span className="font-mono">₹{draftTotal.toLocaleString('en-IN')}</span>
                </div>
                {Number(ledger.paidAmount || 0) > 0 && (
                  <p className="text-slate-500">₹{Number(ledger.paidAmount).toLocaleString('en-IN')} is already collected. The new total can not be lower than that.</p>
                )}
                {editError && <p className="text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={saving} onClick={() => setEditing(false)} className="px-3.5 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="button" disabled={saving} onClick={saveEdit} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-60">
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {ledger.breakdown && ledger.breakdown.length > 0 ? (
                ledger.breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50">
                    <span className="text-slate-700 font-medium">{item.head}</span>
                    <span className="font-mono font-semibold text-slate-900">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-700 font-medium">{ledger.feeType}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{(Number(ledger.amount) || Number(ledger.total) || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {/* Adjustments */}
              {Number(ledger.discount || 0) > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-emerald-50/40 text-emerald-800">
                  <span>Concession / Discount</span>
                  <span className="font-mono font-semibold">-₹{Number(ledger.discount).toLocaleString('en-IN')}</span>
                </div>
              )}
              {Number(ledger.fine || 0) > 0 && !(ledger.breakdown || []).some((b) => isLateHead(b.head)) && (
                <div className="flex items-center justify-between px-4 py-2 bg-rose-50/40 text-rose-800">
                  <span>Late Fee / Fine</span>
                  <span className="font-mono font-semibold">+₹{Number(ledger.fine).toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* Totals */}
              <div className="bg-slate-50 px-4 py-3 flex items-center justify-between font-bold text-sm border-t border-slate-200">
                <span className="text-slate-900">Total Bill Amount</span>
                <span className="font-mono text-slate-900">
                  ₹{(Number(ledger.total) || Number(ledger.amount) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 bg-white">
                <span>Amount Paid</span>
                <span className="font-mono font-semibold text-emerald-700">
                  ₹{(Number(ledger.paidAmount) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between font-bold text-sm bg-amber-50/60 border-t border-amber-200 text-amber-950">
                <span>Remaining Balance Due</span>
                <span className="font-mono text-base text-rose-700">
                  ₹{(Number(ledger.pendingAmount) || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            )}
          </div>

          {/* Amount In Words */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-500">Amount in Words (Total Bill): </span>
            <span className="font-bold text-slate-800 italic">
              {numberToIndianWords(Number(ledger.total) || Number(ledger.amount) || 0)}
            </span>
          </div>

          {/* Payment History for this Invoice */}
          {relatedPayments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Payments Logged for this Invoice
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="p-2.5">Receipt No</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Mode</th>
                      <th className="p-2.5">Reference</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relatedPayments.map((p, idx) => (
                      <tr key={`${p.id}-${idx}`}>
                        <td className="p-2.5 font-mono font-bold text-emerald-800">{p.receiptNumber}</td>
                        <td className="p-2.5 text-slate-600">{p.paymentDate}</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{p.transactionReference || '-'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{Number(p.amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Signatures & Instructions */}
          <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-200 text-xs text-center">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300"></div>
              <p className="mt-1 font-semibold text-slate-600">Student / Parent Signature</p>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-300"></div>
              <p className="mt-1 font-semibold text-slate-600">Accounts Officer / Cashier</p>
            </div>
          </div>
        </div>

        {/* Footer (No Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {ledger.pendingAmount > 0 && onCollectPayment && (
              <button
                onClick={() => {
                  onClose();
                  onCollectPayment(ledger);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Collect Payment (₹{ledger.pendingAmount.toLocaleString('en-IN')})
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
