import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  X,
  LogIn,
  Award,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Building,
  ShieldCheck,
  BookOpen,
  FileText,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { schoolIdentity } from '../../utils/schoolIdentity';

interface PublicNavbarProps {
  settings: SchoolSettings;
  activeSection: string;
  onNavigateSection: (sectionId: string) => void;
  onGoToLogin: () => void;
  onGoToResults: () => void;
  onOpenEnquiryModal: () => void;
  onOpenMandatoryDisclosure?: () => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  settings,
  activeSection,
  onNavigateSection,
  onGoToLogin,
  onGoToResults,
  onOpenEnquiryModal,
  onOpenMandatoryDisclosure,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Desktop Dropdown states
  const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
  const [admissionDropdownOpen, setAdmissionDropdownOpen] = useState(false);
  const [academicsDropdownOpen, setAcademicsDropdownOpen] = useState(false);
  const [galleryDropdownOpen, setGalleryDropdownOpen] = useState(false);

  // Mobile Accordion states
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const [mobileAdmissionOpen, setMobileAdmissionOpen] = useState(false);
  const [mobileAcademicsOpen, setMobileAcademicsOpen] = useState(false);

  // Listen to scroll to adjust navbar height, background, and shadow smoothly
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 24) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // The hero is pulled up under this floating bar. Measure the bar so the pull-up equals its real height
  // (a fixed value overlapped the top contact strip and clipped it on phones, where the strip wraps).
  const navRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => {
      // The bar gets slimmer after scrolling; only the resting size decides how much room the hero keeps.
      if (window.scrollY > 8 && document.documentElement.style.getPropertyValue('--lp-nav-h')) return;
      document.documentElement.style.setProperty('--lp-nav-h', `${el.offsetHeight}px`);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const handleLinkClick = (id: string) => {
    setMobileMenuOpen(false);
    setAboutDropdownOpen(false);
    setAdmissionDropdownOpen(false);
    setAcademicsDropdownOpen(false);
    setGalleryDropdownOpen(false);
    onNavigateSection(id);
  };

  return (
    <>
      {/* The header takes no space of its own (h-0): the bar floats over the top of the hero and can never
          cover the contact strip above it. The measured wrapper below tells the hero how much room to leave. */}
      <header className="lp-nav sticky top-0 z-40 w-full h-0">
        <div ref={navRef} className="px-2 sm:px-4 pt-2 sm:pt-3">
        <div
          className={`lp-nav__bar max-w-7xl mx-auto px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 rounded-[28px] border transition-all duration-300 ease-in-out ${
            isScrolled ? 'is-scrolled py-1.5' : 'py-2'
          }`}
        >
          {/* Left: School Crest & Responsive School Title */}
          <div
            onClick={() => handleLinkClick('home')}
            className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 cursor-pointer select-none group"
            title="RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR"
          >
            {/* Proportionally sized, crisp logo container */}
            <div
              className={`rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 p-1 overflow-hidden transition-all duration-300 group-hover:border-[#123B8C] ${
                isScrolled ? 'w-10 h-10 sm:w-11 sm:h-11' : 'w-11 h-11 sm:w-13 sm:h-13'
              }`}
            >
              {getSchoolLogoSrc(settings.schoolLogo) ? (
                <>
                  <img
                    src={getSchoolLogoSrc(settings.schoolLogo)}
                    alt="RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR Crest"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={handleLogoError}
                    loading="eager"
                  />
                  <GraduationCap className="w-5 h-5 text-[#0B1F4B] hidden [.logo-load-failed_&]:block" />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#0B1F4B] text-[#F3D27A] font-bold text-[10px] text-center">
                  <GraduationCap className="w-5 h-5 text-[#D9A441]" />
                </div>
              )}
            </div>

            {/* School Name with responsive breakdown preventing 1-line truncation */}
            <div className="flex flex-col justify-center min-w-0">
              {/* Desktop / Tablet single or double row */}
              <h1 className="hidden sm:block text-xs sm:text-sm md:text-base font-extrabold tracking-tight text-[#0B1F4B] leading-tight group-hover:text-[#123B8C] transition-colors">
                RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
              </h1>

              {/* Mobile stacked typography: RESIDENTIAL PDS / PUBLIC SCHOOL / SHEOHAR */}
              <div className="sm:hidden flex flex-col leading-none text-left min-w-0">
                <span className="text-[11px] font-extrabold tracking-tight text-[#0B1F4B] truncate">
                  RESIDENTIAL PDS
                </span>
                <span className="text-[9px] font-bold tracking-tight text-[#123B8C] mt-0.5 truncate">
                  PUBLIC SCHOOL, SHEOHAR
                </span>
              </div>

              <p className="text-[9px] sm:text-[11px] text-[#667085] font-medium tracking-normal leading-tight mt-0.5 truncate hidden xs:block">
                {schoolIdentity(settings).address}
              </p>
            </div>
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-[13px] font-semibold text-[#101828] shrink-0">
            {/* 1. Home */}
            <button
              type="button"
              onClick={() => handleLinkClick('home')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'home'
                  ? 'text-[#123B8C] font-bold bg-blue-50/70'
                  : 'hover:text-[#123B8C] hover:bg-slate-50'
              }`}
            >
              Home
            </button>

            {/* 2. About Us Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setAboutDropdownOpen(true)}
              onMouseLeave={() => setAboutDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => handleLinkClick('about')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'about' || activeSection === 'leadership'
                    ? 'text-[#123B8C] font-bold bg-blue-50/70'
                    : 'hover:text-[#123B8C] hover:bg-slate-50'
                }`}
                aria-expanded={aboutDropdownOpen}
              >
                <span>About Us</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    aboutDropdownOpen ? 'rotate-180 text-[#123B8C]' : ''
                  }`}
                />
              </button>

              {aboutDropdownOpen && (
                <div className="absolute top-full left-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    type="button"
                    onClick={() => handleLinkClick('about')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    About School & Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('management')}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-[#123B8C] bg-blue-50/50 hover:bg-blue-50 transition-colors flex items-center justify-between"
                  >
                    <span>Our Management Team</span>
                    <span className="text-[10px] bg-blue-100 text-[#123B8C] px-1.5 py-0.2 rounded font-bold">Profiles</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('leadership')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Vision & Leadership Desk
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('stats')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Key Highlights & Statistics
                  </button>
                </div>
              )}
            </div>

            {/* 3. Admission Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setAdmissionDropdownOpen(true)}
              onMouseLeave={() => setAdmissionDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => handleLinkClick('admissions')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'admissions'
                    ? 'text-[#123B8C] font-bold bg-blue-50/70'
                    : 'hover:text-[#123B8C] hover:bg-slate-50'
                }`}
                aria-expanded={admissionDropdownOpen}
              >
                <span>Admission</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    admissionDropdownOpen ? 'rotate-180 text-[#123B8C]' : ''
                  }`}
                />
              </button>

              {admissionDropdownOpen && (
                <div className="absolute top-full left-0 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    type="button"
                    onClick={() => handleLinkClick('admissions')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Admission Overview & Process
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdmissionDropdownOpen(false);
                      onOpenEnquiryModal();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#0B1F4B] hover:bg-amber-50/60 hover:text-[#D9A441] transition-colors flex items-center justify-between"
                  >
                    <span>Online Registration 2026-27</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#D9A441]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('admissions')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Required Documents & Criteria
                  </button>
                </div>
              )}
            </div>

            {/* 4. Academics Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setAcademicsDropdownOpen(true)}
              onMouseLeave={() => setAcademicsDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => handleLinkClick('academics')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'academics'
                    ? 'text-[#123B8C] font-bold bg-blue-50/70'
                    : 'hover:text-[#123B8C] hover:bg-slate-50'
                }`}
                aria-expanded={academicsDropdownOpen}
              >
                <span>Academics</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    academicsDropdownOpen ? 'rotate-180 text-[#123B8C]' : ''
                  }`}
                />
              </button>

              {academicsDropdownOpen && (
                <div className="absolute top-full left-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    type="button"
                    onClick={() => handleLinkClick('academics')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Curriculum & Methodology
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('classes')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Wings (Nursery to 8th)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('calendar')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Academic Calendar & Exams
                  </button>
                </div>
              )}
            </div>

            {/* 5. Facilities */}
            <button
              type="button"
              onClick={() => handleLinkClick('facilities')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'facilities'
                  ? 'text-[#123B8C] font-bold bg-blue-50/70'
                  : 'hover:text-[#123B8C] hover:bg-slate-50'
              }`}
            >
              Facilities
            </button>

            {/* 6. Gallery Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setGalleryDropdownOpen(true)}
              onMouseLeave={() => setGalleryDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => handleLinkClick('gallery')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'gallery'
                    ? 'text-[#123B8C] font-bold bg-blue-50/70'
                    : 'hover:text-[#123B8C] hover:bg-slate-50'
                }`}
                aria-expanded={galleryDropdownOpen}
              >
                <span>Gallery</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    galleryDropdownOpen ? 'rotate-180 text-[#123B8C]' : ''
                  }`}
                />
              </button>

              {galleryDropdownOpen && (
                <div className="absolute top-full left-0 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    type="button"
                    onClick={() => handleLinkClick('gallery')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Campus Photos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('facilities')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123B8C] transition-colors"
                  >
                    Laboratories & Hostel
                  </button>
                </div>
              )}
            </div>

            {/* 7. Events (Notices) */}
            <button
              type="button"
              onClick={() => handleLinkClick('notices')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'notices'
                  ? 'text-[#123B8C] font-bold bg-blue-50/70'
                  : 'hover:text-[#123B8C] hover:bg-slate-50'
              }`}
            >
              Events
            </button>

            {/* 8. Contact */}
            <button
              type="button"
              onClick={() => handleLinkClick('contact')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'contact'
                  ? 'text-[#123B8C] font-bold bg-blue-50/70'
                  : 'hover:text-[#123B8C] hover:bg-slate-50'
              }`}
            >
              Contact
            </button>
          </nav>

          {/* Right: Actions (ENQUIRY NOW & PORTAL LOGIN) + Hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Primary CTA: ENQUIRY NOW */}
            <button
              type="button"
              onClick={onOpenEnquiryModal}
              className="hidden min-[480px]:inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#D9A441] to-[#D9A441] hover:from-[#F3D27A] hover:to-[#D9A441] text-[#0B1F4B] text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0B1F4B]" />
              <span className="tracking-wide uppercase text-[11px] sm:text-xs">Enquiry Now</span>
            </button>

            {/* Secondary CTA: PORTAL LOGIN */}
            <button
              type="button"
              id="landing-portal-login-btn"
              onClick={onGoToLogin}
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer border border-[#123B8C]"
            >
              <LogIn className="w-3.5 h-3.5 text-[#F3D27A]" />
              <span className="hidden sm:inline uppercase text-[11px] sm:text-xs">Portal Login</span>
              <span className="sm:hidden text-[11px]">Login</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
              aria-label="Open Mobile Navigation Drawer"
            >
              <Menu className="w-5 h-5 text-[#0B1F4B]" />
            </button>
          </div>
        </div>
        </div>
      </header>

      {/* Full-height Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative ml-auto w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 bg-[#0B1F4B] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center">
                  {getSchoolLogoSrc(settings.schoolLogo) ? (
                    <img
                      src={getSchoolLogoSrc(settings.schoolLogo)}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <GraduationCap className="w-5 h-5 text-[#0B1F4B]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-extrabold tracking-tight text-white leading-tight">
                    RESIDENTIAL PDS PUBLIC SCHOOL
                  </div>
                  <div className="text-[10px] text-[#F3D27A] font-medium">SHEOHAR, BIHAR</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close Mobile Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-semibold text-slate-800">
              {/* Quick Actions Buttons */}
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenEnquiryModal();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#D9A441] text-[#0B1F4B] text-xs font-bold shadow-xs cursor-pointer hover:bg-[#F3D27A]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Enquiry 2026-27</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGoToResults();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border border-blue-200 bg-blue-50 text-[#123B8C] text-xs font-bold cursor-pointer hover:bg-blue-100"
                >
                  <Award className="w-3.5 h-3.5 text-[#123B8C]" />
                  <span>Check Result</span>
                </button>
              </div>

              {/* Navigation Items with Accordions */}
              <div className="space-y-1">
                {/* Home */}
                <button
                  type="button"
                  onClick={() => handleLinkClick('home')}
                  className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Home</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* About Us Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileAboutOpen(!mobileAboutOpen)}
                    className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>About Us</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        mobileAboutOpen ? 'rotate-180 text-[#123B8C]' : ''
                      }`}
                    />
                  </button>
                  {mobileAboutOpen && (
                    <div className="pl-6 pr-2 py-1 space-y-1 bg-slate-50 rounded-lg text-slate-600 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleLinkClick('about')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        About School
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('management')}
                        className="w-full text-left py-1.5 font-bold text-[#123B8C]"
                      >
                        Our Management Team
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('leadership')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Vision & Mission
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('leadership')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Management Desk
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('leadership')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Principal&apos;s Desk
                      </button>
                    </div>
                  )}
                </div>

                {/* Admission Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileAdmissionOpen(!mobileAdmissionOpen)}
                    className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Admission</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        mobileAdmissionOpen ? 'rotate-180 text-[#123B8C]' : ''
                      }`}
                    />
                  </button>
                  {mobileAdmissionOpen && (
                    <div className="pl-6 pr-2 py-1 space-y-1 bg-slate-50 rounded-lg text-slate-600 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleLinkClick('admissions')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Admission Overview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('admissions')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Admission Process
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenEnquiryModal();
                        }}
                        className="w-full text-left py-1.5 font-bold text-[#D9A441]"
                      >
                        Online Registration (Apply Now)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('admissions')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Enquiry Status Tracking
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('admissions')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Required Documents & Criteria
                      </button>
                    </div>
                  )}
                </div>

                {/* Academics Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileAcademicsOpen(!mobileAcademicsOpen)}
                    className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Academics</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        mobileAcademicsOpen ? 'rotate-180 text-[#123B8C]' : ''
                      }`}
                    />
                  </button>
                  {mobileAcademicsOpen && (
                    <div className="pl-6 pr-2 py-1 space-y-1 bg-slate-50 rounded-lg text-slate-600 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleLinkClick('academics')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Curriculum Overview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('classes')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Wings (Nursery to 8th)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLinkClick('calendar')}
                        className="w-full text-left py-1.5 hover:text-[#123B8C]"
                      >
                        Examination & Academic Calendar
                      </button>
                    </div>
                  )}
                </div>

                {/* Facilities */}
                <button
                  type="button"
                  onClick={() => handleLinkClick('facilities')}
                  className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Facilities</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Gallery */}
                <button
                  type="button"
                  onClick={() => handleLinkClick('gallery')}
                  className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Gallery</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Events / Notices */}
                <button
                  type="button"
                  onClick={() => handleLinkClick('notices')}
                  className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Events & Circulars</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Contact */}
                <button
                  type="button"
                  onClick={() => handleLinkClick('contact')}
                  className="w-full text-left py-2.5 px-3 rounded-lg text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Contact & Campus Location</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Mandatory Disclosure */}
                {onOpenMandatoryDisclosure && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenMandatoryDisclosure();
                    }}
                    className="w-full text-left py-2.5 px-3 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Mandatory Public Disclosure</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </button>
                )}
              </div>

              {/* Bottom Drawer Actions */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGoToLogin();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0B1F4B] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                >
                  <LogIn className="w-4 h-4 text-[#F3D27A]" />
                  <span>Portal Login</span>
                </button>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                  {settings?.helplineNumber && (
                    <div className="flex items-center gap-1.5 font-bold text-[#0B1F4B]">
                      <Phone className="w-3.5 h-3.5 text-[#D9A441]" />
                      <span>Helpline: {settings.helplineNumber}</span>
                    </div>
                  )}
                  {schoolIdentity(settings).phones.length > 0 && (
                    <div className="text-[11px] text-slate-600 pl-5">
                      Contacts:{' '}
                      {schoolIdentity(settings).phones.map((ph, i) => (
                        <React.Fragment key={ph}>
                          {i > 0 && ' | '}
                          <a href={`tel:${ph.replace(/\s/g, '')}`} className="font-semibold text-slate-800 hover:text-blue-800">{ph}</a>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  {settings?.email && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{settings.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
