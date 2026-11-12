import React from 'react';
import {
  Building,
  Utensils,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ClassFeeConfiguration, HostelFeeConfig } from '../../types';

interface FeeCategoryHostelTabProps {
  config: Partial<ClassFeeConfiguration>;
  onChange: (updates: Partial<ClassFeeConfiguration>) => void;
  className: string;
  section: string;
}

export const FeeCategoryHostelTab: React.FC<FeeCategoryHostelTabProps> = ({
  config,
  onChange,
  className,
  section,
}) => {
  const hostelConfig: HostelFeeConfig = config.hostelConfig || {
    hostelFee: Number(config.hostelFee) || 5500,
    messFee: Number(config.messFee) || 3000,
    otherHostelCharges: 500,
    otherChargesName: 'Laundry & Room Amenities',
    frequency: 'Monthly',
    active: true,
    remarks: 'Furnished residential boarding, 4 meals daily & study supervisor',
  };

  const updateHostel = (updates: Partial<HostelFeeConfig>) => {
    const updated = { ...hostelConfig, ...updates };
    onChange({
      hostelConfig: updated,
      hostelFee: updated.hostelFee,
      messFee: updated.messFee,
    });
  };

  const totalMonthlyHostel = (hostelConfig.active ? hostelConfig.hostelFee + hostelConfig.messFee + (hostelConfig.otherHostelCharges || 0) : 0);

  return (
    <div className="space-y-5">
      {/* Notice Banner */}
      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 text-xs text-purple-950 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Building className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-purple-950">
              Hostel Boarding & Mess Dining Fee Structure
            </h4>
            <p className="text-purple-900 leading-relaxed">
              These rates apply <strong>ONLY to residential boarders</strong> who opted for Hostel during student admission and have an assigned room and bed. Day scholars are <strong>never</strong> billed for hostel or mess charges.
            </p>
          </div>
        </div>

        <div className="bg-white px-3.5 py-2 rounded-lg border border-purple-200 shadow-2xs text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Hostel Boarding</span>
          <span className="text-base font-extrabold text-purple-700">₹{totalMonthlyHostel.toLocaleString('en-IN')}/mo</span>
        </div>
      </div>

      {/* Main Hostel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Hostel Accommodation */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Hostel Room Rent</h5>
                <span className="text-[10px] text-slate-400">Airy ventilated room, bed, wardrobe</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
              Boarders Only
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Monthly Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-hostel-rent"
                type="number"
                min="0"
                step="100"
                value={hostelConfig.hostelFee}
                onChange={(e) => updateHostel({ hostelFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="5500"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Frequency: <strong>Monthly</strong></span>
          </div>
        </div>

        {/* 2. Mess & Fooding */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Mess & Dining</h5>
                <span className="text-[10px] text-slate-400">Breakfast, lunch, snacks & dinner</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
              Boarders Only
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Monthly Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-mess-charges"
                type="number"
                min="0"
                step="100"
                value={hostelConfig.messFee}
                onChange={(e) => updateHostel({ messFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="3000"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Frequency: <strong>Monthly</strong></span>
          </div>
        </div>

        {/* 3. Other Hostel Amenities */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Other Hostel Amenities</h5>
                <span className="text-[10px] text-slate-400">Laundry, generator & water heater</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Optional / Fixed
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Monthly Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-other-hostel"
                type="number"
                min="0"
                step="50"
                value={hostelConfig.otherHostelCharges ?? 500}
                onChange={(e) => updateHostel({ otherHostelCharges: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="500"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Frequency: <strong>Monthly</strong></span>
          </div>
        </div>
      </div>

      {/* Hostel Policy & Remarks Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
        <h5 className="font-bold text-slate-900 text-xs">
          Boarding Regulations & Operational Remarks
        </h5>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Hostel Remarks & Rules</label>
          <textarea
            rows={2}
            value={hostelConfig.remarks || ''}
            onChange={(e) => updateHostel({ remarks: e.target.value })}
            placeholder="e.g. 24x7 security guard, resident doctor on-call, RO purified drinking water, hot water geyser in winter"
            className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
          />
        </div>
      </div>
    </div>
  );
};
