import React, { useEffect, useMemo, useState } from 'react';
import { X, PlusCircle, CheckCircle2, CalendarClock, Receipt, Wallet } from 'lucide-react';
import { Student, FeeLedgerEntry } from '../../types';
import { api } from '../../services/api';
import { buildStudentMonthlyBreakdown } from '../../utils/studentMonthlyFee';
import { parseYearMonth, getMonthYearDisplay } from '../../utils/feeDateHelper';

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  /** `message` describes what was created and paid, for the confirmation banner. */
  onBillAdded: (newLedger: FeeLedgerEntry, message?: string) => void;
}

type BillKind = 'MONTHLY_FEE' | 'EXTRA';
type Method = 'CASH' | 'ONLINE_UPI' | 'BANK_TRANSFER' | 'CHEQUE';

const PRESET_FEE_TYPES = [
  'Examination Fee',
  'Uniform',
  'Books & Stationery',
  'ID Card',
  'Medical/Health',
  'Transport',
  'Hostel',
  'Mess',
  'Miscellaneous',
  'Other / Custom Fee',
];

const FREQUENCIES = [
  { value: 'ONE_TIME', label: 'One-Time Charge' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual / Session' },
  { value: 'EVENT_BASED', label: 'Event Based' },
];

const METHODS: { id: Method; label: string; refLabel: string; refPlaceholder: string }[] = [
  { id: 'CASH', label: 'Cash', refLabel: '', refPlaceholder: '' },
  { id: 'ONLINE_UPI', label: 'UPI', refLabel: 'UPI transaction ID', refPlaceholder: 'e.g. 412345678901' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer', refLabel: 'UTR / reference no.', refPlaceholder: 'e.g. SBIN426123456789' },
  { id: 'CHEQUE', label: 'Cheque / DD', refLabel: 'Cheque / DD no.', refPlaceholder: 'e.g. 004512' },
];

const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

function monthCode(label: string): number | null {
  const ym = parseYearMonth(label);
  return ym ? ym.year * 12 + ym.month : null;
}

function labelFromCode(code: number): string {
  const y = Math.floor((code - 1) / 12);
  const m = ((code - 1) % 12) + 1;
  return getMonthYearDisplay(y, m);
}

export const AddBillModal: React.FC<AddBillModalProps> = ({ isOpen, onClose, student, onBillAdded }) => {
  const enrollmentDate = student.feeStartDate || student.enrollmentDate || student.admissionDate || '';

  // Months that already have the regular monthly fee bill
  const billedMonthCodes = useMemo(() => {
    const codes = new Set<number>();
    for (const l of api.getFeeLedgersSync(student.id)) {
      if (l.studentId !== student.id || l.billKind === 'EXTRA') continue;
      const isMonthlyFeeBill = l.billKind === 'MONTHLY_FEE' || /^monthly school fee/i.test(l.feeType || '');
      if (!isMonthlyFeeBill) continue;
      const code = monthCode(l.feeMonth || l.monthYear || '');
      if (code) codes.add(code);
    }
    return codes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, isOpen]);

  // Enrollment month up to 12 months ahead of today
  const monthOptions = useMemo(() => {
    const now = parseYearMonth(todayIst())!;
    const nowCode = now.year * 12 + now.month;
    const enrollCode = monthCode(enrollmentDate) ?? nowCode;
    const options: { code: number; label: string; billed: boolean }[] = [];
    for (let c = enrollCode; c <= Math.max(nowCode, enrollCode) + 12; c++) {
      options.push({ code: c, label: labelFromCode(c), billed: billedMonthCodes.has(c) });
    }
    return options;
  }, [enrollmentDate, billedMonthCodes]);

  // Default: the first month from now on that has no bill yet (the next month to pay in advance)
  const defaultMonth = useMemo(() => {
    const now = parseYearMonth(todayIst())!;
    const nowCode = now.year * 12 + now.month;
    const next = monthOptions.find((o) => o.code >= nowCode && !o.billed) || monthOptions.find((o) => !o.billed) || monthOptions[0];
    return next?.label || '';
  }, [monthOptions]);

  const [billKind, setBillKind] = useState<BillKind>('MONTHLY_FEE');
  const [startMonth, setStartMonth] = useState<string>(defaultMonth);
  const [monthCount, setMonthCount] = useState<number>(1);

  const [feeType, setFeeType] = useState<string>(PRESET_FEE_TYPES[0]);
  const [customFeeType, setCustomFeeType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10));
  const [frequency, setFrequency] = useState<string>('ONE_TIME');
  const [applicableMonth, setApplicableMonth] = useState<string>(
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );
  const [remarks, setRemarks] = useState<string>('');

  const [receiveNow, setReceiveNow] = useState<boolean>(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [receivedAmountTouched, setReceivedAmountTouched] = useState<boolean>(false);
  const [method, setMethod] = useState<Method>('CASH');
  const [reference, setReference] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(todayIst());

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setStartMonth(defaultMonth);
  }, [isOpen, defaultMonth]);

  // Start each opening clean
  useEffect(() => {
    if (!isOpen) return;
    setMonthCount(1);
    setReceiveNow(false);
    setReceivedAmountTouched(false);
    setReference('');
    setPaymentDate(todayIst());
    setErrorMsg(null);
  }, [isOpen]);

  const monthlyLines = useMemo(() => {
    const cfg = api.getEffectiveFeeConfig(student.classId, student.section, student.academicSession, student.category);
    return buildStudentMonthlyBreakdown(student, cfg, api.getTransportSlabsSync());
  }, [student]);
  const monthlyTotal = monthlyLines.reduce((sum, l) => sum + l.amount, 0);

  const selectedMonths = useMemo(() => {
    const start = monthCode(startMonth);
    if (!start) return [] as { label: string; billed: boolean }[];
    return Array.from({ length: monthCount }, (_, i) => {
      const code = start + i;
      return { label: labelFromCode(code), billed: billedMonthCodes.has(code) };
    });
  }, [startMonth, monthCount, billedMonthCodes]);
  const newMonths = selectedMonths.filter((m) => !m.billed);

  const billTotal = billKind === 'MONTHLY_FEE' ? monthlyTotal * newMonths.length : Number(amount) || 0;

  // Keep "amount received" equal to the bill total until the user types their own figure
  useEffect(() => {
    if (!receivedAmountTouched) setReceivedAmount(billTotal);
  }, [billTotal, receivedAmountTouched]);

  if (!isOpen) return null;

  const methodInfo = METHODS.find((m) => m.id === method)!;

  const handleFeeTypeChange = (selected: string) => {
    setFeeType(selected);
    setDescription('');
    if (selected === 'Examination Fee') setAmount(1500);
    else if (selected === 'Uniform') setAmount(2800);
    else if (selected === 'Books & Stationery') setAmount(3400);
    else if (selected === 'ID Card') setAmount(250);
    else if (selected === 'Medical/Health') setAmount(500);
    else if (selected === 'Transport') setAmount(student.transportMonthlyFee || 1800);
    else if (selected === 'Hostel') setAmount(student.hostelMonthlyFee || 6000);
    else if (selected === 'Mess') setAmount(student.messMonthlyFee || 3200);
    else if (selected === 'Miscellaneous') setAmount(800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payNow = receiveNow ? Math.round(Number(receivedAmount) || 0) : 0;
    if (receiveNow) {
      if (payNow <= 0) return setErrorMsg('Enter the amount received, or untick "Payment received now".');
      if (payNow > billTotal) return setErrorMsg(`Amount received (${inr(payNow)}) is more than the bill total (${inr(billTotal)}).`);
      if (method !== 'CASH' && !reference.trim()) return setErrorMsg(`Enter the ${methodInfo.refLabel.toLowerCase()}.`);
    }
    const advancePayment = payNow > 0
      ? {
          amount: payNow,
          paymentMethod: method,
          transactionReference: method === 'CASH' ? 'CASH-COUNTER' : reference.trim(),
          paymentDate,
          remarks: remarks.trim() || undefined,
        }
      : undefined;

    let payload: Parameters<typeof api.addFeeLedgerBill>[0];
    if (billKind === 'MONTHLY_FEE') {
      if (!startMonth) return setErrorMsg('Choose the month.');
      if (monthlyTotal <= 0) return setErrorMsg('This student has no monthly fee heads switched on. Update the fee profile first.');
      if (newMonths.length === 0) return setErrorMsg(`The monthly fee bill for ${selectedMonths.map((m) => m.label).join(', ')} already exists. Collect payment on that bill instead.`);
      payload = {
        studentId: student.id,
        billKind: 'MONTHLY_FEE',
        applicableMonth: startMonth,
        months: monthCount,
        remarks: remarks.trim(),
        academicSession: student.academicSession,
        advancePayment,
      };
    } else {
      const effectiveFeeType = feeType === 'Other / Custom Fee' ? customFeeType.trim() : feeType;
      if (!effectiveFeeType) return setErrorMsg('Please enter a valid Fee Type');
      if (amount <= 0) return setErrorMsg('Amount must be greater than zero');
      payload = {
        studentId: student.id,
        billKind: 'EXTRA',
        feeType: effectiveFeeType,
        description: description.trim() || effectiveFeeType,
        amount: Number(amount),
        dueDate,
        frequency,
        applicableMonth,
        remarks: remarks.trim(),
        academicSession: student.academicSession,
        advancePayment,
      };
    }

    setIsSubmitting(true);
    try {
      const res = await api.addFeeLedgerBill(payload);
      if (res.success && res.ledger) {
        const bills = res.ledgers || [res.ledger];
        const paid = (res.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const what =
          billKind === 'MONTHLY_FEE'
            ? `Monthly fee bill for ${bills.map((b) => b.feeMonth).join(', ')}`
            : `Bill "${res.ledger.feeType}"`;
        const total = bills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
        let message = `${what} (${inr(total)}) added to ${student.name}'s ledger.`;
        if (paid > 0) {
          const receipts = (res.payments || []).map((p) => p.receiptNumber).join(', ');
          message += ` ${inr(paid)} received${receipts ? ` (receipt ${receipts})` : ''}.`;
        }
        if (res.skippedMonths && res.skippedMonths.length > 0) {
          message += ` Skipped ${res.skippedMonths.join(', ')}: already billed.`;
        }
        onBillAdded(res.ledger, message);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to save bill. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while creating the bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
      active ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Add New Bill to Student Ledger</h3>
              <p className="text-xs text-indigo-200">
                {student.name} • {student.admissionNumber} ({student.className})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-900 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">{errorMsg}</div>
          )}

          {/* Bill type */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button type="button" className={tabClass(billKind === 'MONTHLY_FEE')} onClick={() => setBillKind('MONTHLY_FEE')}>
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Monthly fee (advance)</span>
            </button>
            <button type="button" className={tabClass(billKind === 'EXTRA')} onClick={() => setBillKind('EXTRA')}>
              <Receipt className="w-3.5 h-3.5" />
              <span>Extra charge</span>
            </button>
          </div>

          {billKind === 'MONTHLY_FEE' ? (
            <>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Makes the regular monthly fee bill for a month now, e.g. when the parent pays next month's fee in advance.
                The automatic bill on the 1st will not add that month again.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">From month *</label>
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {monthOptions.map((o) => (
                      <option key={o.code} value={o.label}>
                        {o.label}
                        {o.billed ? ' (already billed)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Months</label>
                  <select
                    value={monthCount}
                    onChange={(e) => setMonthCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'month' : 'months'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">Monthly fee for this student</div>
                {monthlyLines.length === 0 ? (
                  <div className="px-3 py-3 text-amber-700 bg-amber-50">No monthly fee heads are switched on in this student's fee profile.</div>
                ) : (
                  <table className="w-full">
                    <tbody>
                      {monthlyLines.map((l) => (
                        <tr key={l.head} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-1.5 text-slate-700">{l.head}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-900">{inr(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="px-3 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                  <span className="text-indigo-900 font-semibold">
                    {inr(monthlyTotal)} × {newMonths.length} {newMonths.length === 1 ? 'month' : 'months'}
                    {newMonths.length > 0 && (
                      <span className="font-normal text-indigo-700"> ({newMonths.map((m) => m.label).join(', ')})</span>
                    )}
                  </span>
                  <strong className="text-indigo-950 font-mono text-sm">{inr(billTotal)}</strong>
                </div>
              </div>
              {selectedMonths.some((m) => m.billed) && (
                <p className="text-[11px] text-amber-700">
                  Already billed, will be skipped: {selectedMonths.filter((m) => m.billed).map((m) => m.label).join(', ')}.
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fee Category / Head *</label>
                <select
                  value={feeType}
                  onChange={(e) => handleFeeTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {PRESET_FEE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {feeType === 'Other / Custom Fee' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Custom Fee Head Name *</label>
                  <input
                    type="text"
                    value={customFeeType}
                    onChange={(e) => setCustomFeeType(e.target.value)}
                    placeholder="e.g. Science Olympiad Fee, Karate Training, etc."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Item Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Term 1 Assessment & Lab Practical Fee"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Amount (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={amount || ''}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Billing Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Applicable Period / Event</label>
                  <input
                    type="text"
                    value={applicableMonth}
                    onChange={(e) => setApplicableMonth(e.target.value)}
                    placeholder="e.g. October 2026, Term 1, Annual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </>
          )}

          {/* Payment received now */}
          <div className={`rounded-xl border ${receiveNow ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'} p-3 space-y-3`}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={receiveNow}
                onChange={(e) => setReceiveNow(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600"
              />
              <span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                  Payment received now (advance)
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Records the money against this bill and makes a receipt straight away.
                </span>
              </span>
            </label>

            {receiveNow && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Amount received (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={receivedAmount || ''}
                      onChange={(e) => {
                        setReceivedAmountTouched(true);
                        setReceivedAmount(Math.max(0, Number(e.target.value)));
                      }}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">Bill total {inr(billTotal)}. Less = part payment.</span>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Payment date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    max={todayIst()}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Paid by</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as Method)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                {method !== 'CASH' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">{methodInfo.refLabel} *</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={methodInfo.refPlaceholder}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Optional Remarks / Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any administrative note or approval reference..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px]">This bill is saved to the student's fee ledger straight away.</span>
          </div>

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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-400 text-white font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Saving Bill...</span>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {receiveNow && receivedAmount > 0
                      ? `Create bill & record ${inr(receivedAmount)}`
                      : `Create & Post Bill (${inr(billTotal)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
