import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Bell,
  Calendar,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  LogIn,
  Paperclip,
  Printer,
  RefreshCw,
  Search,
  X,
  Award,
  AlertCircle,
  LayoutDashboard,
} from 'lucide-react';
import { Notice, SchoolSettings, User } from '../../types';
import { api } from '../../services/api';
import { getFileContentUrl } from '../../services/apiConfig';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { PublicFooter } from './PublicFooter';

interface PublicAllNoticesPageProps {
  settings: SchoolSettings;
  onBackToHome: () => void;
  onGoToLogin: () => void;
  onGoToResults: () => void;
  effectiveUser?: User | null;
}

export const PublicAllNoticesPage: React.FC<PublicAllNoticesPageProps> = ({
  settings,
  onBackToHome,
  onGoToLogin,
  onGoToResults,
  effectiveUser,
}) => {
  const [notices, setNotices] = useState<Notice[]>(() => api.getNotices());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);

  // Fetch live notices from MongoDB Atlas API on mount
  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await api.syncNotices();
      if (Array.isArray(list)) {
        setNotices(list);
      }
    } catch (err) {
      console.warn('[PublicAllNoticesPage] Error fetching notices from API:', err);
      setNotices(api.getNotices());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();

    const handleNoticeUpdate = () => {
      setNotices(api.getNotices());
    };
    window.addEventListener('pradnya_entity_notices', handleNoticeUpdate);
    return () => {
      window.removeEventListener('pradnya_entity_notices', handleNoticeUpdate);
    };
  }, [fetchNotices]);

  // Categories list
  const categories = ['ALL', 'ACADEMIC', 'EXAMINATION', 'EVENT', 'CIRCULAR', 'GENERAL'];

  // Deduplicate and sort newest first
  const sortedNotices = useMemo(() => {
    if (!Array.isArray(notices)) return [];
    const seen = new Set<string>();
    const unique = notices.filter((n) => {
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
  }, [notices]);

  // Filtered list based on search and category
  const filteredNotices = useMemo(() => {
    return sortedNotices.filter((n) => {
      const cat = (n.category || 'GENERAL').toUpperCase();
      let matchesCat = true;
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'EXAMINATION') {
          matchesCat = cat === 'EXAMINATION' || cat === 'EXAM' || cat === 'RESULT';
        } else if (selectedCategory === 'CIRCULAR') {
          matchesCat = cat === 'CIRCULAR' || cat === 'GENERAL';
        } else {
          matchesCat = cat === selectedCategory;
        }
      }

      if (!matchesCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (n.title || '').toLowerCase().includes(q);
      const contentMatch = (n.content || '').toLowerCase().includes(q);
      const catMatch = (n.category || '').toLowerCase().includes(q);
      const authorMatch = (n.publishedBy || (n as any).author || '').toLowerCase().includes(q);
      return titleMatch || contentMatch || catMatch || authorMatch;
    });
  }, [sortedNotices, selectedCategory, searchQuery]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return { day: '--', month: '---', year: '----', full: 'Date not specified' };
    try {
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

  const handlePrintNotice = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Banner if logged in */}
      {effectiveUser && (
        <div className="bg-blue-900 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Logged in as <strong>{effectiveUser.name}</strong> ({effectiveUser.role.replace('_', ' ')})
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToLogin}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white text-blue-900 font-bold hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Return to ERP Dashboard</span>
          </button>
        </div>
      )}

      {/* Main Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Logo & School Title */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={getSchoolLogoSrc(settings)}
              alt="School Logo"
              onError={handleLogoError}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-[#0B1F4B] truncate tracking-tight font-heading">
                {settings.schoolName || 'Residential PDS Public School'}
              </h1>
              <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                Affiliated with CBSE New Delhi · School Notice Board & Official Circulars
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-[#0B1F4B] hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>

            <button
              type="button"
              onClick={onGoToResults}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-900 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-blue-700" />
              <span>Verify Results</span>
            </button>

            <button
              type="button"
              onClick={onGoToLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Portal Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Breadcrumb & Section Kicker */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="hover:text-blue-900 transition-colors cursor-pointer"
          >
            Home
          </button>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900 font-medium">Official Notices & Circulars</span>
        </div>

        {/* Page Hero Title & Summary */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wider mb-1.5">
              <Bell className="w-3.5 h-3.5 text-blue-700" />
              <span>Official Circular Archive</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight font-heading">
              School Notice Board & Circulars
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Official archive of announcements, examination dates, academic updates, holiday schedules, and administrative circulars published by Residential PDS Public School.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchNotices}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh notices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isLoading ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar Controls */}
        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search circulars by title, keywords or reference..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-lg border border-slate-200 focus:border-blue-600 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0B1F4B] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Count and Status Strip */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong>{filteredNotices.length}</strong> of <strong>{sortedNotices.length}</strong> published notices
            {selectedCategory !== 'ALL' && ` in ${selectedCategory}`}
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Ordered newest first · Live database synchronization
          </span>
        </div>

        {/* Notices Row/List Container */}
        <div className="mt-4">
          {isLoading && filteredNotices.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">Loading school notices...</p>
              <p className="text-xs text-slate-500 mt-1">Loading notices…</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-900">No notices found</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No published notices match "${searchQuery}". Please try another keyword or clear search.`
                  : 'There are currently no notices available in this category.'}
              </p>
              {(searchQuery || selectedCategory !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              {filteredNotices.map((notice, idx) => {
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
                    key={notice.id ? `all-notice-${notice.id}-${idx}` : `all-notice-idx-${idx}`}
                    onClick={() => setActiveNotice(notice)}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Date column + Notice content */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Editorial Date Block */}
                      <div className="w-13 h-13 rounded-lg bg-slate-100/90 border border-slate-200/80 flex flex-col items-center justify-center text-center shrink-0 group-hover:border-blue-300 group-hover:bg-blue-50/60 transition-colors">
                        <span className="text-base font-bold text-slate-900 leading-none font-heading">
                          {day}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mt-1 group-hover:text-blue-700">
                          {month}
                        </span>
                      </div>

                      {/* Main Notice Details */}
                      <div className="flex-1 min-w-0">
                        {/* Quiet Metadata Line */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                          <span className="font-semibold text-blue-900 uppercase tracking-wider">
                            {notice.category || 'General'}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span>{full}</span>
                          {notice.targetAudience && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="capitalize">
                                {notice.targetAudience === 'ALL'
                                  ? 'All Campus'
                                  : notice.targetAudience.toLowerCase()}
                              </span>
                            </>
                          )}
                          {isUrgent && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="text-rose-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Urgent
                              </span>
                            </>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-900 transition-colors leading-snug line-clamp-1 sm:line-clamp-2 font-heading">
                          {notice.title}
                        </h3>

                        {/* Content Excerpt */}
                        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                          {notice.content}
                        </p>

                        {/* Attachment note */}
                        {hasAttachment && (
                          <div className="flex items-center gap-2 text-xs text-blue-700 mt-2">
                            <Paperclip className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-medium truncate max-w-sm">
                              {notice.attachmentName || 'Official Attachment Available'}
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
                          download={notice.attachmentName || 'notice-document'}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                          title="Download attachment"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Download</span>
                        </a>
                      )}

                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 group-hover:text-blue-950 transition-colors">
                        <span>Read Circular</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Notice Inspection Modal */}
      {activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-blue-900 uppercase tracking-wider">
                      {activeNotice.category || 'General Circular'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Dated:{' '}
                      {new Date(
                        activeNotice.publishedDate ||
                          (activeNotice as any).date ||
                          (activeNotice as any).publishDate ||
                          Date.now()
                      ).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    {activeNotice.targetAudience && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Audience: {activeNotice.targetAudience}</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-heading leading-snug">
                    {activeNotice.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0 ml-3"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-5 space-y-4 flex-1">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                {activeNotice.content}
              </div>

              {/* Attachment Download Card */}
              {(activeNotice.attachmentFileKey || activeNotice.attachmentUrl) && (
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="w-4 h-4 text-blue-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {activeNotice.attachmentName || 'Official Circular Document'}
                      </p>
                      <p className="text-[11px] text-slate-500">Verified official file attachment</p>
                    </div>
                  </div>

                  <a
                    href={getFileContentUrl(
                      activeNotice.attachmentFileKey || activeNotice.attachmentUrl
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={activeNotice.attachmentName || 'notice-document'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-xs font-bold transition-colors shadow-2xs shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                </div>
              )}

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2">
                <span>
                  Issued By: {activeNotice.publishedBy || (activeNotice as any).author || "Principal's Office"}
                </span>
                <span>Residential PDS Public School Sheohar</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handlePrintNotice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Notice</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="px-4 py-2 rounded-lg bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <PublicFooter
        settings={settings}
        onNavigateSection={onBackToHome}
        onGoToLogin={onGoToLogin}
        onGoToResults={onGoToResults}
        onOpenEnquiry={onBackToHome}
        onOpenMandatoryDisclosure={onBackToHome}
      />
    </div>
  );
};
