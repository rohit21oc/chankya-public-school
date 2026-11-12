import React, { useMemo, useState } from 'react';
import { Plus, RotateCcw, Trash2, Undo2, Info, Lock, Receipt } from 'lucide-react';
import {
  EditableFeeHead,
  FeeHeadFrequency,
  FeeHeadCategory,
  buildDefaultFeeHeads,
  facilityKindOf,
  feeProfileTotals,
  isBooksHead,
  isExamHead,
  isLateFeeHead,
  isMonthlyHead,
  newlyBillableHeads,
  normalizeFeeHeads,
} from '../../utils/feeProfileEdit';

/**
 * Edit Student → Fee structure. The same fee heads as admission step 4: switch heads on / off, change
 * a student's amount, add custom fees. Transport, hostel and mess amounts are set in their own
 * sections of this form, so they are shown here read-only. The server applies the same rules
 * (src/utils/feeProfileEdit.ts) and bills newly added one-time / yearly heads once.
 */

interface Props {
  heads: EditableFeeHead[] | null;
  savedHeads: EditableFeeHead[];
  onChange: (heads: EditableFeeHead[] | null) => void;
  /** Class fee settings for "Set up from class fee" / "Reset to class fee". */
  classConfig: any;
  facility: { transportRequired?: boolean; transportMonthlyFee?: number; hostelRequired?: boolean; hostelMonthlyFee?: number; messMonthlyFee?: number; hostelStatus?: string };
}

const HOW_OFTEN: { label: string; frequency: FeeHeadFrequency; category: FeeHeadCategory }[] = [
  { label: 'Every month', frequency: 'Monthly', category: 'MONTHLY' },
  { label: 'One time', frequency: 'One Time', category: 'ONE_TIME' },
  { label: 'Once a year', frequency: 'Yearly', category: 'YEARLY' },
  { label: 'Every 6 months', frequency: 'Half-Yearly', category: 'YEARLY' },
  { label: 'Every 3 months', frequency: 'Quarterly', category: 'YEARLY' },
];
const FREQ_LABEL: Record<string, string> = {
  Monthly: 'Monthly',
  'One Time': 'One time',
  Yearly: 'Yearly',
  'Half-Yearly': 'Half-yearly',
  Quarterly: 'Quarterly',
  'Event/Exam Based': 'At exam',
};

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** When this head is charged, in a few words. */
function whenCharged(h: EditableFeeHead): string {
  if (facilityKindOf(h.head)) return 'Monthly bill, from the facility section';
  if (isExamHead(h.head)) return 'When the Annual Exam is published';
  if (isLateFeeHead(h.head)) return 'Only when a payment is late';
  if (isBooksHead(h.head)) return 'At admission and each promotion';
  if (isMonthlyHead(h)) return 'Every monthly bill';
  return 'Billed once when added';
}

