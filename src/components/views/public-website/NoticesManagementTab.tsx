import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Trash2,
  Edit2,
  UploadCloud,
  FileText,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Calendar,
  Search,
  Filter,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Notice } from '../../../types';
import { fileUploadService } from '../../../services/fileUploadService';

interface NoticesManagementTabProps {
  notices: Notice[];
  onSaveNotice: (notice: Partial<Notice>) => Promise<void>;
  onUpdateNotice: (id: string, updates: Partial<Notice>) => Promise<void>;
  onDeleteNotice: (id: string) => Promise<void>;
}

export const NoticesManagementTab: React.FC<NoticesManagementTabProps> = ({
  notices = [],
  onSaveNotice,
  onUpdateNotice,
  onDeleteNotice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<
    'ATTENDANCE' | 'FEE_REMINDER' | 'EXAM' | 'RESULT' | 'HOMEWORK' | 'EVENT' | 'EMERGENCY' | 'GENERAL'
  >('GENERAL');
  const [targetAudience, setTargetAudience] = useState<'ALL' | 'TEACHERS' | 'PARENTS' | 'STUDENTS'>('ALL');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [showInTicker, setShowInTicker] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentFileKey, setAttachmentFileKey] = useState('');

  const safeNotices = Array.isArray(notices) ? notices : [];
  const filteredNotices = safeNotices.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openAddModal = () => {
    setEditingNotice(null);
    setTitle('');
    setContent('');
    setCategory('GENERAL');
    setTargetAudience('ALL');
    setPriority('NORMAL');
    setIsUrgent(false);
    setShowOnHomepage(true);
    setShowInTicker(false);
    setExpiryDate('');
    setAttachmentUrl('');
    setAttachmentName('');
    setAttachmentFileKey('');
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category);
    setTargetAudience(notice.targetAudience);
    setPriority(notice.priority || (notice.isUrgent ? 'URGENT' : 'NORMAL'));
    setIsUrgent(notice.isUrgent);
    setShowOnHomepage(notice.showOnHomepage !== false);
    setShowInTicker(notice.showInTicker === true);
    setExpiryDate(notice.expiryDate || '');
    setAttachmentUrl(notice.attachmentUrl || '');
    setAttachmentName(notice.attachmentName || '');
    setAttachmentFileKey(notice.attachmentFileKey || '');
    setUploadProgress(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(15);
      const result = await fileUploadService.uploadDirectToR2(
        file,
        'public-website/notices',
        (progress) => {
          setUploadProgress(Math.min(95, Math.max(15, progress)));
        }
      );
      setAttachmentUrl(result.publicUrl);
      setAttachmentFileKey(result.fileKey);
      setAttachmentName(file.name);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Please check network connection'}`);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Title and content are required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Notice> = {
        title: title.trim(),
        content: content.trim(),
        category,
        targetAudience,
        priority,
        isUrgent: priority === 'URGENT' || isUrgent,
        showOnHomepage,
        showInTicker,
        expiryDate: expiryDate || undefined,
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
        attachmentFileKey: attachmentFileKey || undefined,
      };

      if (editingNotice) {
        await onUpdateNotice(editingNotice.id, payload);
      } else {
        await onSaveNotice({
          ...payload,
          publishedDate: new Date().toISOString().substring(0, 10),
          publishedBy: 'School Administration',
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Failed to save notice: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-600" />
            <span>Website Circulars & Urgent Notices</span>
          </h3>
          <p className="text-xs text-slate-500">
            Post circulars with PDF attachments and toggle breaking ticker visibility on the homepage.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Notice</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search circulars by keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'GENERAL', 'EVENT', 'EXAM', 'EMERGENCY', 'FEE_REMINDER'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-3">
        {filteredNotices.map((n, idx) => (
          <div
            key={n.id ? `mgmt-notice-${n.id}` : `mgmt-notice-idx-${idx}`}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-300 shadow-xs transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                  {n.category}
                </span>

                {n.isUrgent && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertTriangle className="w-3 h-3" />
                    <span>URGENT</span>
                  </span>
                )}

                {n.showInTicker && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <Radio className="w-3 h-3 text-amber-600 animate-pulse" />
                    <span>Ticker Live</span>
                  </span>
                )}

                <span className="text-[11px] text-slate-400 font-medium">
                  Published: {n.publishedDate}
                </span>
                {n.expiryDate && (
                  <span className="text-[11px] text-rose-600 font-medium">
                    Expires: {n.expiryDate}
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-slate-900 leading-snug">{n.title}</h4>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{n.content}</p>

              {n.attachmentUrl && (
                <div className="pt-1">
                  <a
                    href={n.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>{n.attachmentName || 'View Circular PDF / Attachment'}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              {/* Ticker toggle */}
              <button
                onClick={() => onUpdateNotice(n.id, { showInTicker: !n.showInTicker })}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                  n.showInTicker
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Toggle breaking ticker on homepage"
              >
                {n.showInTicker ? 'Ticker Active' : '+ Ticker'}
              </button>

              <button
                onClick={() => openEditModal(n)}
                className="p-2 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-700 transition cursor-pointer"
                title="Edit notice"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteTargetId(n.id)}
                className="p-2 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                title="Delete notice"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredNotices.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No notices found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Publish New Notice&quot; above to inform parents and students of upcoming announcements.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Notice */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingNotice ? 'Edit Notice' : 'Publish New Circular / Notice'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notice Title / Subject *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Admissions Open for Academic Session 2026-27"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="GENERAL">General Notice</option>
                    <option value="EVENT">Event / Celebration</option>
                    <option value="EXAM">Examination & Schedule</option>
                    <option value="RESULT">Result Publication</option>
                    <option value="EMERGENCY">Emergency / Alert</option>
                    <option value="FEE_REMINDER">Fee & Accounts</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white font-bold focus:outline-hidden"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="IMPORTANT">Important</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>
              </div>

              {/* Full Content */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notice Description / Circular Body *</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter full notice announcement details..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs leading-relaxed focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Auto-Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="ALL">Everyone (Public & School)</option>
                    <option value="PARENTS">Parents Only</option>
                    <option value="STUDENTS">Students Only</option>
                    <option value="TEACHERS">Faculty Only</option>
                  </select>
                </div>
              </div>

              {/* File Attachment via Cloudflare R2 */}
              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">
                    Attachment (PDF or image)
                  </label>
                  {attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentUrl('');
                        setAttachmentName('');
                        setAttachmentFileKey('');
                      }}
                      className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove File
                    </button>
                  )}
                </div>

                {attachmentUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span className="font-bold truncate flex-1">{attachmentName || attachmentUrl}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition">
                      <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload PDF / Circular</span>
                      <input
                        type="file"
                        accept=".pdf,image/*,.doc,.docx"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <span className="text-[11px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
                  </div>
                )}
                {uploadProgress !== null && (
                  <span className="text-[11px] font-bold text-rose-600 block">
                    Uploading attachment {uploadProgress}%
                  </span>
                )}
              </div>

              {/* Placement Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showOnHome"
                    checked={showOnHomepage}
                    onChange={(e) => setShowOnHomepage(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300"
                  />
                  <label htmlFor="showOnHome" className="font-bold text-slate-800 cursor-pointer">
                    Show in Homepage Notice Board
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showInTicker"
                    checked={showInTicker}
                    onChange={(e) => setShowInTicker(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300"
                  />
                  <label htmlFor="showInTicker" className="font-bold text-slate-800 cursor-pointer">
                    Show in Breaking News Ticker
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingNotice ? 'Save Changes' : 'Publish Notice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Delete Circular Notice?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              This notice will be removed from both the public website and internal communication feeds.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteNotice(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
