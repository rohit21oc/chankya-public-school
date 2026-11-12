import React from 'react';
import { Phone, Award } from 'lucide-react';
import { SchoolSettings } from '../../types';
import { schoolIdentity } from '../../utils/schoolIdentity';

interface PublicTopBarProps {
  settings?: SchoolSettings;
  onGoToResults: () => void;
  onGoToAdmission?: () => void;
}

export const PublicTopBar: React.FC<PublicTopBarProps> = ({ settings, onGoToResults, onGoToAdmission }) => {
  // Saved School Settings only; a part that is not saved is simply not shown.
  const sid = schoolIdentity(settings);
  const phone = sid.phones[0] || sid.helpline;
  const openLabel = sid.session ? `Admission Open ${sid.session}` : 'Admission Open';

  return (
    <div className="bg-[#0B1F4B] text-slate-200 text-xs py-2 px-3 sm:px-6 border-b border-[#123B8C]/60">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-x-4 gap-y-1.5 flex-wrap">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <button
            type="button"
            onClick={onGoToAdmission}
            className="inline-flex items-center gap-2 rounded-full bg-[#D9A441] px-3 py-1 text-[11px] sm:text-xs font-bold text-[#0B1F4B] hover:bg-[#F3D27A] transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="topbar-ping absolute inline-flex h-full w-full rounded-full bg-[#0B1F4B]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0B1F4B]" />
            </span>
            <span>{openLabel}</span>
          </button>

          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-white hover:text-[#F3D27A] transition-colors"
              aria-label={`Admission enquiries, call ${phone}`}
            >
              <Phone className="w-3.5 h-3.5 text-[#D9A441] shrink-0" aria-hidden="true" />
              <span className="text-slate-300">Admission enquiries</span>
              <span className="font-semibold tracking-wide tabular-nums">{phone}</span>
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={onGoToResults}
          className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#F3D27A] hover:text-white transition-colors cursor-pointer"
        >
          <Award className="w-3.5 h-3.5 text-[#D9A441] shrink-0" aria-hidden="true" />
          <span className="hover:underline">Check Result</span>
        </button>
      </div>
    </div>
  );
};
