import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  Calendar,
  FileText,
  ChevronRight,
  ExternalLink,
  X,
  AlertCircle,
  Pin,
  Paperclip,
  Download,
  ArrowRight,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { Notice } from '../../types';
import { api } from '../../services/api';
import { getFileContentUrl } from '../../services/apiConfig';
import { navigate } from '../../services/routerService';

interface PublicNoticeBoardProps {
  notices?: Notice[];
  onViewAllNotices?: () => void;
  isLoading?: boolean;
}

export const PublicNoticeBoard: React.FC<PublicNoticeBoardProps> = ({
  notices: initialNotices,
  onViewAllNotices,
  isLoading: initialLoading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const [internalNotices, setInternalNotices] = useState<Notice[]>(() => {
    return Array.isArray(initialNotices) && initialNotices.length > 0
      ? initialNotices
      : api.getNotices();
  });
  const [isLoading, setIsLoading] = useState<boolean>(initialLoading || false);

  // Sync with prop changes if provided
  useEffect(() => {
    if (Array.isArray(initialNotices) && initialNotices.length > 0) {
      setInternalNotices(initialNotices);
    }
  }, [initialNotices]);

  // Dynamic fetch from MongoDB Atlas if notices list is empty
  useEffect(() => {
    let isMounted = true;
    if (!initialNotices || initialNotices.length === 0) {
      setIsLoading(true);
      api
        .syncNotices()
        .then((data) => {
          if (isMounted && Array.isArray(data)) {
            setInternalNotices(data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    const handleUpdate = () => {
      if (isMounted) {
        setInternalNotices(api.getNotices());
      }
    };
    window.addEventListener('pradnya_entity_notices', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('pradnya_entity_notices', handleUpdate);
    };
  }, [initialNotices]);

  const categories = ['ALL', 'ACADEMIC', 'EXAMINATION', 'EVENT', 'GENERAL'];

  // Deduplicate and sort newest first
  const allSortedNotices = useMemo(() => {
    const list = internalNotices;
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    const unique = list.filter((n) => {
      const id = n?.id || (n as any)?._id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return unique.sort((a, b) => {
      const dateA = new Date(
        a.publishedDate || (a as any).date || (a as any).publishDate || (a as any).createdAt || 0
      ).getTime();
      const dateB = new Date(
        b.publishedDate || (b as any).date || (b as any).publishDate || (b as any).createdAt || 0
      ).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [internalNotices]);

  // Filter notices by category, then take only the latest 4-5 notices
  const latestNotices = useMemo(() => {
    let list = allSortedNotices;
    if (selectedCategory !== 'ALL') {
      list = list.filter((n) => {
        const cat = (n.category || 'GENERAL').toUpperCase();
        if (selectedCategory === 'EXAMINATION') {
          return cat === 'EXAMINATION' || cat === 'EXAM' || cat === 'RESULT';
        }
        return cat === selectedCategory;
      });
    }
    // Requirement: Display only the latest 4–5 notices, newest first
    return list.slice(0, 5);
  }, [allSortedNotices, selectedCategory]);

  const tickerNotices = useMemo(() => {
    return allSortedNotices.slice(0, 5);
  }, [allSortedNotices]);

  const formatDate = (dateStr?: string) => {
    try {
      if (!dateStr) return { day: '--', month: '---', year: '----', full: 'Date not specified' };
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { day: '--', month: '---', year: '----', full: dateStr };
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear().toString();
      const full = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return { day, month, year, full };
    } catch {
      return { day: '--', month: '---', year: '----', full: dateStr || '---' };
    }
  };

  const handleOpenAllNotices = () => {
    if (onViewAllNotices) {
      onViewAllNotices();
    } else {
      navigate('/notices');
    }
  };

  return (
    <section id="notices" className="py-14 sm:py-20 bg-white border-b border-[#E4E7EC]">
      {/* Latest Announcements Ticker Strip */}
      <div className="bg-[#0B1F4B] text-white py-2.5 px-4 mb-8 sm:mb-12 border-y border-[#123B8C]">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D9A441] text-[#0B1F4B] font-bold text-[11px] uppercase tracking-wider shrink-0 shadow-2xs">
            <Bell className="w-3.5 h-3.5" />
            <span>Latest Announcements</span>
          </div>

          <div className="overflow-x-auto whitespace-nowrap scrollbar-none flex gap-6 text-xs text-slate-200 py-0.5 flex-1 min-w-0">
            {tickerNotices.length > 0 ? (
              tickerNotices.map((n, idx) => (
                <button
                  key={n.id ? `ticker-${n.id}-${idx}` : `ticker-idx-${idx}`}
                  type="button"
                  onClick={() => setActiveNotice(n)}
                  className="inline-flex items-center gap-2 hover:text-[#F3D27A] transition-colors cursor-pointer text-left shrink-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441] shrink-0" />
                  <strong className="font-semibold text-white">{n.title}:</strong>
                  <span className="text-slate-300 truncate max-w-xs">{n.content.substring(0, 60)}...</span>
                </button>
              ))
            ) : (
              <span className="text-slate-400 italic text-xs">No latest announcements available.</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenAllNotices}
            className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-[#F3D27A] hover:text-white shrink-0 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight font-heading">
              School Notice Board & Circulars
            </h2>
            <p className="text-xs sm:text-sm text-[#667085] mt-1 max-w-xl">
              Stay updated with recent academic schedules, examinations, admissions, and administrative circulars from the Principal&apos;s office.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Categories */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-[#E4E7EC]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-white text-[#123B8C] shadow-xs'
                      : 'text-[#667085] hover:text-[#101828]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Clear View All Notices Link in Header */}
            <button
              type="button"
              onClick={handleOpenAllNotices}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#123B8C] hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer"
            >
              <span>View All Notices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notices Row/List Layout (Replaced Cards Layout) */}
        {isLoading && latestNotices.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-[#E4E7EC] p-6">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#101828]">Loading circulars...</p>
            <p className="text-xs text-[#667085] mt-1">Connecting to school database.</p>
          </div>
        ) : latestNotices.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-[#E4E7EC] p-6">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#101828]">No circulars available in this category.</p>
            <p className="text-xs text-[#667085] mt-0.5">Please check &quot;ALL&quot; for complete school circulars.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-[#E4E7EC] rounded-xl bg-white overflow-hidden shadow-2xs">
            {latestNotices.map((notice, idx) => {
              const { day, month, year, full } = formatDate(
                notice.publishedDate ||
                  (notice as any).date ||
                  (notice as any).publishDate ||
                  (notice as any).createdAt
              );
              const isUrgent =
                notice.isUrgent ||
                notice.priority === 'HIGH' ||
                notice.priority === 'URGENT' ||
                (notice as any).isImportant;
              const hasAttachment = Boolean(notice.attachmentFileKey || notice.attachmentUrl);
              const attachmentDownloadUrl = hasAttachment
                ? getFileContentUrl(notice.attachmentFileKey || notice.attachmentUrl)
                : '';

              return (
                <div
                  key={notice.id ? `notice-${notice.id}-${idx}` : `notice-idx-${idx}`}
                  onClick={() => setActiveNotice(notice)}
                  className="p-4 sm:p-5 hover:bg-slate-50/90 transition-colors cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Minimalist Date Column + Content */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Date Block */}
                    <div className="w-13 h-13 rounded-lg bg-slate-100/90 border border-slate-200/80 flex flex-col items-center justify-center text-center shrink-0 group-hover:border-blue-300 group-hover:bg-blue-50/60 transition-colors">
                      <span className="text-base font-bold text-slate-900 leading-none font-heading">
                        {day}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mt-1 group-hover:text-blue-700">
                        {month}
                      </span>
                    </div>

                    {/* Notice Info */}
                    <div className="flex-1 min-w-0">
                      {/* Quiet Metadata Line (Anti-AI Slop / Zero-Pill) */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-[#123B8C] uppercase tracking-wider">
                          {notice.category || 'General'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span>{full}</span>
                        {notice.targetAudience && notice.targetAudience !== 'ALL' && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="capitalize">{notice.targetAudience.toLowerCase()}</span>
                          </>
                        )}
                        {isUrgent && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-rose-600 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Important
                            </span>
                          </>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm sm:text-base font-bold text-[#101828] group-hover:text-[#123B8C] transition-colors leading-snug line-clamp-1 sm:line-clamp-2 font-heading">
                        {notice.title}
                      </h3>

                      {/* Snippet */}
                      <p className="text-xs sm:text-sm text-[#667085] line-clamp-2 mt-1 leading-relaxed">
                        {notice.content}
                      </p>

                      {/* Attachment Notice */}
                      {hasAttachment && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-700 mt-2">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate max-w-xs font-medium">
                            {notice.attachmentName || 'Attachment available'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {hasAttachment && attachmentDownloadUrl && (
                      <a
                        href={attachmentDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={notice.attachmentName || 'circular-document'}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                        title="Download attachment"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    )}

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#123B8C] group-hover:text-[#0B1F4B] transition-colors">
                      <span>Read Circular</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Section Bottom CTA: View All Notices */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleOpenAllNotices}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow cursor-pointer w-full sm:w-auto"
          >
            <span>View All Notices</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice Inspection Modal */}
      {activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#123B8C] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#1D5FD1] uppercase tracking-wider">
                    {activeNotice.category || 'School Circular'}
                  </span>
                  <div className="text-xs text-[#667085]">
                    Dated:{' '}
                    {new Date(
                      activeNotice.publishedDate ||
                        (activeNotice as any).date ||
                        (activeNotice as any).publishDate ||
                        Date.now()
                    ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-4 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-[#101828] font-heading">
                {activeNotice.title}
              </h3>
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                {activeNotice.content}
              </div>

              {/* Attachment Download Button */}
              {(activeNotice.attachmentFileKey || activeNotice.attachmentUrl) && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Paperclip className="w-4 h-4 text-blue-700 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {activeNotice.attachmentName || 'Circular Attachment Document'}
                    </span>
                  </div>
                  <a
                    href={getFileContentUrl(
                      activeNotice.attachmentFileKey || activeNotice.attachmentUrl
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={activeNotice.attachmentName || 'circular-file'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-xs font-bold transition-colors shadow-2xs shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#667085]">
                Residential PDS Public School Sheohar
              </span>
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="px-4 py-2 rounded-xl bg-[#0B1F4B] text-white text-xs font-bold hover:bg-[#123B8C] transition-colors cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
