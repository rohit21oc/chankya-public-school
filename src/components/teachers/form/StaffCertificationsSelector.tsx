import React, { useState } from 'react';
import { Award, Check, Plus, Search, X } from 'lucide-react';
import { CERTIFICATION_OPTIONS } from '../../../constants/staffFormConstants';

interface StaffCertificationsSelectorProps {
  selectedCertifications: string[];
  onChange: (certs: string[]) => void;
  customCertification: string;
  onCustomCertificationChange: (val: string) => void;
  disabled?: boolean;
}

export const StaffCertificationsSelector: React.FC<StaffCertificationsSelectorProps> = ({
  selectedCertifications,
  onChange,
  customCertification,
  onCustomCertificationChange,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const toggleCert = (cert: string) => {
    if (disabled) return;
    if (selectedCertifications.includes(cert)) {
      onChange(selectedCertifications.filter((c) => c !== cert));
    } else {
      onChange([...selectedCertifications, cert]);
    }
  };

  const removeCert = (cert: string) => {
    if (disabled) return;
    onChange(selectedCertifications.filter((c) => c !== cert));
  };

  const filteredOptions = CERTIFICATION_OPTIONS.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOtherSelected = selectedCertifications.includes('Other');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          Certifications & Professional Credentials
        </label>
        <span className="text-[11px] text-slate-400">Searchable multi-select</span>
      </div>

      {/* Selected Certification Pills */}
      {selectedCertifications.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
          {selectedCertifications.map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-700 text-white text-xs font-medium shadow-2xs animate-in fade-in"
            >
              <Award className="w-3 h-3 shrink-0" />
              <span>{cert === 'Other' && customCertification.trim() ? `Other: ${customCertification.trim()}` : cert}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeCert(cert)}
                  className="p-0.5 hover:bg-blue-800 rounded-sm text-blue-200 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Search / Toggle Trigger */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              disabled={disabled}
              placeholder="Search & select certifications (e.g. CTET, B.Ed, NEP 2020)..."
              value={searchQuery}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white disabled:bg-slate-100"
            />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shrink-0"
          >
            {isOpen ? 'Close List' : 'Browse All'}
          </button>
        </div>

        {/* Options List */}
        {isOpen && (
          <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">
                No matching certifications found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedCertifications.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleCert(opt)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-700 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Manual Entry field when "Other" is selected */}
      {isOtherSelected && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5 animate-in fade-in">
          <label className="block text-xs font-bold text-amber-950">
            Specify Custom Certification <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required={isOtherSelected}
            disabled={disabled}
            placeholder="e.g. State Level Chess Coach / Google Certified Educator"
            value={customCertification}
            onChange={(e) => onCustomCertificationChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg border border-amber-300 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden bg-white"
          />
          <p className="text-[10px] text-amber-800">
            This custom certification will be saved and displayed alongside selected qualifications.
          </p>
        </div>
      )}
    </div>
  );
};
