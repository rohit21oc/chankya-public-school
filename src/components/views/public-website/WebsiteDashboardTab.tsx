import React from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Users,
  Calendar,
  Bell,
  Inbox,
  HardDrive,
  Eye,
  PlusCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import {
  PublicHeroSlide,
  PublicGalleryItem,
  PublicLeadershipProfile,
  PublicWebsiteEvent,
  Notice,
  AdmissionEnquiry,
  PublicMediaItem,
} from '../../../types';
import { affiliationText, schoolIdentity } from '../../../utils/schoolIdentity';
import { api } from '../../../services/api';

interface WebsiteDashboardTabProps {
  slides: PublicHeroSlide[];
  gallery: PublicGalleryItem[];
  leadership: PublicLeadershipProfile[];
  events: PublicWebsiteEvent[];
  notices: Notice[];
  enquiries: AdmissionEnquiry[];
  mediaItems: PublicMediaItem[];
  storageUsageBytes: number;
  onNavigateTab: (tabId: string) => void;
  onOpenLivePreview: () => void;
}

export const WebsiteDashboardTab: React.FC<WebsiteDashboardTabProps> = ({
  slides = [],
  gallery = [],
  leadership = [],
  events = [],
  notices = [],
  enquiries = [],
  mediaItems = [],
  storageUsageBytes = 0,
  onNavigateTab,
  onOpenLivePreview,
}) => {
  const safeSlides = Array.isArray(slides) ? slides : [];
  const safeGallery = Array.isArray(gallery) ? gallery : [];
  const safeLeadership = Array.isArray(leadership) ? leadership : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const safeNotices = Array.isArray(notices) ? notices : [];
  const safeEnquiries = Array.isArray(enquiries) ? enquiries : [];
  const safeMedia = Array.isArray(mediaItems) ? mediaItems : [];

  const activeSlides = safeSlides.filter((s) => s.isActive !== false);
  const activeGallery = safeGallery.filter((g) => g.isActive !== false);
  const activeLeadership = safeLeadership.filter((l) => l.isActive !== false);
  const activeEvents = safeEvents.filter((e) => e.isActive !== false);
  const pendingEnquiries = safeEnquiries.filter(
    (e) => e.status === 'SUBMITTED' || e.status === 'UNDER_REVIEW'
  );

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const statCards = [
    {
      id: 'hero',
      label: 'Hero Banners',
      count: `${activeSlides.length} Active`,
      total: `${slides.length} Total`,
      icon: Sparkles,
      color: 'bg-amber-500/10 text-amber-700 border-amber-200',
      action: () => onNavigateTab('hero'),
    },
    {
      id: 'gallery',
      label: 'Photo Gallery',
      count: `${activeGallery.length} Published`,
      total: `${gallery.length} Photos`,
      icon: ImageIcon,
      color: 'bg-blue-500/10 text-blue-700 border-blue-200',
      action: () => onNavigateTab('gallery'),
    },
    {
      id: 'leadership',
      label: 'Management Team',
      count: `${activeLeadership.length} Active`,
      total: `${leadership.length} Members`,
      icon: Users,
      color: 'bg-blue-600/10 text-blue-800 border-blue-200',
      action: () => onNavigateTab('leadership'),
    },
    {
      id: 'events',
      label: 'School Events',
      count: `${activeEvents.length} Active`,
      total: `${events.length} Total`,
      icon: Calendar,
      color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      action: () => onNavigateTab('events'),
    },
    {
      id: 'notices',
      label: 'Notices & Circulars',
      count: `${notices.length} Published`,
      total: 'Ticker + Board',
      icon: Bell,
      color: 'bg-rose-500/10 text-rose-700 border-rose-200',
      action: () => onNavigateTab('notices'),
    },
    {
      id: 'enquiries',
      label: 'Admission Enquiries',
      count: `${pendingEnquiries.length} Pending Action`,
      total: `${enquiries.length} Total Received`,
      icon: Inbox,
      color: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
      action: () => onNavigateTab('enquiries'),
      highlight: pendingEnquiries.length > 0,
    },
    {
      id: 'media',
      label: 'Media files',
      count: `${mediaItems.length} Uploads`,
      total: formatFileSize(storageUsageBytes),
      icon: HardDrive,
      color: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      action: () => onNavigateTab('media'),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden border border-slate-700/50">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Public Website Management & Content Control</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Residential PDS Public School Sheohar
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Welcome to the centralized content administrative hub for the public-facing school website.
            All banner updates, gallery photos, leadership messages, admission enquiries, and breaking notices
            appear on the public website as soon as they are saved.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenLivePreview}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-sm cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Live Website</span>
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs sm:text-sm transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Open in New Tab</span>
            </a>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={card.action}
              className={`p-5 rounded-2xl bg-white border transition shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between group ${
                card.highlight ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl border ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-slate-400 group-hover:text-amber-600 transition">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-lg sm:text-xl font-black text-slate-900">
                  {card.count}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {card.total}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Launch & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Management Shortcuts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Quick Content Actions</h3>
              <p className="text-xs text-slate-500">Jump directly into updating specific sections</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {affiliationText(schoolIdentity(api.getSettings()), 'Code') || 'Affiliation not configured'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => onNavigateTab('leadership')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-900">Management Team</h4>
                  <p className="text-xs text-slate-500">Add profiles, replace photos, or reorder members</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </button>

            <button
              onClick={() => onNavigateTab('gallery')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-900">Upload Photos</h4>
                  <p className="text-xs text-slate-500">Add campus, sports, or event memories</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </button>

            <button
              onClick={() => onNavigateTab('notices')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-rose-900">Post Urgent Notice</h4>
                  <p className="text-xs text-slate-500">Admissions, holidays, or exam dates</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
            </button>

            <button
              onClick={() => onNavigateTab('enquiries')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <Inbox className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">Review Enquiries</h4>
                  <p className="text-xs text-slate-500">
                    {pendingEnquiries.length > 0
                      ? `${pendingEnquiries.length} waiting for contact`
                      : 'All online applications processed'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </button>
          </div>

          {/* System Integration Status */}
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Media Storage & CDN:</strong> Connected & Serving Public Media
              </span>
            </div>
            <span className="text-slate-500 font-medium">Residential PDS Public School Sheohar</span>
          </div>
        </div>

        {/* Latest Admission Enquiries Widget */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Recent Enquiries</h3>
              <button
                onClick={() => onNavigateTab('enquiries')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
              >
                View All
              </button>
            </div>
            <p className="text-xs text-slate-500">Latest submissions from prospective parents</p>
          </div>

          <div className="space-y-2.5 my-2 flex-1">
            {(safeEnquiries || []).slice(0, 4).map((enq) => (
              <div
                key={enq.id}
                onClick={() => onNavigateTab('enquiries')}
                className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{enq.studentName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      enq.status === 'SUBMITTED'
                        ? 'bg-amber-100 text-amber-800'
                        : enq.status === 'CONTACTED'
                        ? 'bg-blue-100 text-blue-800'
                        : enq.status === 'ADMITTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {enq.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Class: {enq.classApplying}</span>
                  <span>Ph: {enq.mobile}</span>
                </div>
              </div>
            ))}
            {enquiries.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">
                No admission enquiries submitted yet.
              </p>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('enquiries')}
            className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Enquiries Desk</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
