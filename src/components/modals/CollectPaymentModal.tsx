import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Receipt } from 'lucide-react';
import { FeeLedgerEntry, FeePayment, Student } from '../../types';
import { api } from '../../services/api';
import { getStoredUser } from '../../services/apiConfig';
import { fileUploadService } from '../../services/fileUploadService';
import { classLabel, formatDate, inr, ledgerDue, ledgerPeriod, ledgerStatus } from '../fees/feeFormat';

interface CollectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  ledgers: FeeLedgerEntry[];
  initialSelectedLedger?: FeeLedgerEntry | null;
  initialPayFull?: boolean;
  onPaymentSuccess: (payment: FeePayment, updatedLedger?: FeeLedgerEntry) => void;
}

type Method = 'CASH' | 'ONLINE_UPI' | 'BANK_TRANSFER' | 'CHEQUE';
const ALL = 'ALL_FULL_DUE';

const METHODS: { id: Method; label: string; refLabel: string; refPlaceholder: string }[] = [
  { id: 'CASH', label: 'Cash', refLabel: '', refPlaceholder: '' },
  { id: 'ONLINE_UPI', label: 'UPI', refLabel: 'UPI transaction ID', refPlaceholder: 'e.g. 412345678901' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer', refLabel: 'UTR / reference no.', refPlaceholder: 'e.g. SBIN426123456789' },
  { id: 'CHEQUE', label: 'Cheque / DD', refLabel: 'Cheque / DD no.', refPlaceholder: 'e.g. 004512' },
];

/** The fee heads of one invoice, plus rows that make the list add up to what is due on it now. */
function billLines(l: FeeLedgerEntry): { label: string; amount: number; tone?: 'minus' | 'plus' }[] {
  const lines: { label: string; amount: number; tone?: 'minus' | 'plus' }[] = (Array.isArray(l.breakdown) ? l.breakdown : [])
    .filter((b) => b && Number(b.amount) > 0)
    .map((b) => ({ label: b.head, amount: Number(b.amount) }));
  const headsTotal = lines.reduce((s, x) => s + x.amount, 0);
  const total = Number(l.total ?? l.totalAmount ?? l.amount ?? 0);
  const discount = Number(l.discount) || 0;
  if (lines.length === 0) lines.push({ label: l.feeType || 'Fee', amount: total + discount });
  else if (headsTotal - discount !== total && total + discount - headsTotal > 0) {
    lines.push({ label: 'Other charges', amount: total + discount - headsTotal, tone: 'plus' });
  }
  if (discount > 0) lines.push({ label: 'Discount given', amount: discount, tone: 'minus' });
  const paid = Number(l.paidAmount) || 0;
  if (paid > 0) lines.push({ label: 'Paid earlier', amount: paid, tone: 'minus' });
  return lines;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  isOpen,
  onClose,
  student,
  ledgers,
  initialSelectedLedger,
  initialPayFull,
  onPaymentSuccess,
}) => {
  const pendingLedgers = useMemo(() => {
    const seen = new Set<string>();
    return ledgers
      .filter((l) => {
        if (!l?.id || ledgerDue(l) <= 0 || seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      })
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  }, [ledgers]);

  const totalOutstanding = pendingLedgers.reduce((s, l) => s + ledgerDue(l), 0);

  const pickInitial = () => {
    if (initialPayFull) return ALL;
    if (initialSelectedLedger && ledgerDue(initialSelectedLedger) > 0) return initialSelectedLedger.id;
    return pendingLedgers.length > 1 ? ALL : pendingLedgers[0]?.id || '';
  };

  const [selectedId, setSelectedId] = useState<string>(pickInitial);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<Method>('CASH');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [collectedBy, setCollectedBy] = useState<string>(() => getStoredUser()?.name || '');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(pickInitial());
    setFine(0);
    setDiscount(0);
    setAmountTouched(false);
    setMethod('CASH');
    setReference('');
    setRemarks('');
    setError(null);
    setPaymentDate(new Date().toISOString().substring(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPayFull, initialSelectedLedger?.id]);

  const isAll = selectedId === ALL;
  const selectedLedgers = isAll ? pendingLedgers : pendingLedgers.filter((l) => l.id === selectedId);
  const baseDue = selectedLedgers.reduce((s, l) => s + ledgerDue(l), 0);
  const payable = Math.max(0, baseDue + (Number(fine) || 0) - (Number(discount) || 0));
  const remaining = Math.max(0, payable - (Number(amount) || 0));
  const methodInfo = METHODS.find((m) => m.id === method)!;

  // Amount follows the payable total until the cashier types their own figure.
  useEffect(() => {
    if (!amountTouched) setAmount(payable);
  }, [payable, amountTouched]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const photoKey = student?.photo || student?.photoFileKey || (student as any)?.avatar;
  const photoUrl = photoKey ? fileUploadService.getFileUrl(photoKey) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (selectedLedgers.length === 0) return setError('Choose the bill you are collecting for.');
    if (!(Number(amount) > 0)) return setError('Enter the amount received.');
    if (Number(amount) > payable) return setError(`The amount cannot be more than ${inr(payable)}.`);
    if (method !== 'CASH' && !reference.trim()) return setError(`Enter the ${methodInfo.refLabel.toLowerCase()}.`);
    if (!paymentDate) return setError('Enter the payment date.');

    setSubmitting(true);
    setError(null);
    const common = {
      amountPaid: Number(amount),
      discount: Number(discount) || 0,
      fine: Number(fine) || 0,
      paymentMethod: method,
      transactionReference: method === 'CASH' ? 'CASH-COUNTER' : reference.trim(),
      collectedBy: collectedBy.trim() || undefined,
      remarks: remarks.trim() || undefined,
      paymentDate,
    };
    try {
      if (isAll) {
        const res = await api.payFullStudentDues(student.id, {
          ...common,
          idempotencyKey: `full-${student.id}-${Date.now()}`,
        });
        const payment = res.payment || res.receipt || res.receipts?.[0];
        if (!payment) throw new Error('The server did not return a receipt. Check Payments before trying again.');
        onPaymentSuccess(payment, res.ledgers?.[0]);
      } else {
        const ledger = selectedLedgers[0];
        const res = await api.collectFeeLedgerPayment(ledger.id, {
          ...common,
          idempotencyKey: `pay-${ledger.id}-${Date.now()}`,
        });
        if (!res.success || !res.payment) throw new Error(res.error || 'The payment was not saved.');
        onPaymentSuccess(res.payment, res.ledger);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'The payment was not saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Collect fee">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back
          </button>
          {photoUrl && !photoError ? (
            <img
              src={photoUrl}
              alt=""
              onError={() => setPhotoError(true)}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-semibold shrink-0">
              {(student.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-slate-900 truncate">Collect fee — {student.name}</h1>
            <p className="text-sm text-slate-500 truncate">
              {classLabel(student.className, student.section)} · Adm. no. {student.admissionNumber}
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs text-slate-500">Total outstanding</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{inr(totalOutstanding)}</p>
          </div>
        </div>
      </div>

      {pendingLedgers.length === 0 ? (
        <div className="max-w-xl mx-auto mt-16 px-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Nothing to collect</h2>
          <p className="mt-1 text-sm text-slate-600">{student.name} has no unpaid bills.</p>
          <button type="button" onClick={onClose} className="mt-6 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium">
            Back
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          {/* Left: what is being paid */}
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">Bills to pay</h2>
                <p className="text-sm text-slate-500">Choose one bill or clear all pending bills together.</p>
              </div>
              <div className="p-3 space-y-2" role="radiogroup" aria-label="Bills to pay">
                {pendingLedgers.length > 1 && (
                  <BillOption
                    checked={isAll}
                    onSelect={() => setSelectedId(ALL)}
                    title={`All pending bills (${pendingLedgers.length})`}
                    subtitle="Money is applied to the oldest bill first"
                    amount={totalOutstanding}
                  />
                )}
                {pendingLedgers.map((l) => {
                  const st = ledgerStatus(l);
                  return (
                    <BillOption
                      key={l.id}
                      checked={selectedId === l.id}
                      onSelect={() => setSelectedId(l.id)}
                      title={ledgerPeriod(l)}
                      subtitle={`${l.invoiceNumber || l.id}${l.dueDate ? ` · due ${formatDate(l.dueDate)}` : ''}`}
                      amount={ledgerDue(l)}
                      badge={st}
                    />
                  );
                })}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">What this payment covers</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {selectedLedgers.map((l) => (
                  <div key={l.id} className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-slate-900">{ledgerPeriod(l)}</h3>
                      <span className="text-xs text-slate-500 font-mono">{l.invoiceNumber || l.id}</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {billLines(l).map((line, i) => (
                          <tr key={i}>
                            <td className="py-1 text-slate-600">{line.label}</td>
                            <td className={`py-1 text-right tabular-nums ${line.tone === 'minus' ? 'text-emerald-700' : 'text-slate-900'}`}>
                              {line.tone === 'minus' ? '− ' : ''}
                              {inr(line.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200">
                          <td className="pt-2 font-medium text-slate-900">Due on this bill</td>
                          <td className="pt-2 text-right font-semibold text-slate-900 tabular-nums">{inr(ledgerDue(l))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: payment */}
          <section className="bg-white rounded-xl border border-slate-200 lg:sticky lg:top-24">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Payment</h2>
            </div>
            <div className="p-5 space-y-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Bills due</dt>
                  <dd className="tabular-nums text-slate-900">{inr(baseDue)}</dd>
                </div>
                {Number(fine) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Extra late fee</dt>
                    <dd className="tabular-nums text-slate-900">+ {inr(Number(fine))}</dd>
                  </div>
                )}
                {Number(discount) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Discount</dt>
                    <dd className="tabular-nums text-emerald-700">− {inr(Number(discount))}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <dt className="font-medium text-slate-900">To pay</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">{inr(payable)}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cp-fine" className={labelCls}>Extra late fee (₹)</label>
                  <input
                    id="cp-fine"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={fine || ''}
                    placeholder="0"
                    onChange={(e) => setFine(Math.max(0, Number(e.target.value) || 0))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="cp-discount" className={labelCls}>Discount (₹)</label>
                  <input
                    id="cp-discount"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={discount || ''}
                    placeholder="0"
                    onChange={(e) => setDiscount(Math.min(baseDue + (Number(fine) || 0), Math.max(0, Number(e.target.value) || 0)))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label htmlFor="cp-amount" className="text-sm font-medium text-slate-700">Amount received (₹)</label>
                  {Number(amount) !== payable && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountTouched(false);
                        setAmount(payable);
                      }}
                      className="text-sm font-medium text-emerald-700 hover:underline"
                    >
                      Full amount
                    </button>
                  )}
                </div>
                <input
                  id="cp-amount"
                  type="number"
                  min={1}
                  max={payable}
                  inputMode="numeric"
                  required
                  value={amount || ''}
                  onChange={(e) => {
                    setAmountTouched(true);
                    setAmount(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className={`${inputCls} h-12 text-lg font-semibold tabular-nums`}
                />
                <p className="mt-1.5 text-sm text-slate-600">
                  {remaining > 0 ? (
                    <>Part payment · <span className="font-medium text-amber-700">{inr(remaining)} will stay due</span></>
                  ) : (
                    'Clears the selected bill' + (isAll ? 's' : '')
                  )}
                </p>
              </div>

              <fieldset>
                <legend className={labelCls}>Payment method</legend>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={method === m.id}
                      onClick={() => setMethod(m.id)}
                      className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                        method === m.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {method !== 'CASH' && (
                <div>
                  <label htmlFor="cp-ref" className={labelCls}>{methodInfo.refLabel}</label>
                  <input
                    id="cp-ref"
                    type="text"
                    required
                    value={reference}
                    placeholder={methodInfo.refPlaceholder}
                    onChange={(e) => setReference(e.target.value)}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cp-date" className={labelCls}>Payment date</label>
                  <input
                    id="cp-date"
                    type="date"
                    required
                    max={new Date().toISOString().substring(0, 10)}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="cp-by" className={labelCls}>Received by</label>
                  <input
                    id="cp-by"
                    type="text"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cp-note" className={labelCls}>Note on receipt <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  id="cp-note"
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className={inputCls}
                />
              </div>

              {error && (
                <div role="alert" className="flex gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !(Number(amount) > 0)}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-base font-semibold"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Receipt className="w-5 h-5" aria-hidden />}
                {submitting ? 'Saving payment…' : `Receive ${inr(Number(amount) || 0)} & print receipt`}
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
};

const BillOption: React.FC<{
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  amount: number;
  badge?: { label: string; tone: 'danger' | 'warning' | 'neutral' | 'success' };
}> = ({ checked, onSelect, title, subtitle, amount, badge }) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    onClick={onSelect}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
      checked ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'
    }`}
  >
    <span
      className={`w-4 h-4 rounded-full border-2 shrink-0 ${checked ? 'border-emerald-600 bg-emerald-600 ring-2 ring-inset ring-white' : 'border-slate-300'}`}
      aria-hidden
    />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{title}</span>
        {badge && <StatusPill {...badge} />}
      </span>
      <span className="block text-xs text-slate-500 truncate">{subtitle}</span>
    </span>
    <span className="text-sm font-semibold tabular-nums text-slate-900">{inr(amount)}</span>
  </button>
);

export const StatusPill: React.FC<{ label: string; tone: 'danger' | 'warning' | 'neutral' | 'success' }> = ({ label, tone }) => {
  const cls = {
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}>{label}</span>;
};