export const StudentFeeStructureEditor: React.FC<Props> = ({ heads, savedHeads, onChange, classConfig, facility }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [howOften, setHowOften] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);

  const hostelActive = !!facility.hostelRequired && facility.hostelStatus !== 'VACATED';
  // Facility heads always show what the Transport / Hostel sections say (the server keeps them in step).
  const shown = useMemo<EditableFeeHead[]>(() => {
    if (!heads) return [];
    return heads.map((h) => {
      const kind = facilityKindOf(h.head);
      if (kind === 'transport') return { ...h, selected: !!facility.transportRequired, amount: facility.transportRequired ? Number(facility.transportMonthlyFee) || h.amount : h.amount };
      if (kind === 'hostel') return { ...h, selected: hostelActive && Number(facility.hostelMonthlyFee ?? h.amount) > 0, amount: hostelActive ? Number(facility.hostelMonthlyFee) || h.amount : h.amount };
      if (kind === 'mess') {
        const amt = hostelActive && facility.messMonthlyFee !== undefined ? Math.max(0, Number(facility.messMonthlyFee) || 0) : h.amount;
        return { ...h, selected: hostelActive && amt > 0, amount: amt };
      }
      return h;
    });
  }, [heads, facility.transportRequired, facility.transportMonthlyFee, hostelActive, facility.hostelMonthlyFee, facility.messMonthlyFee]);

  // "Before": the student's saved structure, or, when they had none, the class fee settings they were
  // charged by (so the admission charges are not billed again). The server uses the same baseline.
  const baseline = useMemo(
    () => (savedHeads.length ? savedHeads : buildDefaultFeeHeads(classConfig, facility)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedHeads, classConfig]
  );
  const totals = useMemo(() => feeProfileTotals(shown), [shown]);
  const savedTotals = useMemo(() => feeProfileTotals(baseline), [baseline]);
  const toBill = useMemo(() => (heads ? newlyBillableHeads(baseline, normalizeFeeHeads(heads)) : []), [heads, baseline]);
  const dirty = !!heads && JSON.stringify(normalizeFeeHeads(heads)) !== JSON.stringify(normalizeFeeHeads(savedHeads));

  const update = (id: string, patch: Partial<EditableFeeHead>) => onChange((heads || []).map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const remove = (id: string) => onChange((heads || []).filter((h) => h.id !== id));

  const addCustom = () => {
    const n = name.replace(/\s+/g, ' ').trim();
    const a = Number(amount);
    if (!n) return setAddError('Enter the fee name.');
    if (!Number.isFinite(a) || a <= 0) return setAddError('Enter an amount above 0.');
    if ((heads || []).some((h) => h.head.trim().toLowerCase() === n.toLowerCase())) return setAddError(`"${n}" is already in the list. Change its amount there.`);
    const opt = HOW_OFTEN[howOften];
    onChange([
      ...(heads || []),
      { id: `head-custom-${Date.now()}`, head: n, category: opt.category, frequency: opt.frequency, amount: Math.round(a * 100) / 100, selected: true, isDefault: false, remarks: 'Custom fee for this student' },
    ]);
    setName('');
    setAmount('');
    setAddError(null);
  };

  const fromClass = () => buildDefaultFeeHeads(classConfig, facility);

  if (!heads) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
        <p>
          This student has no fee structure of their own yet, so the monthly bill uses the class fee settings. Set one up to change amounts or add a
          custom fee for this student.
        </p>
        <button type="button" onClick={() => onChange(fromClass())} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Set up from class fee
        </button>
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600';

  return (
    <div className="space-y-4">
      {/* Fee heads */}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {shown.map((h) => {
          const facilityHead = !!facilityKindOf(h.head);
          // Added for this student (or a class extra item): can be removed. Built-in heads are only switched off.
          const custom = h.id.startsWith('head-custom-') && !facilityHead;
          return (
            <li key={h.id} className={`p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${h.selected ? '' : 'bg-slate-50/60'}`}>
              <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-blue-600 shrink-0"
                  checked={h.selected}
                  disabled={facilityHead}
                  onChange={(e) => update(h.id, { selected: e.target.checked })}
                  aria-label={`Charge ${h.head}`}
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${h.selected ? 'text-slate-900' : 'text-slate-500 line-through decoration-slate-300'}`}>
                    {h.head}
                    <span className="ml-2 align-middle text-[11px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 no-underline">{FREQ_LABEL[h.frequency] || h.frequency}</span>
                    {custom && <span className="ml-1 align-middle text-[11px] font-medium text-blue-800 bg-blue-50 rounded px-1.5 py-0.5">Custom</span>}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {facilityHead ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Set in the {facilityKindOf(h.head) === 'transport' ? 'Transport' : 'Hostel'} section above
                      </span>
                    ) : (
                      whenCharged(h)
                    )}
                  </span>
                </span>
              </label>
              <div className="flex items-center gap-2 pl-7 sm:pl-0">
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    value={h.amount}
                    disabled={facilityHead || !h.selected}
                    onChange={(e) => update(h.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                    className={`${inputCls} pl-7 text-right tabular-nums disabled:bg-slate-100 disabled:text-slate-500`}
                    aria-label={`${h.head} amount`}
                  />
                </div>
                {custom ? (
                  <button type="button" onClick={() => remove(h.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={`Remove ${h.head}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="w-8" aria-hidden />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Add a custom fee */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <p className="text-sm font-semibold text-slate-900">Add a custom fee</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_160px_auto] gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fee name, e.g. Annual function" className={inputCls} aria-label="Custom fee name" maxLength={80} />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" min={1} placeholder="Amount" className={`${inputCls} pl-7`} aria-label="Custom fee amount" />
          </div>
          <select value={howOften} onChange={(e) => setHowOften(Number(e.target.value))} className={inputCls} aria-label="How often">
            {HOW_OFTEN.map((o, i) => (
              <option key={o.label} value={i}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={addCustom} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {addError && <p role="alert" className="text-xs text-rose-700">{addError}</p>}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['Monthly', totals.totalMonthlyFee, savedTotals.totalMonthlyFee],
            ['One time', totals.totalOneTimeFee, savedTotals.totalOneTimeFee],
            ['Yearly / other', totals.totalYearlyFee, savedTotals.totalYearlyFee],
          ] as const
        ).map(([label, now, before]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-base font-bold text-slate-900 tabular-nums">{inr(now)}</div>
            {dirty && now !== before && <div className="text-[11px] text-amber-700">was {inr(before)}</div>}
          </div>
        ))}
      </div>

      {/* What saving does */}
      {dirty && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <Info className="w-4 h-4" /> When you save
          </p>
          {totals.totalMonthlyFee !== savedTotals.totalMonthlyFee && (
            <p>
              Monthly bills from the next bill: <b>{inr(totals.totalMonthlyFee)}</b> a month (was {inr(savedTotals.totalMonthlyFee)}).
            </p>
          )}
          {toBill.length > 0 ? (
            <p className="flex items-start gap-1.5">
              <Receipt className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                A new bill of <b>{inr(toBill.reduce((a, b) => a + b.amount, 0))}</b> is created now for: {toBill.map((b) => `${b.head} (${inr(b.amount)})`).join(', ')}.
              </span>
            </p>
          ) : (
            <p>No new bill is created now.</p>
          )}
          <p className="text-xs text-blue-900/80">Bills already made are not changed. To correct one, use the Fees section.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        {dirty && (
          <button type="button" onClick={() => onChange(savedHeads.length ? savedHeads : null)} className="inline-flex items-center gap-1 text-slate-700 hover:underline">
            <Undo2 className="w-3.5 h-3.5" /> Undo fee changes
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Replace this student\'s fee heads with the class fee settings? Custom fees are removed.')) onChange(fromClass());
          }}
          className="inline-flex items-center gap-1 text-slate-600 hover:underline"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset to class fee
        </button>
      </div>
    </div>
  );
};
