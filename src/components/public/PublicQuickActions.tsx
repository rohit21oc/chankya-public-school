import React from 'react';
import {
  Sparkles,
  Award,
  Home,
  Bus,
  CreditCard,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { schoolIdentity } from '../../utils/schoolIdentity';
import { api } from '../../services/api';

/** School identity from saved School Settings (hidden when a value is not saved). */
const pub = () => schoolIdentity(api.getSettings());
const pubContacts = () => [pub().phones.join(' | '), pub().helpline ? `(Helpline: ${pub().helpline})` : ''].filter(Boolean).join(' ');
const pubNameLine = () => pub().name;

interface PublicQuickActionsProps {
  onOpenEnquiry: () => void;
  onGoToResults: () => void;
  onGoToHostel: () => void;
  onGoToTransport: () => void;
  onGoToFees: () => void;
  onOpenMandatoryDisclosure: () => void;
}

export const PublicQuickActions: React.FC<PublicQuickActionsProps> = ({
  onOpenEnquiry,
  onGoToResults,
  onGoToHostel,
  onGoToTransport,
  onGoToFees,
  onOpenMandatoryDisclosure,
}) => {
  const actions = [
    {
      id: 'enquiry',
      title: 'Admission Enquiry',
      desc: 'Apply online for 2026-27',
      icon: Sparkles,
      iconBg: 'bg-amber-100 text-[#D9A441]',
      borderHover: 'hover:border-[#D9A441]',
      action: onOpenEnquiry,
      isPrimary: true,
    },
    {
      id: 'results',
      title: 'Check Results',
      desc: 'Search report cards by Roll No.',
      icon: Award,
      iconBg: 'bg-blue-100 text-[#123B8C]',
      borderHover: 'hover:border-[#123B8C]',
      action: onGoToResults,
    },
    {
      id: 'hostel',
      title: 'Residential Hostel',
      desc: '24×7 Boarding & Care',
      icon: Home,
      iconBg: 'bg-emerald-100 text-[#16803C]',
      borderHover: 'hover:border-[#16803C]',
      action: onGoToHostel,
    },
    {
      id: 'transport',
      title: 'School Transport',
      desc: 'GPS Enabled Bus Routes',
      icon: Bus,
      iconBg: 'bg-indigo-100 text-indigo-700',
      borderHover: 'hover:border-indigo-600',
      action: onGoToTransport,
    },
    {
      id: 'fees',
      title: 'Fee Guidelines',
      desc: 'Transparent Annual Schedule',
      icon: CreditCard,
      iconBg: 'bg-sky-100 text-sky-800',
      borderHover: 'hover:border-sky-600',
      action: onGoToFees,
    },
    {
      id: 'disclosure',
      title: 'Mandatory Disclosure',
      desc: 'Affiliation & public disclosure',
      icon: ShieldCheck,
      iconBg: 'bg-slate-100 text-slate-800',
      borderHover: 'hover:border-slate-600',
      action: onOpenMandatoryDisclosure,
    },
  ];

  return (
    <section className="relative z-30 -mt-7 sm:-mt-9 max-w-7xl mx-auto px-4 sm:px-6">
      {/* 6 in one row on desktop, 3+3 on tablet, 2 columns on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              type="button"
              onClick={act.action}
              className={`p-3.5 sm:p-4 rounded-xl bg-white border border-[#E4E7EC] text-left transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-1 flex flex-col justify-between cursor-pointer group ${
                act.borderHover
              } ${act.isPrimary ? 'ring-2 ring-[#D9A441]/40' : ''}`}
            >
              <div className="flex items-start justify-between w-full">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${act.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0B1F4B] group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="mt-3">
                <h2 className="text-xs sm:text-[13px] font-bold text-[#101828] group-hover:text-[#123B8C] transition-colors leading-tight font-heading">
                  {act.title}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-[#667085] leading-tight mt-1 line-clamp-1">
                  {act.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
