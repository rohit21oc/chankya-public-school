import React from 'react';
import { Building2, Check, CheckCircle2, Home, MapPin } from 'lucide-react';
import {
  ALL_INDIAN_STATES_AND_UTS,
  BIHAR_DISTRICTS,
  DEFAULT_BIHAR_DISTRICT,
  STATE_POPULAR_DISTRICTS,
} from '../../../constants/staffFormConstants';

export interface AddressState {
  permanentAddress: string;
  permanentState: string;
  permanentCity: string;
  permanentPincode: string;
  currentAddress: string;
  currentState: string;
  currentCity: string;
  currentPincode: string;
  sameAsPermanentAddress: boolean;
}

interface StaffAddressSectionProps {
  value: AddressState;
  onChange: (updater: (prev: AddressState) => AddressState) => void;
  disabled?: boolean;
}

export const StaffAddressSection: React.FC<StaffAddressSectionProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  // Handler for permanent address changes
  const updatePermanent = (field: keyof AddressState, newVal: any) => {
    onChange((prev) => {
      const next: AddressState = { ...prev, [field]: newVal };

      // If State changed to Bihar and city isn't in Bihar districts, default to Sheohar
      if (field === 'permanentState') {
        if (newVal === 'Bihar' && !BIHAR_DISTRICTS.includes(next.permanentCity)) {
          next.permanentCity = DEFAULT_BIHAR_DISTRICT;
        }
      }

      // If sameAsPermanentAddress is active, mirror immediately to current address
      if (next.sameAsPermanentAddress) {
        next.currentAddress = next.permanentAddress;
        next.currentState = next.permanentState;
        next.currentCity = next.permanentCity;
        next.currentPincode = next.permanentPincode;
      }

      return next;
    });
  };

  // Handler for current address changes
  const updateCurrent = (field: keyof AddressState, newVal: any) => {
    onChange((prev) => {
      const next: AddressState = { ...prev, [field]: newVal };
      if (field === 'currentState') {
        if (newVal === 'Bihar' && !BIHAR_DISTRICTS.includes(next.currentCity)) {
          next.currentCity = DEFAULT_BIHAR_DISTRICT;
        }
      }
      return next;
    });
  };

  const handleToggleSameAddress = (checked: boolean) => {
    onChange((prev) => {
      if (checked) {
        return {
          ...prev,
          sameAsPermanentAddress: true,
          currentAddress: prev.permanentAddress,
          currentState: prev.permanentState || 'Bihar',
          currentCity: prev.permanentCity || DEFAULT_BIHAR_DISTRICT,
          currentPincode: prev.permanentPincode,
        };
      }
      return {
        ...prev,
        sameAsPermanentAddress: false,
      };
    });
  };

  const isPermanentBihar = value.permanentState === 'Bihar';
  const isCurrentBihar = value.currentState === 'Bihar';

  return (
    <div className="space-y-6 pt-2">
      {/* ======================================================== */}
      {/* A. RESIDENTIAL / PERMANENT ADDRESS */}
      {/* ======================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-blue-700" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              A. Residential / Permanent Address
            </h4>
          </div>
          <span className="text-[11px] font-medium text-slate-500">Official domicile address</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Residential Address (House / Plot No, Street, Village / Colony, Landmark)
          </label>
          <textarea
            rows={2}
            disabled={disabled}
            placeholder="e.g. Ward No. 4, Main Road, Sheohar"
            value={value.permanentAddress}
            onChange={(e) => updatePermanent('permanentAddress', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white disabled:bg-slate-100"
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
              value={value.permanentState}
              onChange={(e) => updatePermanent('permanentState', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
            >
              {ALL_INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* City / District */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              City / District <span className="text-rose-600">*</span>
            </label>
            {isPermanentBihar ? (
              <select
                disabled={disabled}
                value={value.permanentCity || DEFAULT_BIHAR_DISTRICT}
                onChange={(e) => updatePermanent('permanentCity', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-white font-semibold text-blue-950 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100"
              >
                {BIHAR_DISTRICTS.map((dst) => (
                  <option key={dst} value={dst}>
                    {dst} {dst === DEFAULT_BIHAR_DISTRICT ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  disabled={disabled}
                  list="permanent-state-districts"
                  placeholder="Enter or select city/district"
                  value={value.permanentCity}
                  onChange={(e) => updatePermanent('permanentCity', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white disabled:bg-slate-100"
                />
                {STATE_POPULAR_DISTRICTS[value.permanentState] && (
                  <datalist id="permanent-state-districts">
                    {STATE_POPULAR_DISTRICTS[value.permanentState].map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                )}
              </div>
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
              value={value.permanentPincode}
              onChange={(e) => updatePermanent('permanentPincode', e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SYNCHRONIZATION CHECKBOX */}
      {/* ======================================================== */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200">
        <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-bold text-blue-950">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value.sameAsPermanentAddress}
            onChange={(e) => handleToggleSameAddress(e.target.checked)}
            className="w-4 h-4 rounded-sm border-blue-300 text-blue-700 focus:ring-blue-600"
          />
          <span>Current address is same as Residential Address</span>
        </label>
        {value.sameAsPermanentAddress && (
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            <span>Synchronized</span>
          </span>
        )}
      </div>

      {/* ======================================================== */}
      {/* B. CURRENT ADDRESS */}
      {/* ======================================================== */}
      <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 transition-all ${
        value.sameAsPermanentAddress
          ? 'bg-slate-100/70 border-slate-200 opacity-90'
          : 'bg-slate-50/80 border-slate-200'
      }`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-700" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              B. Current Address
            </h4>
          </div>
          {value.sameAsPermanentAddress ? (
            <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Mirrored from Residential</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-500">Local stay / Communication address</span>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Current Address (House / Quarters / Hostel / Street, Area, Landmark)
          </label>
          <textarea
            rows={2}
            disabled={disabled || value.sameAsPermanentAddress}
            placeholder={
              value.sameAsPermanentAddress
                ? 'Automatically synchronized with Residential Address'
                : 'e.g. School Staff Quarters, Residential PDS Campus, Sheohar'
            }
            value={value.currentAddress}
            onChange={(e) => updateCurrent('currentAddress', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-hidden bg-white disabled:bg-slate-100 disabled:text-slate-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Current State Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              State / UT <span className="text-rose-600">*</span>
            </label>
            <select
              disabled={disabled || value.sameAsPermanentAddress}
              value={value.currentState}
              onChange={(e) => updateCurrent('currentState', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600"
            >
              {ALL_INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Current City / District */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              City / District <span className="text-rose-600">*</span>
            </label>
            {isCurrentBihar ? (
              <select
                disabled={disabled || value.sameAsPermanentAddress}
                value={value.currentCity || DEFAULT_BIHAR_DISTRICT}
                onChange={(e) => updateCurrent('currentCity', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-600"
              >
                {BIHAR_DISTRICTS.map((dst) => (
                  <option key={dst} value={dst}>
                    {dst} {dst === DEFAULT_BIHAR_DISTRICT ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  disabled={disabled || value.sameAsPermanentAddress}
                  list="current-state-districts"
                  placeholder="Enter or select city/district"
                  value={value.currentCity}
                  onChange={(e) => updateCurrent('currentCity', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-hidden bg-white disabled:bg-slate-100 disabled:text-slate-600"
                />
                {STATE_POPULAR_DISTRICTS[value.currentState] && (
                  <datalist id="current-state-districts">
                    {STATE_POPULAR_DISTRICTS[value.currentState].map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                )}
              </div>
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
              disabled={disabled || value.sameAsPermanentAddress}
              placeholder="e.g. 843329"
              value={value.currentPincode}
              onChange={(e) => updateCurrent('currentPincode', e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-hidden bg-white disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
