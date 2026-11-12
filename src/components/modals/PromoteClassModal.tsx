import React, { useEffect, useMemo, useState } from 'react';
import { X, GraduationCap, ArrowRight, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AcademicClass, Student } from '../../types';
import { api } from '../../services/api';

interface PromoteClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: AcademicClass[];
  students: Student[];
  currentSession?: string;
  /** Class to open on (e.g. the class filter currently selected on the Students page). */
  initialClassId?: string;
  onPromoted: (message: string) => void;
}

type PromoteResult = Awaited<ReturnType<typeof api.promoteStudentsAsync>>;

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

function nextSession(session?: string): string {
  const m = String(session || '').match(/^(\d{4})\s*-\s*(\d{4})$/);
  return m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : session || '';
}

const byRoll = (a: Student, b: Student) =>
  (parseInt(a.rollNumber || '', 10) || 9999) - (parseInt(b.rollNumber || '', 10) || 9999) || a.name.localeCompare(b.name);

export const PromoteClassModal: React.FC<PromoteClassModalProps> = ({
  isOpen,
  onClose,
  classes,
  students,
  currentSession,
  initialClassId,
  onPromoted,
}) => {
  const sortedClasses = useMemo(
    () => [...classes].filter((c) => c.status !== 'INACTIVE').sort((a, b) => (a.numericOrder || 0) - (b.numericOrder || 0)),
    [classes]
  );

  const [fromClassId, setFromClassId] = useState<string>('');
  const [fromSection, setFromSection] = useState<string>('ALL');
  const [toClassId, setToClassId] = useState<string>('');
  const [toSection, setToSection] = useState<string>('SAME');
  const [targetSession, setTargetSession] = useState<string>(nextSession(currentSession));
  const [chargeBooks, setChargeBooks] = useState<boolean>(true);
  const [booksFee, setBooksFee] = useState<number>(0);
  const [booksTouched, setBooksTouched] = useState<boolean>(false);
  const [remark, setRemark] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PromoteResult | null>(null);

  const fromClass = sortedClasses.find((c) => c.id === fromClassId);
  const toClass = sortedClasses.find((c) => c.id === toClassId);

  const nextClassOf = (cls?: AcademicClass) =>
    cls ? sortedClasses.find((c) => (c.numericOrder || 0) > (cls.numericOrder || 0)) : undefined;

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    const start =
      sortedClasses.find((c) => c.id === initialClassId || c.name === initialClassId) || sortedClasses[0];
    setFromClassId(start?.id || '');
    setFromSection('ALL');
    setToClassId(nextClassOf(start)?.id || '');
    setToSection('SAME');
    setTargetSession(nextSession(currentSession));
    setChargeBooks(true);
    setBooksTouched(false);
    setRemark('');
    setErrorMsg(null);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const classStudents = useMemo(() => {
    if (!fromClass) return [] as Student[];
    return students
      .filter(
        (s) =>
          s.status === 'ACTIVE' &&
          (s.classId === fromClass.id || s.className === fromClass.name) &&
          (fromSection === 'ALL' || s.section === fromSection)
      )
      .sort(byRoll);
  }, [students, fromClass, fromSection]);

  // Everybody ticked by default when the class or section changes
  useEffect(() => {
    setSelectedIds(new Set(classStudents.map((s) => s.id)));
  }, [classStudents]);

  const sectionsOfFrom = useMemo(() => {
    const fromStudents = new Set(
      students.filter((s) => fromClass && (s.classId === fromClass.id || s.className === fromClass.name)).map((s) => s.section)
    );
    return Array.from(new Set([...(fromClass?.sections || []), ...Array.from(fromStudents)])).filter(Boolean).sort();
  }, [students, fromClass]);

  const sectionsOfTo = useMemo(() => {
    const list = toClass?.sections?.length ? toClass.sections : ['A', 'B', 'C', 'D'];
    return Array.from(new Set(list)).sort();
  }, [toClass]);

  // New class's books fee from Fee Management (the office can change it before promoting)
  const configBooksFee = useMemo(() => {
    if (!toClass) return 0;
    const section = toSection === 'SAME' ? sectionsOfTo[0] || 'A' : toSection;
    const cfg: any = api.getEffectiveFeeConfig(toClass.id, section, targetSession, undefined);
    return Math.max(0, Number(cfg?.booksFee ?? cfg?.booksStationeryFee ?? 0));
  }, [toClass, toSection, targetSession, sectionsOfTo]);

  useEffect(() => {
    if (!booksTouched) setBooksFee(configBooksFee);
  }, [configBooksFee, booksTouched]);

  if (!isOpen) return null;

  const selectedCount = classStudents.filter((s) => selectedIds.has(s.id)).length;
  const allSelected = selectedCount === classStudents.length && classStudents.length > 0;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fromClass) return setErrorMsg('Choose the class to promote from.');
    if (!toClass) return setErrorMsg('Choose the class to promote to.');
    if (toClass.id === fromClass.id) return setErrorMsg('The new class must be different from the current class.');
    if (!/^\d{4}-\d{4}$/.test(targetSession.trim())) return setErrorMsg('Enter the new session like 2027-2028.');
    if (selectedCount === 0) return setErrorMsg('Tick at least one student.');

    setIsSubmitting(true);
    const res = await api.promoteStudentsAsync({
      studentIds: classStudents.filter((s) => selectedIds.has(s.id)).map((s) => s.id),
      toClassId: toClass.id,
      toSection,
      targetSession: targetSession.trim(),
      remark: remark.trim() || undefined,
      chargeBooksFee: chargeBooks,
      booksFee: chargeBooks ? booksFee : undefined,
    });
    setIsSubmitting(false);
    if (!res.success) return setErrorMsg(res.error || 'Promotion failed. Please try again.');
    setResult(res);
    const n = res.promoted?.length || 0;
    let message = `${n} student${n === 1 ? '' : 's'} promoted to ${res.toClass?.name} (${res.session}).`;
    if (res.booksBills) message += ` Books & Stationery fee added for ${res.booksBills} (${inr(res.booksTotal || 0)}).`;
    if (res.skipped?.length) message += ` ${res.skipped.length} skipped.`;
    onPromoted(message);
  };

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 sm:p-5 bg-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-200 rounded-lg">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Promote Class</h3>
              <p className="text-xs text-blue-200">Move a whole class to the next class after the annual exam</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-900 text-sm">
                  {result.promoted?.length || 0} promoted to {result.toClass?.name} ({result.session})
                </p>
                <p className="text-emerald-800">
                  {result.booksBills
                    ? `Books & Stationery fee added to ${result.booksBills} ledger${result.booksBills === 1 ? '' : 's'}, ${inr(result.booksTotal || 0)} in total.`
                    : 'No Books & Stationery fee was added.'}
                </p>
              </div>
            </div>
            {!!result.skipped?.length && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Not promoted
                </p>
                <ul className="text-amber-800 list-disc pl-5">
                  {result.skipped.map((s) => (
                    <li key={s.id}>
                      {s.name}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Student</th>
                    <th className="text-left px-3 py-2 font-semibold">From → To</th>
                    <th className="text-left px-3 py-2 font-semibold">New roll</th>
                    <th className="text-right px-3 py-2 font-semibold">Books fee</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.promoted || []).map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-900 font-medium">{p.name}</td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {p.from} → {p.to}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">{p.rollNumber}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{p.booksBilled ? inr(p.booksBilled) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">{errorMsg}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">From class *</label>
                  <select
                    value={fromClassId}
                    onChange={(e) => {
                      setFromClassId(e.target.value);
                      setFromSection('ALL');
                      setToClassId(nextClassOf(sortedClasses.find((c) => c.id === e.target.value))?.id || '');
                    }}
                    className={inputCls}
                  >
                    {sortedClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section</label>
                  <select value={fromSection} onChange={(e) => setFromSection(e.target.value)} className={inputCls}>
                    <option value="ALL">All sections</option>
                    {sectionsOfFrom.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <ArrowRight className="hidden sm:block w-5 h-5 text-slate-400 mb-2.5" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">To class *</label>
                  <select value={toClassId} onChange={(e) => setToClassId(e.target.value)} className={inputCls}>
                    <option value="">Choose…</option>
                    {sortedClasses
                      .filter((c) => c.id !== fromClassId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section</label>
                  <select value={toSection} onChange={(e) => setToSection(e.target.value)} className={inputCls}>
                    <option value="SAME">Same as now</option>
                    {sectionsOfTo.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">New session *</label>
                <input
                  type="text"
                  value={targetSession}
                  onChange={(e) => setTargetSession(e.target.value)}
                  placeholder="2027-2028"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Remark (optional)</label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. Passed annual exam 2026-27"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Books & Stationery */}
            <div className={`rounded-xl border p-3 space-y-2 ${chargeBooks ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200'}`}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chargeBooks}
                  onChange={(e) => setChargeBooks(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                    Add Books & Stationery fee of {toClass?.name || 'the new class'}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Billed once for {targetSession || 'the new session'}. Students whose Books head is switched off in their fee profile are not charged.
                  </span>
                </span>
              </label>
              {chargeBooks && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <span className="text-slate-600 whitespace-nowrap">Amount per student</span>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={booksFee || ''}
                      onChange={(e) => {
                        setBooksTouched(true);
                        setBooksFee(Math.max(0, Number(e.target.value)));
                      }}
                      className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  {configBooksFee === 0 && !booksTouched && (
                    <span className="text-[11px] text-amber-700">No books fee set for this class in Fee Management.</span>
                  )}
                </div>
              )}
            </div>

            {/* Students */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  {selectedCount} of {classStudents.length} students ticked
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds(allSelected ? new Set() : new Set(classStudents.map((s) => s.id)))}
                  className="text-blue-700 font-semibold hover:underline"
                >
                  {allSelected ? 'Untick all' : 'Tick all'}
                </button>
              </div>
              {classStudents.length === 0 ? (
                <div className="px-3 py-6 text-center text-slate-500">No active students in this class.</div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {classStudents.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="w-10 text-slate-500 font-mono">{s.rollNumber || '—'}</span>
                      <span className="flex-1 text-slate-900 font-medium">{s.name}</span>
                      <span className="text-slate-500">
                        {s.className}-{s.section}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Untick students who stay in the same class. Roll numbers continue in the new class in the current roll order.
            </p>

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
                disabled={isSubmitting || selectedCount === 0 || !toClass}
                className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Promoting…'
                    : `Promote ${selectedCount} student${selectedCount === 1 ? '' : 's'}${toClass ? ` to ${toClass.name}` : ''}`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
