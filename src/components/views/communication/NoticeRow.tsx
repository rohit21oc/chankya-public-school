import React from 'react';
import { Edit3, Paperclip, Pin, Trash2 } from 'lucide-react';
import { Notice } from '../../../types';
import { audienceLabel, categoryLabel, formatDay, previewText } from '../../../utils/communicationAccess';

interface NoticeRowProps {
  notice: Notice;
  canManage: boolean;
  onView: (notice: Notice) => void;
  onEdit?: (notice: Notice) => void;
  onDelete?: (notice: Notice) => void;
  onPublish?: (notice: Notice) => void;
  onUnpublish?: (notice: Notice) => void;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Published', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  EXPIRED: { label: 'Expired', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
};

/** One notice in the list: status, title, a one-line preview and the actions this user may take. */
export const NoticeRow: React.FC<NoticeRowProps> = ({ notice, canManage, onView, onEdit, onDelete, onPublish, onUnpublish }) => {
  const st = STATUS[notice.status || 'PUBLISHED'] || STATUS.PUBLISHED;
  const priority = String(notice.priority || (notice.isUrgent ? 'URGENT' : 'NORMAL')).toUpperCase();
  const hasAttachment = Boolean(notice.attachmentUrl || notice.attachmentFileKey);
  const date = notice.publishDate || notice.publishedDate || notice.date;
  const meta = [categoryLabel(notice.noticeType || notice.category), audienceLabel(notice), formatDay(date), notice.publishedBy || notice.author]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
      <button type="button" onClick={() => onView(notice)} className="flex-1 min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${st.cls}`}>{st.label}</span>
          {priority === 'URGENT' && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">Urgent</span>}
          {priority === 'IMPORTANT' && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200">Important</span>}
          {notice.isPinned && <Pin className="w-3.5 h-3.5 text-slate-500" aria-label="Pinned" />}
          {hasAttachment && <Paperclip className="w-3.5 h-3.5 text-slate-500" aria-label="Has attachment" />}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-900 truncate">{notice.title}</p>
        <p className="text-sm text-slate-600 line-clamp-1">{previewText(notice.content)}</p>
        <p className="mt-0.5 text-xs text-slate-500 truncate">
          {meta}
          {notice.expiryDate ? ` · ${notice.status === 'EXPIRED' ? 'Expired' : 'Until'} ${formatDay(notice.expiryDate)}` : ''}
        </p>
      </button>

      {canManage && (
        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
          {notice.status === 'DRAFT' && onPublish && (
            <button onClick={() => onPublish(notice)} className="h-9 px-3 rounded-xl text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100">
              Publish
            </button>
          )}
          {notice.status === 'PUBLISHED' && onUnpublish && (
            <button onClick={() => onUnpublish(notice)} className="h-9 px-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100">
              Unpublish
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(notice)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label={notice.status === 'EXPIRED' ? `Edit or extend ${notice.title}` : `Edit ${notice.title}`}
              title={notice.status === 'EXPIRED' ? 'Edit (change the expiry date to show it again)' : 'Edit'}
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(notice)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50"
              aria-label={`Delete ${notice.title}`}
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
};
