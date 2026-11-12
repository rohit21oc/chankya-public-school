import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

interface AdmissionConfirmModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  studentName: string;
  className: string;
  section: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const AdmissionConfirmModal: React.FC<AdmissionConfirmModalProps> = ({
  isOpen,
  isSubmitting,
  studentName,
  className,
  section,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Confirm Student Admission</h3>
              <p className="text-[11px] text-slate-500">Official Institutional Enrolment</p>
            </div>
          </div>
          {!isSubmitting && (
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Please verify that all student and parent information is correct. Once submitted, the student admission
              will be saved and the admission and roll numbers will be assigned.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Candidate Name:</span>
              <strong className="text-slate-900 font-bold">{studentName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Class & Section:</span>
              <strong className="text-blue-700 font-bold">{className} (Section {section})</strong>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200/70 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving & Registering Student...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Submit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
