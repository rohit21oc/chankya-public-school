import React from 'react';
import {
  X,
  Calendar,
  Users,
  Paperclip,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Notice } from '../../../types';
import { getFileContentUrl } from '../../../services/apiConfig';

interface NoticeDetailsModalProps {
  notice: Notice | null;
  onClose: () => void;
  onEdit?: (notice: Notice) => void;
  canEdit?: boolean;
}

export const NoticeDetailsModal: React.FC<NoticeDetailsModalProps> = ({
  notice,
  onClose,
  onEdit,
  canEdit,
}) => {
  if (!notice) return null;

  const attachmentKey = notice.attachmentFileKey || notice.attachmentUrl;
  const attachmentUrl = attachmentKey ? getFileContentUrl(attachmentKey) : '';
  const attachmentName = notice.attachmentName || 'Official Attachment';

  const getPriorityBadge = () => {
    if (notice.priority === 'URGENT' || notice.isUrgent) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>URGENT PRIORITY</span>
        </span>
      );
    }
    if (notice.priority === 'IMPORTANT' || notice.isImportant) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <span>IMPORTANT</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
        Normal Priority
      </span>
    );
  };

  const getStatusBadge = () => {
    const st = notice.status || 'PUBLISHED';
    if (st === 'DRAFT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
          <Clock className="w-3 h-3" />
          <span>DRAFT</span>
        </span>
      );
    }
    if (st === 'EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
          <span>EXPIRED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        <span>PUBLISHED</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {notice.noticeType || notice.category || 'CIRCULAR'}
            </span>
            {getStatusBadge()}
            {getPriorityBadge()}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {notice.title}
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Published: <strong>{notice.publishDate || notice.publishedDate || notice.date}</strong>
                </span>
              </span>
              {notice.expiryDate && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Expires: <strong>{notice.expiryDate}</strong>
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Authority: <strong>{notice.publishedBy || notice.author || 'Administration'}</strong>
                </span>
              </span>
            </div>
          </div>

          {/* Target Audience Metadata Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Users className="w-4 h-4 text-blue-700" />
              <span>Target Audience: {notice.targetAudience}</span>
            </div>
            {notice.targetClass && (
              <p className="text-slate-600">
                Class: <strong className="text-slate-800">{notice.targetClass}</strong>
                {notice.targetSection ? ` (Section ${notice.targetSection})` : ''}
              </p>
            )}
            {notice.targetStudentIds && notice.targetStudentIds.length > 0 && (
              <p className="text-slate-600">
                Targeted individual students:{' '}
                <strong className="text-slate-800">{notice.targetStudentIds.length} students selected</strong>
              </p>
            )}
          </div>

          {/* Full Notice Content */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Circular Description & Body
            </h4>
            <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed select-text">
              {notice.content}
            </div>
          </div>

          {/* Attachment Box if available */}
          {attachmentUrl && (
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {attachmentName}
                  </div>
                </div>
              </div>

              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>View / Download</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-400">
            ID: <span className="font-mono text-slate-500">{notice.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(notice);
                }}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors"
              >
                Edit Notice
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
