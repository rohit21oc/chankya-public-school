import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Users,
  MessageSquare,
  Loader2,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
} from 'lucide-react';
import { SmsTriggerType, AcademicClass, Exam } from '../../../types';
import { api } from '../../../services/api';

interface SmsQuickTriggerModalProps {
  triggerType: SmsTriggerType;
  onClose: () => void;
  onDispatched?: () => void;
  /** False when this user cannot send or SMS is not set up; the preview still works. */
  canDispatch?: boolean;
  blockedReason?: string;
}

export const SmsQuickTriggerModal: React.FC<SmsQuickTriggerModalProps> = ({
  triggerType,
  onClose,
  onDispatched,
  canDispatch = true,
  blockedReason,
}) => {
  const [classId, setClassId] = useState<string>('ALL');
  const [section, setSection] = useState<string>('ALL');
  const [examId, setExamId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');

  const [classes, setClasses] = useState<AcademicClass[]>(() => api.getClasses());
  const [exams, setExams] = useState<Exam[]>(() => api.getExams());

  // Preview state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    title: string;
    templateMessage: string;
    sampleResolvedMessage: string;
    recipientsCount: number;
    validRecipientsCount: number;
    invalidPhonesCount: number;
    alreadySentCount: number;
    recipients: any[];
  } | null>(null);

  const [previewError, setPreviewError] = useState<string | null>(null);

  // Dispatch state
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    sent: number;
    failed: number;
    duplicatesSkipped: number;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setClasses(api.getClasses());
    const exList = api.getExams();
    setExams(exList);
    if (exList.length > 0 && !examId) {
      setExamId(exList[0].id);
    }
  }, []);

  const loadPreview = async () => {
    try {
      setIsLoadingPreview(true);
      setPreviewError(null);

      const data = await api.getQuickTriggerPreview({
        triggerType,
        classId: classId !== 'ALL' ? classId : undefined,
        section: section !== 'ALL' ? section : undefined,
        examId: examId || undefined,
      });

      setPreviewData(data);
      if (!customMessage) {
        setCustomMessage(data.templateMessage);
      }
    } catch (err: any) {
      console.error('[QuickTrigger] Preview error:', err);
      setPreviewError(err?.message || 'Failed to fetch trigger preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [triggerType, classId, section, examId]);

  const handleDispatch = async () => {
    try {
      setIsDispatching(true);
      setPreviewError(null);

      const res = await api.dispatchQuickTrigger({
        triggerType,
        classId: classId !== 'ALL' ? classId : undefined,
        section: section !== 'ALL' ? section : undefined,
        examId: examId || undefined,
        customMessage: customMessage.trim() || undefined,
      });

      setDispatchResult({
        sent: res.sent,
        failed: res.failed,
        duplicatesSkipped: res.duplicatesSkipped,
      });

      if (onDispatched) {
        onDispatched();
      }
    } catch (err: any) {
      console.error('[QuickTrigger] Dispatch error:', err);
      setPreviewError(err?.message || 'Failed to dispatch trigger SMS.');
    } finally {
      setIsDispatching(false);
      setShowConfirm(false);
    }
  };

  const isExamTrigger =
    triggerType === 'EXAM_ANNOUNCEMENT' ||
    triggerType === 'ADMIT_CARD_PUBLISHED' ||
    triggerType === 'RESULT_PUBLISHED';

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
              <h3 className="text-base font-bold text-slate-900">
                {previewData?.title || 'Quick SMS Gateway Dispatch'}
              </h3>
              <p className="text-xs font-mono text-blue-800">
                {triggerType}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {dispatchResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>SMS Dispatch Batch Completed!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Successfully dispatched <strong>{dispatchResult.sent}</strong> SMS messages.
                {dispatchResult.duplicatesSkipped > 0 && (
                  <span>
                    {' '}• <strong>{dispatchResult.duplicatesSkipped}</strong> already-sent duplicate messages safely skipped.
                  </span>
                )}
                {dispatchResult.failed > 0 && (
                  <span> • {dispatchResult.failed} failed due to invalid mobile numbers.</span>
                )}
              </p>
            </div>
          )}

          {previewError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {/* Target Filters */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Recipient Targeting Parameters
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Class Filter */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="ALL">All Classes (Entire School)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam Picker for exam triggers */}
              {isExamTrigger && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Examination</label>
                  <select
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name || ex.title} ({ex.academicSession})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Counts & Validation Status Box */}
          {isLoadingPreview ? (
            <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Analyzing student database and validating mobile numbers...</span>
            </div>
          ) : previewData ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Eligible</span>
                <span className="text-base font-bold text-slate-900">{previewData.recipientsCount}</span>
              </div>
              <div className="p-3 bg-white border border-emerald-200 bg-emerald-50/30 rounded-xl">
                <span className="text-[10px] text-emerald-700 font-semibold uppercase block">Valid 10-Digit</span>
                <span className="text-base font-bold text-emerald-800">{previewData.validRecipientsCount}</span>
              </div>
              <div className="p-3 bg-white border border-amber-200 bg-amber-50/30 rounded-xl">
                <span className="text-[10px] text-amber-700 font-semibold uppercase block">Invalid / Missing</span>
                <span className="text-base font-bold text-amber-800">{previewData.invalidPhonesCount}</span>
              </div>
              <div className="p-3 bg-white border border-blue-200 bg-blue-50/30 rounded-xl">
                <span className="text-[10px] text-blue-700 font-semibold uppercase block">Already Sent Today</span>
                <span className="text-base font-bold text-blue-800">{previewData.alreadySentCount}</span>
              </div>
            </div>
          ) : null}

          {/* Idempotency Alert Warning if already sent */}
          {previewData && previewData.alreadySentCount > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <strong>Duplicate Protection:</strong> {previewData.alreadySentCount} message{previewData.alreadySentCount > 1 ? 's' : ''} already sent today will be skipped.
              </div>
            </div>
          )}

          {/* Resolved Sample Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Live Message Preview (Sample Resolved)
              </label>
              <span className="text-[10px] text-slate-400">
                Length: {previewData?.sampleResolvedMessage.length || 0} chars (
                {Math.ceil((previewData?.sampleResolvedMessage.length || 1) / 160)} SMS units)
              </span>
            </div>
            <div className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs leading-relaxed border border-slate-800 shadow-inner">
              {previewData?.sampleResolvedMessage || 'Loading resolved preview...'}
            </div>
          </div>

          {/* Custom Message Editor */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">
              Customize Template Text <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Leave blank to use institutional verified default template..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-normal"
            ></textarea>
            <p className="text-[10px] text-slate-400">
              Available dynamic tags: <code className="text-blue-700">{"{student_name}"}</code>,{' '}
              <code className="text-blue-700">{"{class_name}"}</code>, <code className="text-blue-700">{"{amount}"}</code>
            </p>
          </div>

          {/* Sample Recipients Table */}
          {previewData && previewData.recipients && previewData.recipients.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Sample Target Recipients (First {Math.min(5, previewData.recipients.length)})
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Student</th>
                      <th className="p-2">Class</th>
                      <th className="p-2">Parent / Phone</th>
                      <th className="p-2">Reason / Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.recipients.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-2 font-bold text-slate-900">{r.studentName || 'Student'}</td>
                        <td className="p-2 text-slate-600">
                          {r.className || '—'} {r.section ? `(${r.section})` : ''}
                        </td>
                        <td className="p-2 font-mono text-blue-800">
                          {r.phone ? `+91 ${r.phone}` : '—'}
                        </td>
                        <td className="p-2 text-slate-600">{r.detail || r.examName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={loadPreview}
            disabled={isLoadingPreview || isDispatching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
            <span>Refresh Preview</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isDispatching}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-colors text-xs"
            >
              Cancel
            </button>

            {!canDispatch ? (
              <span className="text-xs text-slate-600">{blockedReason || 'Sending is not available.'}</span>
            ) : !showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={
                  isDispatching ||
                  isLoadingPreview ||
                  !previewData ||
                  previewData.validRecipientsCount === 0
                }
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition-colors text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to {previewData?.validRecipientsCount || 0} parent{previewData?.validRecipientsCount === 1 ? '' : 's'}</span>
              </button>
            ) : (
              <button
                onClick={handleDispatch}
                disabled={isDispatching}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition-colors text-xs"
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Yes, send now</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
