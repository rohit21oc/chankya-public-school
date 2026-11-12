import React, { useEffect } from 'react';
import { Home, MapPin, CheckSquare, Square, Building2 } from 'lucide-react';
import {
  ALL_INDIAN_STATES_AND_UTS,
  BIHAR_DISTRICTS,
  DEFAULT_STATE,
  DEFAULT_BIHAR_DISTRICT,
  DEFAULT_PINCODE,
} from '../../constants/indianLocations';

interface StaffAddressSectionProps {
  // Residential / Permanent Address
  residentialAddress: string;
  onResidentialAddressChange: (val: string) => void;
  residentialState: string;
  onResidentialStateChange: (val: string) => void;
  residentialCity: string;
  onResidentialCityChange: (val: string) => void;
  residentialPincode: string;
  onResidentialPincodeChange: (val: string) => void;

  // Sync Checkbox
  isCurrentSameAsResidential: boolean;
  onIsCurrentSameAsResidentialChange: (val: boolean) => void;

  // Current Address
  currentAddress: string;
  onCurrentAddressChange: (val: string) => void;
  currentState: string;
  onCurrentStateChange: (val: string) => void;
  currentCity: string;
  onCurrentCityChange: (val: string) => void;
  currentPincode: string;
  onCurrentPincodeChange: (val: string) => void;

  disabled?: boolean;
}

export const StaffAddressSection: React.FC<StaffAddressSectionProps> = ({
  residentialAddress,
  onResidentialAddressChange,
  residentialState,
  onResidentialStateChange,
  residentialCity,
  onResidentialCityChange,
  residentialPincode,
  onResidentialPincodeChange,

  isCurrentSameAsResidential,
  onIsCurrentSameAsResidentialChange,

  currentAddress,
  onCurrentAddressChange,
  currentState,
  onCurrentStateChange,
  currentCity,
  onCurrentCityChange,
  currentPincode,
  onCurrentPincodeChange,

  disabled = false,
}) => {
  // Keep Current Address synchronized whenever Residential Address changes while checkbox is checked
  useEffect(() => {
    if (isCurrentSameAsResidential) {
      onCurrentAddressChange(residentialAddress);
      onCurrentStateChange(residentialState || DEFAULT_STATE);
      onCurrentCityChange(residentialCity || DEFAULT_BIHAR_DISTRICT);
      onCurrentPincodeChange(residentialPincode || DEFAULT_PINCODE);
    }
  }, [
    isCurrentSameAsResidential,
    residentialAddress,
    residentialState,
    residentialCity,
    residentialPincode,
  ]);

  const handleToggleSameAddress = (checked: boolean) => {
    onIsCurrentSameAsResidentialChange(checked);
    if (checked) {
      onCurrentAddressChange(residentialAddress);
      onCurrentStateChange(residentialState || DEFAULT_STATE);
      onCurrentCityChange(residentialCity || DEFAULT_BIHAR_DISTRICT);
      onCurrentPincodeChange(residentialPincode || DEFAULT_PINCODE);
    }
  };

  const handleResidentialStateChange = (newState: string) => {
    onResidentialStateChange(newState);
    if (newState === 'Bihar') {
      onResidentialCityChange('Sheohar');
    } else if (residentialCity === 'Sheohar' || BIHAR_DISTRICTS.includes(residentialCity)) {
      onResidentialCityChange('');
    }
  };

  const handleCurrentStateChange = (newState: string) => {
    onCurrentStateChange(newState);
    if (newState === 'Bihar') {
      onCurrentCityChange('Sheohar');
    } else if (currentCity === 'Sheohar' || BIHAR_DISTRICTS.includes(currentCity)) {
      onCurrentCityChange('');
    }
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* A. RESIDENTIAL / PERMANENT ADDRESS */}
      {/* ======================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
          <Home className="w-4 h-4 text-blue-700" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            A. Residential / Permanent Address
          </h4>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Residential Address <span className="text-rose-600">*</span>
          </label>
          <textarea
            rows={2}
            disabled={disabled}
            placeholder="House / Flat No., Street, Mohalla / Village, Post Office"
            value={residentialAddress}
            onChange={(e) => onResidentialAddressChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* State Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              State / UT <span className="text-rose-600">*</span>
            </label>
            <select
              disabled={disabled}
              value={residentialState || DEFAULT_STATE}
              onChange={(e) => handleResidentialStateChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
            >
              {ALL_INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* City / District Dropdown or Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {residentialState === 'Bihar' ? 'District (Bihar) *' : 'City / District *'}
            </label>
            {residentialState === 'Bihar' ? (
              <select
                disabled={disabled}
                value={residentialCity || DEFAULT_BIHAR_DISTRICT}
                onChange={(e) => onResidentialCityChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
              >
                {BIHAR_DISTRICTS.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled={disabled}
                placeholder="Enter City / District name"
                value={residentialCity}
                onChange={(e) => onResidentialCityChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
              />
            )}
          </div>

          {/* PIN Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              PIN Code <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              maxLength={6}
              disabled={disabled}
              placeholder="e.g. 843329"
              value={residentialPincode}
              onChange={(e) => onResidentialPincodeChange(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SAME AS RESIDENTIAL CHECKBOX */}
      {/* ======================================================== */}
      <div className="px-4 py-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={isCurrentSameAsResidential}
            onChange={(e) => handleToggleSameAddress(e.target.checked)}
            className="w-4 h-4 rounded-sm text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs font-bold text-blue-950">
            Current address is same as Residential Address
          </span>
        </label>
        {isCurrentSameAsResidential && (
          <span className="text-[11px] font-semibold text-blue-700 hidden sm:inline-block">
            ✓ Auto-synchronized & locked
          </span>
        )}
      </div>

      {/* ======================================================== */}
      {/* B. CURRENT ADDRESS */}
      {/* ======================================================== */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
          isCurrentSameAsResidential
            ? 'bg-slate-50/50 border-slate-200 opacity-90'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-700" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              B. Current Address
            </h4>
          </div>
          {isCurrentSameAsResidential && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
              Synced with Permanent
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Current Address <span className="text-rose-600">*</span>
          </label>
          <textarea
            rows={2}
            disabled={disabled || isCurrentSameAsResidential}
            placeholder="House / Flat No., Local Street, Area, Post Office"
            value={currentAddress}
            onChange={(e) => onCurrentAddressChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Current State Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              State / UT <span className="text-rose-600">*</span>
            </label>
            <select
              disabled={disabled || isCurrentSameAsResidential}
              value={currentState || DEFAULT_STATE}
              onChange={(e) => handleCurrentStateChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-purple-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            >
              {ALL_INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Current City / District Dropdown or Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {currentState === 'Bihar' ? 'District (Bihar) *' : 'City / District *'}
            </label>
            {currentState === 'Bihar' ? (
              <select
                disabled={disabled || isCurrentSameAsResidential}
                value={currentCity || DEFAULT_BIHAR_DISTRICT}
                onChange={(e) => onCurrentCityChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-purple-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                {BIHAR_DISTRICTS.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled={disabled || isCurrentSameAsResidential}
                placeholder="Enter City / District name"
                value={currentCity}
                onChange={(e) => onCurrentCityChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
              />
            )}
          </div>

          {/* Current PIN Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              PIN Code <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              maxLength={6}
              disabled={disabled || isCurrentSameAsResidential}
              placeholder="e.g. 843329"
              value={currentPincode}
              onChange={(e) => onCurrentPincodeChange(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold focus:ring-2 focus:ring-purple-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
