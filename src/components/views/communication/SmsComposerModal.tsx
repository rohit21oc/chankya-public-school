import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  Phone,
} from 'lucide-react';
import { AcademicClass, Student } from '../../../types';
import { api } from '../../../services/api';

interface SmsComposerModalProps {
  onClose: () => void;
  onSent?: () => void;
}

type TargetingMode = 'ALL_PARENTS' | 'CLASS' | 'SELECTED_STUDENTS' | 'INDIVIDUAL';

export const SmsComposerModal: React.FC<SmsComposerModalProps> = ({
  onClose,
  onSent,
}) => {
  const [targetingMode, setTargetingMode] = useState<TargetingMode>('ALL_PARENTS');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [individualPhone, setIndividualPhone] = useState<string>('');
  const [individualName, setIndividualName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [searchStudent, setSearchStudent] = useState<string>('');

  const [classes, setClasses] = useState<AcademicClass[]>(() => api.getClasses());
  const [students, setStudents] = useState<Student[]>(() => api.getStudents());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    sent: number;
    failed: number;
    duplicatesSkipped: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setClasses(api.getClasses());
    setStudents(api.getStudents());
  }, []);

  // Compute recipient list based on targeting mode
  const recipients = React.useMemo(() => {
    const list: {
      phone: string;
      name: string;
      studentId?: string;
      studentName?: string;
      admissionNumber?: string;
      className?: string;
      section?: string;
    }[] = [];

    const normalize = (p?: string) => {
      if (!p) return '';
      const clean = p.replace(/\D/g, '');
      if (clean.length === 12 && clean.startsWith('91')) return clean.slice(2);
      if (clean.length === 11 && clean.startsWith('0')) return clean.slice(1);
      return clean.slice(-10);
    };

    if (targetingMode === 'ALL_PARENTS') {
      const seen = new Set<string>();
      students.filter((s) => s.status === 'ACTIVE').forEach((s) => {
        const p = normalize(s.fatherMobile || s.parentPhone || s.mobile);
        if (p && /^[6-9]\d{9}$/.test(p) && !seen.has(p)) {
          seen.add(p);
          list.push({
            phone: p,
            name: s.parentName || s.fatherName || 'Parent',
            studentId: s.id,
            studentName: s.name,
            admissionNumber: s.admissionNumber,
            className: s.className,
            section: s.section,
          });
        }
      });
    } else if (targetingMode === 'CLASS') {
      const seen = new Set<string>();
      students
        .filter((s) => {
          if (s.status !== 'ACTIVE') return false;
          if (selectedClass && s.className !== selectedClass) return false;
          if (selectedSection && s.section !== selectedSection) return false;
          return true;
        })
        .forEach((s) => {
          const p = normalize(s.fatherMobile || s.parentPhone || s.mobile);
          if (p && /^[6-9]\d{9}$/.test(p) && !seen.has(p)) {
            seen.add(p);
            list.push({
              phone: p,
              name: s.parentName || s.fatherName || 'Parent',
              studentId: s.id,
              studentName: s.name,
              admissionNumber: s.admissionNumber,
              className: s.className,
              section: s.section,
            });
          }
        });
    } else if (targetingMode === 'SELECTED_STUDENTS') {
      const seen = new Set<string>();
      const studentMap = new Map<string, Student>(students.map((s) => [s.id, s]));
      selectedStudentIds.forEach((id) => {
        const s = studentMap.get(id);
        if (s) {
          const p = normalize(s.fatherMobile || s.parentPhone || s.mobile);
          if (p && /^[6-9]\d{9}$/.test(p) && !seen.has(p)) {
            seen.add(p);
            list.push({
              phone: p,
              name: s.parentName || s.fatherName || 'Parent',
              studentId: s.id,
              studentName: s.name,
              admissionNumber: s.admissionNumber,
              className: s.className,
              section: s.section,
            });
          }
        }
      });
    } else if (targetingMode === 'INDIVIDUAL') {
      const p = normalize(individualPhone);
      if (p && /^[6-9]\d{9}$/.test(p)) {
        list.push({
          phone: p,
          name: individualName.trim() || 'Parent',
        });
      }
    }

    return list;
  }, [targetingMode, selectedClass, selectedSection, selectedStudentIds, individualPhone, individualName, students]);

  const charCount = message.length;
  const smsUnits = charCount > 0 ? Math.ceil(charCount / 160) : 0;

  const handleSend = async () => {
    if (!message.trim()) {
      setErrorMsg('SMS message text cannot be empty.');
      return;
    }
    if (recipients.length === 0) {
      setErrorMsg('No valid 10-digit mobile recipients found for the selected targeting.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await api.sendCustomSms({
        recipients,
        message: message.trim(),
        triggerType: 'CUSTOM',
      });

      setResultSummary({
        sent: res.sent,
        failed: res.failed,
        duplicatesSkipped: res.duplicatesSkipped,
      });

      if (onSent) {
        onSent();
      }
    } catch (err: any) {
      console.error('[SmsComposer] Send error:', err);
      setErrorMsg(err?.message || 'Failed to dispatch SMS.');
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  const filteredStudents = students
    .filter((s) => s.status === 'ACTIVE')
    .filter((s) => {
      if (!searchStudent.trim()) return true;
      const q = searchStudent.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.admissionNumber || '').toLowerCase().includes(q) ||
        (s.className || '').toLowerCase().includes(q)
      );
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-700 text-white rounded-lg shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Custom SMS Composer</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {resultSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Custom SMS Dispatch Completed!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Successfully dispatched <strong>{resultSummary.sent}</strong> SMS messages.
                {resultSummary.duplicatesSkipped > 0 && (
                  <span> • {resultSummary.duplicatesSkipped} duplicates skipped.</span>
                )}
                {resultSummary.failed > 0 && <span> • {resultSummary.failed} failed.</span>}
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Targeting Mode Selector */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Recipient Targeting Mode *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setTargetingMode('ALL_PARENTS')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                  targetingMode === 'ALL_PARENTS'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Parents
              </button>
              <button
                type="button"
                onClick={() => setTargetingMode('CLASS')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                  targetingMode === 'CLASS'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Class / Section
              </button>
              <button
                type="button"
                onClick={() => setTargetingMode('SELECTED_STUDENTS')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                  targetingMode === 'SELECTED_STUDENTS'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Select Students
              </button>
              <button
                type="button"
                onClick={() => setTargetingMode('INDIVIDUAL')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                  targetingMode === 'INDIVIDUAL'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Manual Number
              </button>
            </div>
          </div>

          {/* Conditional Options based on Targeting Mode */}
          {targetingMode === 'CLASS' && (
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Class *</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Section</label>
                <input
                  type="text"
                  placeholder="e.g. A, B or leave blank"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                />
              </div>
            </div>
          )}

          {targetingMode === 'SELECTED_STUDENTS' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">
                  Select Students ({selectedStudentIds.length} chosen)
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-[10px] text-rose-600 hover:underline"
                >
                  Clear Selection
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter student by name, admission no, or class..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                />
              </div>

              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                {filteredStudents.slice(0, 50).map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds([...selectedStudentIds, st.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter((id) => id !== st.id));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-blue-600"
                        />
                        <span className="font-semibold text-slate-800">{st.name}</span>
                        <span className="text-[11px] text-slate-400">({st.admissionNumber})</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">{st.className}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {targetingMode === 'INDIVIDUAL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  10-Digit Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    maxLength={10}
                    value={individualPhone}
                    onChange={(e) => setIndividualPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar (Parent)"
                  value={individualName}
                  onChange={(e) => setIndividualName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                />
              </div>
            </div>
          )}

          {/* Recipient Count Summary */}
          <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" />
              <span className="font-bold text-slate-800">
                Verified Recipients: <span className="text-blue-800">{recipients.length} phone numbers</span>
              </span>
            </div>
            <span className="text-[11px] text-blue-700 font-semibold">
              Estimated Units: {recipients.length * Math.max(1, smsUnits)} SMS
            </span>
          </div>

          {/* Message Text Area */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                SMS Text Message *
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {charCount} chars • {smsUnits} SMS unit{smsUnits > 1 ? 's' : ''} (160 chars/SMS)
              </span>
            </div>
            <textarea
              rows={4}
              required
              placeholder="Type message to send... (e.g. CHANAKYA PUBLIC SCHOOL & COACHING CENTRE: Dear Parent...)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-normal leading-relaxed"
            ></textarea>
            <p className="text-[10px] text-slate-400">
              Sender ID: <strong className="font-mono text-slate-600">CPSKSH</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-colors text-xs"
          >
            Cancel
          </button>

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => {
                if (!message.trim()) {
                  setErrorMsg('Please enter an SMS message.');
                  return;
                }
                if (recipients.length === 0) {
                  setErrorMsg('No valid recipient numbers available.');
                  return;
                }
                setShowConfirm(true);
              }}
              disabled={isSubmitting || recipients.length === 0 || !message.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition-colors text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Confirm & Send SMS ({recipients.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition-colors text-xs animate-pulse"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending SMS...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Yes, Dispatch Now!</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
