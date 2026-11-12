import React, { useState } from 'react';
import { Check, Flag, Search, Shield, X } from 'lucide-react';
import { HOUSE_CLUB_OPTIONS } from '../../../constants/staffFormConstants';

interface StaffHouseClubSelectorProps {
  selectedResponsibilities: string[];
  onChange: (items: string[]) => void;
  customHouseClub: string;
  onCustomHouseClubChange: (val: string) => void;
  disabled?: boolean;
}

export const StaffHouseClubSelector: React.FC<StaffHouseClubSelectorProps> = ({
  selectedResponsibilities,
  onChange,
  customHouseClub,
  onCustomHouseClubChange,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const toggleItem = (item: string) => {
    if (disabled) return;
    if (selectedResponsibilities.includes(item)) {
      onChange(selectedResponsibilities.filter((i) => i !== item));
    } else {
      onChange([...selectedResponsibilities, item]);
    }
  };

  const removeItem = (item: string) => {
    if (disabled) return;
    onChange(selectedResponsibilities.filter((i) => i !== item));
  };

  const filteredOptions = HOUSE_CLUB_OPTIONS.filter((h) =>
    h.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOtherSelected = selectedResponsibilities.includes('Other');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          House & Club Responsibility
        </label>
        <span className="text-[11px] text-slate-400">Optional multi-select</span>
      </div>

      {/* Selected Pills */}
      {selectedResponsibilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
          {selectedResponsibilities.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-medium shadow-2xs animate-in fade-in"
            >
              <Flag className="w-3 h-3 shrink-0" />
              <span>{item === 'Other' && customHouseClub.trim() ? `Other: ${customHouseClub.trim()}` : item}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  className="p-0.5 hover:bg-emerald-800 rounded-sm text-emerald-200 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search / Dropdown Trigger */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              disabled={disabled}
              placeholder="Search & allocate House / Club duties (e.g. Ganga House, Eco Club)..."
              value={searchQuery}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-hidden bg-white disabled:bg-slate-100"
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
                No matching houses or clubs found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedResponsibilities.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleItem(opt)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
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
            Specify Custom House / Club Duty <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required={isOtherSelected}
            disabled={disabled}
            placeholder="e.g. Model United Nations (MUN) Secretary / NCC Officer"
            value={customHouseClub}
            onChange={(e) => onCustomHouseClubChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg border border-amber-300 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-hidden bg-white"
          />
        </div>
      )}
    </div>
  );
};
