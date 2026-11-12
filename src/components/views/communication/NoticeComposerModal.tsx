import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Paperclip,
  Upload,
  AlertCircle,
  Send,
  Loader2,
  Trash2,
  Calendar,
  Users,
} from 'lucide-react';
import {
  Notice,
  NoticeType,
  NoticeAudience,
  NoticePriority,
  NoticeStatus,
  AcademicClass,
  Student,
} from '../../../types';
import { api } from '../../../services/api';
import { fileUploadService } from '../../../services/fileUploadService';

interface NoticeComposerModalProps {
  initialNotice?: Notice | null;
  onClose: () => void;
  onSaved: (notice: Notice) => void;
}

export const NoticeComposerModal: React.FC<NoticeComposerModalProps> = ({
  initialNotice,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(initialNotice?.id);

  const [title, setTitle] = useState(initialNotice?.title || '');
  const [content, setContent] = useState(initialNotice?.content || '');
  const [noticeType, setNoticeType] = useState<NoticeType>(
    (initialNotice?.noticeType as NoticeType) ||
      (initialNotice?.category as NoticeType) ||
      'GENERAL'
  );
  const [targetAudience, setTargetAudience] = useState<NoticeAudience>(
    initialNotice?.targetAudience || 'ALL'
  );
  const [targetClass, setTargetClass] = useState(initialNotice?.targetClass || '');
  const [targetSection, setTargetSection] = useState(initialNotice?.targetSection || '');
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>(
    initialNotice?.targetStudentIds || []
  );
  const [publishDate, setPublishDate] = useState(
    initialNotice?.publishDate ||
      initialNotice?.publishedDate ||
      new Date().toISOString().substring(0, 10)
  );
  const [expiryDate, setExpiryDate] = useState(initialNotice?.expiryDate || '');
  const [priority, setPriority] = useState<NoticePriority>(
    initialNotice?.priority || (initialNotice?.isUrgent ? 'URGENT' : 'NORMAL')
  );
  const [status, setStatus] = useState<NoticeStatus>(
    initialNotice?.status || 'PUBLISHED'
  );
  const [attachmentFileKey, setAttachmentFileKey] = useState(
    initialNotice?.attachmentFileKey || ''
  );
  const [attachmentUrl, setAttachmentUrl] = useState(
    initialNotice?.attachmentUrl || ''
  );
  const [attachmentName, setAttachmentName] = useState(
    initialNotice?.attachmentName || ''
  );

  // Instant SMS Broadcast option (only for new notices)
  const [sendSmsBroadcast, setSendSmsBroadcast] = useState(false);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [smsNote, setSmsNote] = useState<{ notice: Notice; text: string } | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const smsPossible = !isEditing && status === 'PUBLISHED' && targetAudience !== 'STAFF';

  // Available classes & students for targeting
  const [classes, setClasses] = useState<AcademicClass[]>(() => api.getClasses());
  const [students, setStudents] = useState<Student[]>(() => api.getStudents());

  useEffect(() => {
    setClasses(api.getClasses());
    setStudents(api.getStudents());
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('Attachment file size cannot exceed 25MB.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg(null);
      setUploadProgress(10);

      const res = await fileUploadService.uploadFile(
        file,
        'documents' as any,
        (p) => setUploadProgress(p.percentage)
      );

      setAttachmentFileKey(res.fileKey);
      setAttachmentUrl(res.url || res.publicUrl || '');
      setAttachmentName(res.originalFileName || file.name);
      setUploadProgress(100);
    } catch (err: any) {
      console.error('[NoticeComposer] File upload error:', err);
      setErrorMsg(err?.message || 'Failed to upload attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentFileKey('');
    setAttachmentUrl('');
    setAttachmentName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Circular title is required.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Circular text/content is required.');
      return;
    }
    if (targetAudience === 'CLASS' && !targetClass) {
      setErrorMsg('Choose the class this notice is for.');
      return;
    }
    if (targetAudience === 'INDIVIDUAL' && targetStudentIds.length === 0) {
      setErrorMsg('Choose at least one student.');
      return;
    }
    if (expiryDate && publishDate && expiryDate < publishDate) {
      setErrorMsg('The expiry date cannot be before the publish date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payload: Partial<Notice> & { sendSmsBroadcast?: boolean } = {
        title: title.trim(),
        content: content.trim(),
        noticeType,
        category: noticeType,
        targetAudience,
        targetClass: targetAudience === 'CLASS' ? targetClass : '',
        targetClassId: targetAudience === 'CLASS' ? classes.find((c) => c.name === targetClass)?.id || '' : '',
        targetSection: targetAudience === 'CLASS' ? targetSection.trim().toUpperCase() : '',
        targetStudentIds: targetAudience === 'INDIVIDUAL' ? targetStudentIds : [],
        publishDate,
        publishedDate: publishDate,
        date: publishDate,
        // An empty string clears an existing expiry date.
        expiryDate: expiryDate.trim(),
        priority,
        status,
        isUrgent: priority === 'URGENT',
        isImportant: priority === 'IMPORTANT',
        attachmentFileKey,
        attachmentUrl,
        attachmentName,
        sendSmsBroadcast: smsPossible && sendSmsBroadcast,
      };

      let result: Notice & { smsDispatch?: any };
      if (isEditing && initialNotice?.id) {
        result = await api.updateNotice(initialNotice.id, payload);
      } else {
        result = await api.createNotice(payload);
      }

      // Tell the user plainly when the SMS part did not go out.
      const sms = result.smsDispatch;
      if (payload.sendSmsBroadcast && sms) {
        const text = sms.skipped
          ? `The notice is published, but no SMS was sent: ${sms.reason}`
          : sms.failed > 0
          ? `The notice is published. SMS: ${sms.sent} sent, ${sms.failed} failed.`
          : '';
        if (text) {
          setSmsNote({ notice: result, text });
          return;
        }
      }
      onSaved(result);
      onClose();
    } catch (err: any) {
      console.error('[NoticeComposer] Submit error:', err);
      setErrorMsg(err?.message || 'Failed to save circular.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit notice' : 'New notice'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {smsNote && (
          <div className="p-5 space-y-3 text-sm">
            <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">{smsNote.text}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onSaved(smsNote.notice);
                  onClose();
                }}
                className="h-10 px-4 rounded-xl bg-blue-700 text-white font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
        {/* Form Body */}
        <form onSubmit={handleSubmit} className={`p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs ${smsNote ? 'hidden' : ''}`}>
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Sports Day schedule"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-semibold"
            />
          </div>

          {/* Row: Type + Priority + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
              >
                <option value="GENERAL">General Notice</option>
                <option value="ACADEMIC">Academic</option>
                <option value="EXAM">Examination</option>
                <option value="RESULT">Exam Results</option>
                <option value="HOLIDAY">Holiday Circular</option>
                <option value="EVENT">School Event</option>
                <option value="FEE">Fee Notice</option>
                <option value="FEE_REMINDER">Fee reminder</option>
                <option value="ADMISSION">Admission Notice</option>
                <option value="EMERGENCY">Emergency / Alert</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as NoticePriority)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
              >
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NoticeStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
              >
                <option value="PUBLISHED">Publish now</option>
                <option value="DRAFT">Save as draft</option>
              </select>
            </div>
          </div>

          {/* Row: Target Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Audience *</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as NoticeAudience)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white font-semibold text-slate-800"
              >
                <option value="ALL">Everyone</option>
                <option value="STUDENTS">Students</option>
                <option value="PARENTS">Parents</option>
                <option value="STAFF">Staff only</option>
                <option value="CLASS">One class or section</option>
                <option value="INDIVIDUAL">Selected students</option>
              </select>
            </div>

            {/* Target Class selector if CLASS */}
            {targetAudience === 'CLASS' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class *</label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="">Select Class</option>
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
                    placeholder="All or A, B..."
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Individual Student Picker if INDIVIDUAL */}
            {targetAudience === 'INDIVIDUAL' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Students ({targetStudentIds.length} selected)
                </label>
                <input
                  type="search"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search name, admission no. or class"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mb-1.5"
                />
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {students
                    .filter((st) => st.status === 'ACTIVE')
                    .filter((st) => {
                      const q = studentQuery.trim().toLowerCase();
                      return !q || `${st.name} ${st.admissionNumber || ''} ${st.className || ''} ${st.section || ''}`.toLowerCase().includes(q);
                    })
                    .slice(0, 200)
                    .map((st) => {
                      const on = targetStudentIds.includes(st.id);
                      return (
                        <label key={st.id} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setTargetStudentIds((ids) => (on ? ids.filter((x) => x !== st.id) : [...ids, st.id]))}
                          />
                          <span className="truncate">
                            {st.name} <span className="text-slate-500">· {[st.className, st.section].filter(Boolean).join(' ')}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Search to narrow the list; up to 200 matches are shown.</p>
              </div>
            )}
          </div>

          {/* Dates: Publish Date & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Publish Date *</label>
              <input
                type="date"
                required
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Expiry Date <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden bg-white"
              />
              <span className="text-[11px] text-slate-500">Hidden from students and parents after this date.</span>
            </div>
          </div>

          {/* Content Body */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notice text *</label>
            <textarea
              rows={5}
              required
              placeholder="Write the notice for students, parents or staff"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-normal leading-relaxed"
            ></textarea>
          </div>

          {/* Attachment Box (R2 Storage) */}
          <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block font-bold text-slate-700">Attachment (optional)</label>

            {attachmentFileKey || attachmentUrl ? (
              <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {attachmentName || 'Uploaded Attachment'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload file</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading… {uploadProgress}%</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              PDF, image or Word file, up to 25 MB
            </p>
          </div>

          {/* Instant SMS Broadcast Trigger (Only for new notices) */}
          {smsPossible && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
              <input
                type="checkbox"
                id="sendSmsNoticeCheck"
                checked={sendSmsBroadcast}
                onChange={(e) => setSendSmsBroadcast(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <label htmlFor="sendSmsNoticeCheck" className="text-xs font-medium text-slate-800 cursor-pointer">
                <span>Also send a short SMS to the parents of this audience</span>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isUploading}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Save changes' : status === 'DRAFT' ? 'Save draft' : 'Publish notice'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
