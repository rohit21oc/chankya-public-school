import React, { useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  CheckCircle,
  Quote,
  Building,
  Award,
  Sparkles,
} from 'lucide-react';
import { PublicLeadershipProfile } from '../../types';
import { schoolIdentity } from '../../utils/schoolIdentity';
import { api } from '../../services/api';
import { mediaSrc } from '../../utils/publicMedia';

/** School identity from saved School Settings (hidden when a value is not saved). */
const pub = () => schoolIdentity(api.getSettings());
const pubContacts = () => [pub().phones.join(' | '), pub().helpline ? `(Helpline: ${pub().helpline})` : ''].filter(Boolean).join(' ');
const pubNameLine = () => pub().name;

interface PublicManagementProfileModalProps {
  member: PublicLeadershipProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PublicManagementProfileModal: React.FC<PublicManagementProfileModalProps> = ({
  member,
  isOpen,
  onClose,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  const photoSrc = mediaSrc(member.photo, member.photoUrl) || null;
  const qualification = member.education || member.qualification;
  const experience = member.experience;
  const responsibilities = member.responsibilities;
  const fullBio = member.fullBio || member.message;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="management-profile-name"
    >
      {/* Backdrop click listener */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Top Navigation Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-900 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-blue-700" />
            <span>Back to Management Team</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-5 sm:p-8 md:p-10 space-y-8">
          {/* Main Profile Grid: Left Photo, Right Core Bio */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* Left Column: Portrait Photo */}
            <div className="md:col-span-5 space-y-4">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-md">
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-slate-900 text-amber-400 p-6 text-center">
                    <Building className="w-16 h-16 mb-2 opacity-50 text-white" />
                    <span className="text-2xl font-black">
                      {member.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Designation Floating Ribbon */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl text-white border border-white/20">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    Designation
                  </p>
                  <p className="text-xs sm:text-sm font-black truncate">{member.designation}</p>
                </div>
              </div>

              {/* Direct Official Contact (if provided) */}
              {(member.email || member.phone) && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Official Contact
                  </p>
                  {member.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <a
                        href={`mailto:${member.email}`}
                        className="truncate hover:text-blue-900 hover:underline"
                      >
                        {member.email}
                      </a>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <a
                        href={`tel:${member.phone}`}
                        className="truncate hover:text-emerald-900 hover:underline"
                      >
                        {member.phone}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Name, Designation, Intro, Bio */}
            <div className="md:col-span-7 space-y-5">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                  <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                  <span>{member.designation}</span>
                </span>
                <h2
                  id="management-profile-name"
                  className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight pt-2"
                >
                  {member.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-semibold pt-1">
                  RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
                </p>
              </div>

              {/* Short Bio (if present) */}
              {member.shortBio && (
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium bg-amber-50/60 p-4 rounded-xl border border-amber-200/60">
                  {member.shortBio}
                </p>
              )}

              {/* Optional Quote / Vision statement */}
              {member.quote && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                  <Quote className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm italic font-semibold text-blue-950 leading-relaxed">
                    &quot;{member.quote}&quot;
                  </p>
                </div>
              )}

              {/* Full Message / Profile Description */}
              {fullBio && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Official Message & Leadership Profile
                  </h3>
                  <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-line bg-slate-50/60 p-4 rounded-xl border border-slate-200/60">
                    {fullBio}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Structured Credentials Section (Only displayed if data exists) */}
          {(qualification || experience || responsibilities) && (
            <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Education / Qualification */}
              {qualification && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-700">
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Education & Qualification
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{qualification}</p>
                </div>
              )}

              {/* Professional Experience */}
              {experience && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-700">
                    <Award className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Professional Experience
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{experience}</p>
                </div>
              )}

              {/* Key Responsibilities */}
              {responsibilities && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Key Responsibilities
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{responsibilities}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-8 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            {pubNameLine()}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
