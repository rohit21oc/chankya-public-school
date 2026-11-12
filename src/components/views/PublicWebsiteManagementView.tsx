import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Sparkles,
  Image as ImageIcon,
  Users,
  Bell,
  Inbox,
  FileText,
  Calendar,
  Building,
  MapPin,
  HardDrive,
  Eye,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import {
  UserRole,
  SchoolSettings,
  PublicHeroSlide,
  PublicGalleryItem,
  PublicLeadershipProfile,
  PublicWebsiteEvent,
  PublicFacility,
  Notice,
  AdmissionEnquiry,
  PublicWebsiteContent,
  PublicMediaItem,
} from '../../types';
import { api } from '../../services/api';
import { WebsiteDashboardTab } from './public-website/WebsiteDashboardTab';
import { HeroSliderTab } from './public-website/HeroSliderTab';
import { GalleryManagementTab } from './public-website/GalleryManagementTab';
import { LeadershipManagementTab } from './public-website/LeadershipManagementTab';
import { NoticesManagementTab } from './public-website/NoticesManagementTab';
import { EnquiriesManagementTab } from './public-website/EnquiriesManagementTab';
import { WebsiteContentTab } from './public-website/WebsiteContentTab';
import { EventsManagementTab } from './public-website/EventsManagementTab';
import { FacilitiesManagementTab } from './public-website/FacilitiesManagementTab';
import { ContactSettingsTab } from './public-website/ContactSettingsTab';
import { MediaLibraryTab } from './public-website/MediaLibraryTab';
import { LivePreviewModal } from './public-website/LivePreviewModal';
import { affiliationText, schoolIdentity } from '../../utils/schoolIdentity';

interface PublicWebsiteManagementViewProps {
  userRole: UserRole;
  settings: SchoolSettings;
  onUpdateSettings?: (updated: Partial<SchoolSettings>) => void;
}

