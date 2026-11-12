import React, { useState } from 'react';
import {
  X,
  Copy,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Layers,
  Calendar,
} from 'lucide-react';
import { AcademicClass, ClassFeeConfiguration } from '../../types';

interface CopyFeeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceConfig: Partial<ClassFeeConfiguration>;
  sourceClassName: string;
  sourceSection: string;
  sourceSession: string;
  classes: AcademicClass[];
  availableSessions: string[];
  onConfirmCopy: (target: {
    academicSession: string;
    classId: string;
    className: string;
    section: string;
    copyExams: boolean;
  }) => Promise<void>;
}

export const CopyFeeConfigModal: React.FC<CopyFeeConfigModalProps> = ({
  isOpen,
  onClose,
  sourceConfig,
  sourceClassName,
  sourceSection,
  sourceSession,
  classes,
  availableSessions,
  onConfirmCopy,
}) => {
  const [targetSession, setTargetSession] = useState(sourceSession);
  const [targetClassId, setTargetClassId] = useState(classes[0]?.id || '');
  const [targetSection, setTargetSection] = useState('ALL');
  const [copyExams, setCopyExams] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedWarning, setConfirmedWarning] = useState(false);

  if (!isOpen) return null;

  const targetClass = classes.find((c) => c.id === targetClassId);
  const targetSections = targetClass?.sections && targetClass.sections.length > 0
    ? targetClass.sections
    : ['A', 'B', 'C', 'D'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClass) return;

    setIsSubmitting(true);
    try {
      await onConfirmCopy({
        academicSession: targetSession,
        classId: targetClass.id,
        className: targetClass.name,
        section: targetSection,
        copyExams,
      });
      onClose();
    } catch (err) {
      console.error('Failed to copy fee config:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Duplicate / Copy Fee Structure</h3>
              <p className="text-[11px] text-slate-500">
                Clone fee rates from {sourceClassName} ({sourceSection === 'ALL' ? 'Class Default' : `Sec ${sourceSection}`}) to another target
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Source Info Box */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-slate-700">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Copying From (Source)</span>
              <span className="font-bold text-xs text-slate-900">
                {sourceClassName} • {sourceSection === 'ALL' ? 'All Sections' : `Section ${sourceSection}`} ({sourceSession})
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Monthly Rate</span>
              <span className="font-bold text-xs text-emerald-700">
                ₹{(Number(sourceConfig.monthlySchoolFee) || 0) + (Number(sourceConfig.monthlyTuitionFee) || 0)}/mo
              </span>
            </div>
          </div>

          {/* Target Selectors */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-900">Select Target Destination</h4>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Academic Session</label>
              <select
                value={targetSession}
                onChange={(e) => setTargetSession(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
              >
                {availableSessions.map((s) => (
                  <option key={s} value={s}>
                    Session {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Class</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Section</label>
                <select
                  value={targetSection}
                  onChange={(e) => setTargetSection(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="ALL">All Sections (Class Default)</option>
                  {targetSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={copyExams}
                onChange={(e) => setCopyExams(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-slate-700 font-medium">Also copy configured examination fee schedules</span>
            </label>
          </div>

          {/* Warning Confirmation */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Copying will overwrite the existing fee rates for <strong>{targetClass?.name} ({targetSection === 'ALL' ? 'All Sections' : `Sec ${targetSection}`})</strong> in Session {targetSession}. Historical invoices remain protected.
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1 font-bold text-amber-950">
              <input
                type="checkbox"
                required
                checked={confirmedWarning}
                onChange={(e) => setConfirmedWarning(e.target.checked)}
                className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4"
              />
              <span>I confirm and authorize overwriting the target fee structure</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!confirmedWarning || isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>{isSubmitting ? 'Duplicating...' : 'Duplicate Fee Structure'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
