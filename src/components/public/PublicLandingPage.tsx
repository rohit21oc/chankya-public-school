import React, { useState, useEffect, useRef } from 'react';
import './landing.css';
import { SchoolSettings, Notice, PublicHeroSlide } from '../../types';
import { api } from '../../services/api';
import { navigate } from '../../services/routerService';
import { PublicTopBar } from './PublicTopBar';
import { PublicNavbar } from './PublicNavbar';
import { PublicHeroCarousel } from './PublicHeroCarousel';
import { PublicQuickActions } from './PublicQuickActions';
import { PublicNoticeBoard } from './PublicNoticeBoard';
import { PublicAboutSection } from './PublicAboutSection';
import { PublicManagementTeamSection } from './PublicManagementTeamSection';
import { PublicStatsSection } from './PublicStatsSection';
import { PublicAcademicsSection } from './PublicAcademicsSection';
import { PublicFacilitiesSection } from './PublicFacilitiesSection';
import { PublicGallerySection } from './PublicGallerySection';
import { PublicAdmissionSection } from './PublicAdmissionSection';
import { PublicContactSection } from './PublicContactSection';
import { PublicFooter } from './PublicFooter';
import { MandatoryDisclosureModal } from './MandatoryDisclosureModal';
import { AcademicCalendarModal } from './AcademicCalendarModal';
import { QuickEnquiryModal } from './QuickEnquiryModal';

interface PublicLandingPageProps {
  settings: SchoolSettings;
  onGoToLogin: () => void;
  onGoToResults: () => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  settings,
  onGoToLogin,
  onGoToResults,
}) => {
  const [notices, setNotices] = useState<Notice[]>(() => api.getNotices());
  const [isLoadingNotices, setIsLoadingNotices] = useState<boolean>(false);
  const [heroSlides, setHeroSlides] = useState<PublicHeroSlide[]>([]);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    let isMounted = true;
    setIsLoadingNotices(true);

    api
      .syncNotices()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setNotices(data);
        }
      })
      .catch(() => {
        if (isMounted) setNotices(api.getNotices());
      })
      .finally(() => {
        if (isMounted) setIsLoadingNotices(false);
      });

    const handleNoticeChange = () => {
      if (isMounted) {
        setNotices(api.getNotices());
      }
    };
    window.addEventListener('pradnya_entity_notices', handleNoticeChange);

    api.getHeroSlides().then((slides) => {
      if (isMounted && Array.isArray(slides)) {
        setHeroSlides(slides);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
      window.removeEventListener('pradnya_entity_notices', handleNoticeChange);
    };
  }, []);

  // Modals state
  // Sections ease in as they scroll into view (skipped for reduced motion; content is visible without JS).
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const targets: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>('main section:not(.lp-hero), footer'));
    targets.forEach((el) => el.classList.add('lp-reveal'));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('is-in'), io.unobserve(e.target))),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const [mandatoryDisclosureOpen, setMandatoryDisclosureOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [enquiryModalOpen, setEnquiryModalOpen] = useState(false);

  // Handle section scrolling
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);

    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (sectionId === 'calendar') {
      setCalendarModalOpen(true);
      return;
    }

    if (sectionId === 'management' || sectionId === 'leadership') {
      const targetEl = document.getElementById('management-team');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    const targetEl = document.getElementById(sectionId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Check URL hash or path on initial render
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        scrollToSection(hash);
      }, 300);
    } else {
      const pathname = window.location.pathname;
      const primarySection = pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
      if (['about', 'management', 'leadership', 'academics', 'admissions', 'facilities', 'gallery', 'notices', 'contact'].includes(primarySection)) {
        setTimeout(() => {
          scrollToSection(primarySection);
        }, 300);
      }
    }
  }, []);

  return (
    <div ref={rootRef} className="lp-theme min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* 1. Top Bar */}
      <PublicTopBar
        settings={settings}
        onGoToResults={onGoToResults}
        onGoToAdmission={() => scrollToSection('admissions')}
      />

      {/* 2. Main Navigation Header */}
      <PublicNavbar
        settings={settings}
        activeSection={activeSection}
        onNavigateSection={scrollToSection}
        onGoToLogin={onGoToLogin}
        onGoToResults={onGoToResults}
        onOpenEnquiryModal={() => setEnquiryModalOpen(true)}
      />

      <main className="flex-1">
        {/* 3. Hero Carousel */}
        <div id="home">
          <PublicHeroCarousel
            slides={heroSlides}
            onOpenEnquiry={() => setEnquiryModalOpen(true)}
            onGoToResults={onGoToResults}
            onGoToLogin={onGoToLogin}
            onExploreFacilities={() => scrollToSection('facilities')}
          />
        </div>

        {/* 4. Quick Action Highlights */}
        <PublicQuickActions
          onOpenEnquiry={() => setEnquiryModalOpen(true)}
          onGoToResults={onGoToResults}
          onGoToHostel={() => scrollToSection('facilities')}
          onGoToTransport={() => scrollToSection('facilities')}
          onGoToFees={() => scrollToSection('admissions')}
          onOpenMandatoryDisclosure={() => setMandatoryDisclosureOpen(true)}
        />

        {/* 5. Live Notice Board & Circulars */}
        <PublicNoticeBoard
          notices={notices}
          isLoading={isLoadingNotices}
          onViewAllNotices={() => navigate('/notices')}
        />

        {/* 6. About Us & Leadership Messages */}
        <PublicAboutSection />

        {/* 7. Our Management Team (Dynamic Leadership Profiles) */}
        <PublicManagementTeamSection />

        {/* 8. Key Statistical Numbers & Impact */}
        <PublicStatsSection />

        {/* 8. Academics & Wings */}
        <PublicAcademicsSection
          onOpenEnquiry={() => setEnquiryModalOpen(true)}
          onOpenCalendarModal={() => setCalendarModalOpen(true)}
        />

        {/* 9. Facilities, Hostel & Labs */}
        <PublicFacilitiesSection onOpenEnquiry={() => setEnquiryModalOpen(true)} />

        {/* 10. Photo Gallery & Campus Life */}
        <PublicGallerySection />

        {/* 11. Admissions & Online Enquiry Form with Status Tracker */}
        <PublicAdmissionSection />

        {/* 12. Contact Us & Campus Location */}
        <PublicContactSection settings={settings} />
      </main>

      {/* 13. Comprehensive Footer */}
      <PublicFooter
        settings={settings}
        onNavigateSection={scrollToSection}
        onGoToLogin={onGoToLogin}
        onGoToResults={onGoToResults}
        onOpenEnquiry={() => setEnquiryModalOpen(true)}
        onOpenMandatoryDisclosure={() => setMandatoryDisclosureOpen(true)}
      />

      {/* Interactive Modals */}
      <MandatoryDisclosureModal
        isOpen={mandatoryDisclosureOpen}
        onClose={() => setMandatoryDisclosureOpen(false)}
      />

      <AcademicCalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        onOpenEnquiry={() => {
          setCalendarModalOpen(false);
          setEnquiryModalOpen(true);
        }}
      />

      <QuickEnquiryModal
        isOpen={enquiryModalOpen}
        onClose={() => setEnquiryModalOpen(false)}
      />
    </div>
  );
};