export const PublicWebsiteManagementView: React.FC<PublicWebsiteManagementViewProps> = ({
  userRole,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    // A push notification opens this page straight on the enquiries desk.
    try { return new URLSearchParams(window.location.search).get('tab') === 'enquiries' ? 'enquiries' : 'dashboard'; } catch { return 'dashboard'; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Core Website Data State
  const [heroSlides, setHeroSlides] = useState<PublicHeroSlide[]>([]);
  const [gallery, setGallery] = useState<PublicGalleryItem[]>([]);
  const [leadership, setLeadership] = useState<PublicLeadershipProfile[]>([]);
  const [events, setEvents] = useState<PublicWebsiteEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [enquiries, setEnquiries] = useState<AdmissionEnquiry[]>([]);
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [websiteContent, setWebsiteContent] = useState<PublicWebsiteContent>({
    aboutSchool: '',
    visionStatement: '',
    visionPoints: [],
    missionStatement: '',
    missionPoints: [],
    academicsOverview: '',
    hostelOverview: '',
  });
  const [mediaItems, setMediaItems] = useState<PublicMediaItem[]>([]);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);

  // Flash message helper
  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Load all website content from backend APIs
  const loadAllContent = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [
        fetchedSlides,
        fetchedGallery,
        fetchedLeadership,
        fetchedEvents,
        fetchedNotices,
        fetchedEnquiries,
        fetchedFacilities,
        fetchedContent,
        fetchedMedia,
      ] = await Promise.all([
        api.getHeroSlides(true).catch(() => []),
        api.getGallery(undefined, true).catch(() => []),
        api.getLeadership(true).catch(() => []),
        api.getWebsiteEvents(true).catch(() => []),
        Promise.resolve(api.getNotices()).catch(() => []),
        api.getAdmissionEnquiries().catch(() => []),
        api.getFacilities(true).catch(() => []),
        api.getWebsiteContent().catch(() => ({})),
        api.getPublicMediaLibrary().catch(() => ({ items: [], totalSizeBytes: 0 })),
      ]);

      setHeroSlides(fetchedSlides || []);
      setGallery(fetchedGallery || []);
      setLeadership(fetchedLeadership || []);
      setEvents(fetchedEvents || []);
      setNotices(fetchedNotices || []);
      setEnquiries(fetchedEnquiries || []);
      setFacilities(fetchedFacilities || []);
      setWebsiteContent(fetchedContent || {});
      setMediaItems(fetchedMedia.items || []);
      setTotalStorageBytes(fetchedMedia.totalSizeBytes || 0);
    } catch (err: any) {
      console.error('Failed to load website content:', err);
      showToast('error', 'Could not sync website data from backend.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllContent();

    const handleRealtime = (e: any) => {
      if (e.detail?.entity === 'WEBSITE' || e.detail?.type === 'WEBSITE') {
        loadAllContent();
      }
    };

    window.addEventListener('pradnya_entity_website', handleRealtime);
    window.addEventListener('pradnya_realtime_event', handleRealtime);

    return () => {
      window.removeEventListener('pradnya_entity_website', handleRealtime);
      window.removeEventListener('pradnya_realtime_event', handleRealtime);
    };
  }, [loadAllContent]);

  // Access check
  const isAuthorized =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'PRINCIPAL' ||
    userRole === 'VICE_PRINCIPAL' ||
    userRole === 'SCHOOL_ADMIN' ||
    userRole === 'ADMIN';

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Administrative Access Required</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          The Public Website Management module is restricted to authorized school administrators,
          Principal desk, and Super Administrators of Residential PDS Public School Sheohar.
        </p>
      </div>
    );
  }

  // --- Handlers for Hero Slides ---
  const handleSaveSlide = async (slide: Partial<PublicHeroSlide>) => {
    const created = await api.createHeroSlide(slide);
    setHeroSlides((prev) => [...prev, created]);
    showToast('success', 'Hero banner successfully added to homepage carousel!');
  };

  const handleUpdateSlide = async (id: string, updates: Partial<PublicHeroSlide>) => {
    const updated = await api.updateHeroSlide(id, updates);
    setHeroSlides((prev) => prev.map((s) => (s.id === id ? updated : s)));
    showToast('success', 'Hero banner updated successfully!');
  };

  const handleDeleteSlide = async (id: string) => {
    await api.deleteHeroSlide(id);
    setHeroSlides((prev) => prev.filter((s) => s.id !== id));
    showToast('success', 'Hero banner deleted.');
  };

  const handleReorderSlides = async (reordered: PublicHeroSlide[]) => {
    setHeroSlides(reordered);
    for (const slide of reordered) {
      await api.updateHeroSlide(slide.id, { displayOrder: slide.displayOrder });
    }
    showToast('success', 'Slide display order saved.');
  };

  // --- Handlers for Gallery ---
  const handleSaveGalleryItem = async (item: Partial<PublicGalleryItem>) => {
    const created = await api.createGalleryItem(item);
    setGallery((prev) => [created, ...prev]);
    showToast('success', 'Photo added to school website gallery!');
  };

  const handleUpdateGalleryItem = async (id: string, updates: Partial<PublicGalleryItem>) => {
    const updated = await api.updateGalleryItem(id, updates);
    setGallery((prev) => prev.map((g) => (g.id === id ? updated : g)));
    showToast('success', 'Gallery item updated.');
  };

  const handleDeleteGalleryItem = async (id: string) => {
    await api.deleteGalleryItem(id);
    setGallery((prev) => prev.filter((g) => g.id !== id));
    showToast('success', 'Photo removed from gallery.');
  };

  // --- Handlers for Leadership ---
  const handleSaveLeadership = async (prof: Partial<PublicLeadershipProfile>) => {
    const created = await api.createLeadership(prof);
    setLeadership((prev) => [...prev, created]);
    showToast('success', 'Leadership profile added to website!');
  };

  const handleUpdateLeadership = async (id: string, updates: Partial<PublicLeadershipProfile>) => {
    const updated = await api.updateLeadership(id, updates);
    setLeadership((prev) => prev.map((l) => (l.id === id ? updated : l)));
    showToast('success', 'Leadership profile updated.');
  };

  const handleDeleteLeadership = async (id: string) => {
    await api.deleteLeadership(id);
    setLeadership((prev) => prev.filter((l) => l.id !== id));
    showToast('success', 'Leadership profile deleted.');
  };

  // --- Handlers for Notices ---
  const handleSaveNotice = async (notice: Partial<Notice>) => {
    try {
      const created = await api.createNotice(notice as any);
      setNotices((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
      showToast('success', created.status === 'DRAFT' ? 'Notice saved as draft.' : 'Notice published.');
    } catch (err: any) {
      showToast('error', err?.message || 'The notice could not be saved.');
    }
  };

  const handleUpdateNotice = async (id: string, updates: Partial<Notice>) => {
    try {
      const updated = await api.updateNotice(id, updates);
      setNotices((prev) => prev.map((n) => (n.id === id ? updated : n)));
      showToast('success', 'Notice updated.');
    } catch (err: any) {
      showToast('error', err?.message || 'The notice could not be updated.');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await api.deleteNotice(id);
      setNotices((prev) => prev.filter((n) => n.id !== id));
      showToast('success', 'Notice deleted.');
    } catch (err: any) {
      showToast('error', err?.message || 'The notice could not be deleted.');
    }
  };

  // --- Handlers for Enquiries ---
  const handleUpdateEnquiryStatus = async (
    id: string,
    status: AdmissionEnquiry['status'],
    notes?: string,
    followUpDate?: string
  ) => {
    const updated = await api.updateAdmissionEnquiry(id, { status, notes, followUpDate });
    setEnquiries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    showToast('success', 'Enquiry updated');
  };

  // --- Handlers for Website Content ---
  const handleSaveContent = async (updated: PublicWebsiteContent) => {
    const saved = await api.updateWebsiteContent(updated);
    setWebsiteContent(saved);
    showToast('success', 'Website philosophy and core text updated!');
  };

  // --- Handlers for Events ---
  const handleSaveEvent = async (ev: Partial<PublicWebsiteEvent>) => {
    const created = await api.createWebsiteEvent(ev);
    setEvents((prev) => [created, ...prev]);
    showToast('success', 'Event added to school calendar!');
  };

  const handleUpdateEvent = async (id: string, updates: Partial<PublicWebsiteEvent>) => {
    const updated = await api.updateWebsiteEvent(id, updates);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    showToast('success', 'Event updated.');
  };

  const handleDeleteEvent = async (id: string) => {
    await api.deleteWebsiteEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast('success', 'Event removed from calendar.');
  };

  // --- Handlers for Facilities ---
  const handleSaveFacility = async (fac: Partial<PublicFacility>) => {
    const created = await api.createFacility(fac);
    setFacilities((prev) => [...prev, created]);
    showToast('success', 'Facility showcase added to website!');
  };

  const handleUpdateFacility = async (id: string, updates: Partial<PublicFacility>) => {
    const updated = await api.updateFacility(id, updates);
    setFacilities((prev) => prev.map((f) => (f.id === id ? updated : f)));
    showToast('success', 'Facility updated.');
  };

  const handleDeleteFacility = async (id: string) => {
    await api.deleteFacility(id);
    setFacilities((prev) => prev.filter((f) => f.id !== id));
    showToast('success', 'Facility removed.');
  };

  // --- Handler for Settings ---
  const handleUpdateSettings = async (updated: Partial<SchoolSettings>) => {
    await api.updateSettings(updated);
    if (onUpdateSettings) {
      onUpdateSettings(updated);
    }
    showToast('success', 'School settings updated successfully.');
  };

  // --- Handlers for Media ---
  const handleDeleteMedia = async (id: string) => {
    await api.deleteMediaItem(id);
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
    showToast('success', 'File removed.');
  };

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'hero', label: 'Hero Slider', icon: Sparkles, count: heroSlides.length },
    { id: 'gallery', label: 'Photo Gallery', icon: ImageIcon, count: gallery.length },
    { id: 'leadership', label: 'Management Team', icon: Users, count: leadership.length },
    { id: 'notices', label: 'Circulars & Notices', icon: Bell, count: notices.length },
    {
      id: 'enquiries',
      label: 'Admission Enquiries',
      icon: Inbox,
      count: enquiries.filter((e) => e.status === 'SUBMITTED').length || enquiries.length,
      highlight: enquiries.some((e) => e.status === 'SUBMITTED'),
    },
    { id: 'content', label: 'About & Vision', icon: FileText },
    { id: 'events', label: 'Events Calendar', icon: Calendar, count: events.length },
    { id: 'facilities', label: 'Facilities Showcase', icon: Building, count: facilities.length },
    { id: 'contact', label: 'Campus Contact', icon: MapPin },
    { id: 'media', label: 'Media Library', icon: HardDrive, count: mediaItems.length },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Public Website Management
                  </h1>
                </div>
                <p className="text-xs text-slate-500">
                  {[settings.schoolName, affiliationText(schoolIdentity(settings), 'Affiliation Code')].filter(Boolean).join(' • ')}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => loadAllContent()}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Refresh website content from database"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Live Website Preview</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm shadow-xs transition"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span>Open Website</span>
            </a>
          </div>
        </div>

        {/* Global Toast Alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                } ${tab.highlight && !isActive ? 'ring-2 ring-indigo-400 bg-indigo-50/50' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-slate-800 text-amber-300'
                        : tab.highlight
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'dashboard' && (
          <WebsiteDashboardTab
            slides={heroSlides}
            gallery={gallery}
            leadership={leadership}
            events={events}
            notices={notices}
            enquiries={enquiries}
            mediaItems={mediaItems}
            storageUsageBytes={totalStorageBytes}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenLivePreview={() => setIsPreviewOpen(true)}
          />
        )}

        {activeTab === 'hero' && (
          <HeroSliderTab
            slides={heroSlides}
            onSaveSlide={handleSaveSlide}
            onUpdateSlide={handleUpdateSlide}
            onDeleteSlide={handleDeleteSlide}
            onReorderSlides={handleReorderSlides}
          />
        )}

        {activeTab === 'gallery' && (
          <GalleryManagementTab
            gallery={gallery}
            onSaveItem={handleSaveGalleryItem}
            onUpdateItem={handleUpdateGalleryItem}
            onDeleteItem={handleDeleteGalleryItem}
          />
        )}

        {activeTab === 'leadership' && (
          <LeadershipManagementTab
            leadership={leadership}
            onSaveProfile={handleSaveLeadership}
            onUpdateProfile={handleUpdateLeadership}
            onDeleteProfile={handleDeleteLeadership}
          />
        )}

        {activeTab === 'notices' && (
          <NoticesManagementTab
            notices={notices}
            onSaveNotice={handleSaveNotice}
            onUpdateNotice={handleUpdateNotice}
            onDeleteNotice={handleDeleteNotice}
          />
        )}

        {activeTab === 'enquiries' && (
          <EnquiriesManagementTab
            enquiries={enquiries}
            onUpdateStatus={handleUpdateEnquiryStatus}
          />
        )}

        {activeTab === 'content' && (
          <WebsiteContentTab
            content={websiteContent}
            onSaveContent={handleSaveContent}
          />
        )}

        {activeTab === 'events' && (
          <EventsManagementTab
            events={events}
            onSaveEvent={handleSaveEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}

        {activeTab === 'facilities' && (
          <FacilitiesManagementTab
            facilities={facilities}
            onSaveFacility={handleSaveFacility}
            onUpdateFacility={handleUpdateFacility}
            onDeleteFacility={handleDeleteFacility}
          />
        )}

        {activeTab === 'contact' && (
          <ContactSettingsTab
            settings={settings}
            content={websiteContent}
            onUpdateSettings={handleUpdateSettings}
            onUpdateContent={handleSaveContent}
          />
        )}

        {activeTab === 'media' && (
          <MediaLibraryTab
            mediaItems={mediaItems}
            totalStorageBytes={totalStorageBytes}
            onRefresh={loadAllContent}
            onDeleteItem={handleDeleteMedia}
            isLoading={isLoading || isRefreshing}
          />
        )}
      </div>

      {/* Live Preview Modal */}
      <LivePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};
