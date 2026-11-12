import React from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { ClassFeeConfiguration, FeeItemConfig } from '../../types';

interface FeeCategoryGeneralTabProps {
  config: Partial<ClassFeeConfiguration>;
  onChange: (updates: Partial<ClassFeeConfiguration>) => void;
  className: string;
  section: string;
}

export const FeeCategoryGeneralTab: React.FC<FeeCategoryGeneralTabProps> = ({
  config,
  onChange,
  className,
  section,
}) => {
  const customItems: FeeItemConfig[] = (config.items || []).filter(
    (item) => item.category === 'ONE_TIME'
  );

  const handleUpdateCustomItem = (id: string, updates: Partial<FeeItemConfig>) => {
    const updated = (config.items || []).map((it) => (it.id === id ? { ...it, ...updates } : it));
    onChange({ items: updated });
  };

  const handleAddCustomItem = () => {
    const newItem: FeeItemConfig = {
      id: `fee-ot-${Date.now()}`,
      name: 'Other One-Time Charge',
      category: 'ONE_TIME',
      frequency: 'One Time',
      amount: 500,
      mandatory: false,
      active: true,
      effectiveFrom: config.effectiveFrom || '2026-04-01',
      dueDate: 'At time of admission',
      applicableClass: className,
      applicableSection: section,
      description: 'Registration, prospectus, or student kit charge',
    };
    onChange({ items: [...(config.items || []), newItem] });
  };

  const handleDeleteCustomItem = (id: string) => {
    const updated = (config.items || []).filter((it) => it.id !== id);
    onChange({ items: updated });
  };

  // Compute Subtotal of One-Time items
  const admissionFee = Number(config.admissionFee) || 0;
  const uniformFee = Number(config.dressCodeFee) || 0;
  const customSubtotal = customItems
    .filter((it) => it.active)
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalOneTime = admissionFee + uniformFee + customSubtotal;

  return (
    <div className="space-y-5">
      {/* Informative Header Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-blue-950 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>One-Time Admission & Setup Fees ({className} {section !== 'ALL' ? `Sec ${section}` : 'Default'})</span>
          </h4>
          <p className="text-slate-600 mt-1">
            Charges billed once during candidate onboarding. These fees are not part of routine monthly bills.
          </p>
        </div>
        <div className="bg-white px-3.5 py-2 rounded-lg border border-blue-200 shadow-2xs text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total One-Time Fees</span>
          <span className="text-base font-extrabold text-blue-700">₹{totalOneTime.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Standard Core One-Time Fees */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admission Fee Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h5 className="font-bold text-slate-900 text-xs">Admission Fee</h5>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Mandatory • One Time
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-admission"
                type="number"
                min="0"
                step="100"
                value={config.admissionFee ?? 0}
                onChange={(e) => onChange({ admissionFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="5000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Frequency</label>
              <input
                type="text"
                disabled
                value="One-Time (Admission)"
                className="w-full h-8 px-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Due Schedule</label>
              <input
                type="text"
                disabled
                value="At Admission Date"
                className="w-full h-8 px-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Non-refundable initial admission charge recorded in student profile upon enrollment.
          </p>
        </div>

        {/* Uniform Fee Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h5 className="font-bold text-slate-900 text-xs">Uniform / Dress Kit Fee</h5>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
              One Time
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-uniform"
                type="number"
                min="0"
                step="50"
                value={config.dressCodeFee ?? 0}
                onChange={(e) => onChange({ dressCodeFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="2200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Frequency</label>
              <input
                type="text"
                disabled
                value="One-Time (New Admission)"
                className="w-full h-8 px-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Includes</label>
              <input
                type="text"
                disabled
                value="Regular & Sports Kit"
                className="w-full h-8 px-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Covers 2 pairs of standard school uniform, 1 sports track suit, tie, badge, and belt.
          </p>
        </div>
      </div>

      {/* Custom One-Time Heads Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-bold text-slate-900 text-xs">
              Additional One-Time Fee Heads ({customItems.length})
            </h5>
            <p className="text-[11px] text-slate-500">
              Configure optional or special one-time fees like Security Deposit, Registration Kit, or Prospectus.
            </p>
          </div>

          <button
            id="btn-add-onetime-fee"
            type="button"
            onClick={handleAddCustomItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add One-Time Fee Head</span>
          </button>
        </div>

        {customItems.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
            No additional one-time heads configured. Click "+ Add One-Time Fee Head" above to create custom charges.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Fee Head Name</th>
                  <th className="py-2.5 px-3">Amount (₹)</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3">Requirement</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateCustomItem(item.id, { name: e.target.value })}
                        className="h-8 px-2.5 rounded border border-slate-300 text-xs font-semibold text-slate-900 w-44"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        value={item.amount}
                        onChange={(e) => handleUpdateCustomItem(item.id, { amount: Number(e.target.value) || 0 })}
                        className="h-8 px-2.5 rounded border border-slate-300 text-xs font-bold text-slate-900 w-24"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">One-Time</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.mandatory ? 'YES' : 'NO'}
                        onChange={(e) => handleUpdateCustomItem(item.id, { mandatory: e.target.value === 'YES' })}
                        className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-700"
                      >
                        <option value="YES">Mandatory</option>
                        <option value="NO">Optional</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateCustomItem(item.id, { active: !item.active })}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          item.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => handleUpdateCustomItem(item.id, { description: e.target.value })}
                        placeholder="Description"
                        className="h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-600 w-44"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete fee head"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
