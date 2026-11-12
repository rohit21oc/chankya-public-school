import React from 'react';
import {
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Award,
  LogIn,
  ArrowUp,
  Sparkles,
  FileText,
  Clock,
  GraduationCap,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import { navigate } from '../../services/routerService';
import { openCookieSettings } from '../../utils/cookieConsent';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { affiliationText, schoolIdentity } from '../../utils/schoolIdentity';

interface PublicFooterProps {
  settings: SchoolSettings;
  onNavigateSection: (sectionId: string) => void;
  onGoToLogin: () => void;
  onGoToResults: () => void;
  onOpenEnquiry: () => void;
  onOpenMandatoryDisclosure: () => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({
  settings,
  onNavigateSection,
  onGoToLogin,
  onGoToResults,
  onOpenEnquiry,
  onOpenMandatoryDisclosure,
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      {/* Upper Footer Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Column 1: School Identity */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center border border-white/20">
                {getSchoolLogoSrc(settings.schoolLogo) ? (
                  <>
                    <img
                      src={getSchoolLogoSrc(settings.schoolLogo)}
                      alt="CHANAKYA PUBLIC SCHOOL & COACHING CENTRE"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={handleLogoError}
                    />
                    <GraduationCap className="w-6 h-6 text-blue-900 hidden [.logo-load-failed_&]:block" />
                  </>
                ) : (
                  <GraduationCap className="w-6 h-6 text-blue-900" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">
                  CHANAKYA PUBLIC SCHOOL & COACHING CENTRE
                </h3>
                <p className="text-[11px] text-amber-400 font-semibold tracking-wide">KUSHAHAR, SHEOHAR, BIHAR</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Quality education for boys and girls from Class 1 to Class 8, with strong basics, good values and computer education, in Kushahar, Sheohar.
            </p>

            <div className="space-y-2 pt-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <a
                  href={settings.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.schoolAddress || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-300 transition-colors underline-offset-2 hover:underline"
                  title={`View ${schoolIdentity(settings).name} on Google Maps`}
                >
                  {settings.schoolAddress || ''}{settings.plusCode ? ` (Plus Code: ${String(settings.plusCode).split(' ')[0]})` : ''}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Contact Numbers:</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-white">
                    {(Array.isArray(settings.footerContacts) && settings.footerContacts.length ? settings.footerContacts : schoolIdentity(settings).phones).map((ph, idx) => (
                      <React.Fragment key={ph}>
                        {idx > 0 && <span className="text-slate-600">,</span>}
                        <a href={`tel:${String(ph).replace(/\s/g, '')}`} className="hover:text-amber-400 transition-colors">{ph}</a>
                      </React.Fragment>
                    ))}
                  </div>
                  {settings.helplineNumber && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Helpline: <a href={`tel:${settings.helplineNumber}`} className="text-amber-400 font-bold hover:underline">{settings.helplineNumber}</a>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <a
                  href={`mailto:${settings.email || ''}`}
                  className="hover:text-white transition-colors break-all"
                >
                  {settings.email || ''}
                </a>
              </div>
              {affiliationText(schoolIdentity(settings), 'Affiliation Code') && (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
                  <span>{affiliationText(schoolIdentity(settings), 'Affiliation Code')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('about')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('management')}
                  className="hover:text-white transition-colors cursor-pointer text-amber-400 font-semibold"
                >
                  Our Management Team
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('academics')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Academics & Wings
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('facilities')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Campus & Facilities
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('notices')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Notice Board
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('gallery')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Photo Gallery
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('contact')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Admissions & Facilities */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Admissions & Care</h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={onOpenEnquiry}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Admission Enquiry 2026-27</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('admissions')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track Application Status
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('facilities')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  School Facilities
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('facilities')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Science & Computer Labs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateSection('facilities')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  School Transport & Bus Routes
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenMandatoryDisclosure}
                  className="text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Mandatory Public Disclosure</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Portals & Results */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Student & Staff Portals
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Access online report cards, attendance logs, academic fee receipts, and staff portals.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={onGoToResults}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Award className="w-4 h-4" />
                <span>Check Exam Result</span>
              </button>

              <button
                type="button"
                onClick={onGoToLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>Portal Login (Admin/Staff/Student)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-6 text-[11px]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-500 text-center sm:text-left">
            &copy; {new Date().getFullYear()} {settings.schoolName}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={onOpenMandatoryDisclosure}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Mandatory Disclosure
            </button>
            <span className="text-slate-800">|</span>
            <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); navigate('/privacy-policy'); }} className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
            <a href="/cookie-policy" onClick={(e) => { e.preventDefault(); navigate('/cookie-policy'); }} className="text-slate-400 hover:text-white transition-colors">Cookie Policy</a>
            <button type="button" onClick={openCookieSettings} className="text-slate-400 hover:text-white transition-colors cursor-pointer">Cookie settings</button>
            <span className="text-slate-800">|</span>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
            >
              <span>Back to Top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
