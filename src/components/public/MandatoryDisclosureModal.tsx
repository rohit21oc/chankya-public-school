import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, Building, Calendar, ExternalLink } from 'lucide-react';
import { affiliationText, schoolIdentity } from '../../utils/schoolIdentity';
import { api } from '../../services/api';

/** School identity from saved School Settings (hidden when a value is not saved). */
const pub = () => schoolIdentity(api.getSettings());
const pubContacts = () => [pub().phones.join(' | '), pub().helpline ? `(Helpline: ${pub().helpline})` : ''].filter(Boolean).join(' ');
const pubNameLine = () => [pub().name, affiliationText(pub(), 'Affiliation Code')].filter(Boolean).join(' • ');

interface MandatoryDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MandatoryDisclosureModal: React.FC<MandatoryDisclosureModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Mandatory Public Disclosure (SARAS Compliant)
              </h3>
              <p className="text-xs text-slate-500">
                {pubNameLine()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto py-4 space-y-6 text-xs text-slate-700">
          {/* General Information Table */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-700" />
              <span>A: General Information</span>
            </h4>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700 w-1/3">Name of the School</td>
                    <td className="p-2.5 font-bold text-slate-900">{pub().name || 'Not configured'}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-700">Affiliation Number / Code</td>
                    <td className="p-2.5 font-mono font-bold text-blue-700">{[pub().board, pub().affiliationNo].filter(Boolean).join(' · ') || 'Not configured'}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">School Code</td>
                    <td className="p-2.5 font-mono">{pub().schoolCode || 'Not configured'}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-700">Complete Address with PIN</td>
                    <td className="p-2.5">{pub().address || 'Not configured'}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">Principal</td>
                    <td className="p-2.5">{pub().principalName || 'Not configured'}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-700">School Contact Email</td>
                    <td className="p-2.5 font-mono text-blue-700">{pub().email || 'Not configured'}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">Contact Numbers & Helpline</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">
                      {pubContacts() || 'Not configured'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Statutory documents: shown only from verified records. Nothing is claimed here
              until the school publishes the actual documents. */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>B: Statutory Documents & Campus Details</span>
            </h4>
            <p className="text-xs text-slate-600">
              Copies of the affiliation letter, registration, NOC, building and fire safety certificates, fee structure and
              campus details are available for inspection at the school office.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {pubContacts() ? `For inspection verification, contact the school office: ${pubContacts()}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Disclosure
          </button>
        </div>
      </div>
    </div>
  );
};
