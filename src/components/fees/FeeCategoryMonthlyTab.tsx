import React from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Info,
  Clock,
  Laptop,
  Trophy,
  BookOpen,
} from 'lucide-react';
import { ClassFeeConfiguration, FeeItemConfig } from '../../types';

interface FeeCategoryMonthlyTabProps {
  config: Partial<ClassFeeConfiguration>;
  onChange: (updates: Partial<ClassFeeConfiguration>) => void;
  className: string;
  section: string;
}

export const FeeCategoryMonthlyTab: React.FC<FeeCategoryMonthlyTabProps> = ({
  config,
  onChange,
  className,
  section,
}) => {
  const customItems: FeeItemConfig[] = (config.items || []).filter(
    (item) => item.category === 'MONTHLY'
  );

  const handleUpdateCustomItem = (id: string, updates: Partial<FeeItemConfig>) => {
    const updated = (config.items || []).map((it) => (it.id === id ? { ...it, ...updates } : it));
    onChange({ items: updated });
  };

  const handleAddCustomItem = () => {
    const newItem: FeeItemConfig = {
      id: `fee-mo-${Date.now()}`,
      name: 'Lab & Practical Fee',
      category: 'MONTHLY',
      frequency: 'Monthly',
      amount: 250,
      mandatory: true,
      active: true,
      dueDate: '10th of every month',
      applicableClass: className,
      applicableSection: section,
      description: 'Science, Robotics, and Language lab maintenance fee',
    };
    onChange({ items: [...(config.items || []), newItem] });
  };

  const handleDeleteCustomItem = (id: string) => {
    const updated = (config.items || []).filter((it) => it.id !== id);
    onChange({ items: updated });
  };

  // Compute Total Monthly Fee
  const schoolFee = Number(config.monthlySchoolFee) || 0;
  const tuitionFee = Number(config.monthlyTuitionFee) || 0;
  const computerFee = Number(config.computerFee) || 0;
  const sportsFee = Number(config.sportsFee) || 0;
  const customMonthlyTotal = customItems
    .filter((it) => it.active)
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const totalMonthlyFee = schoolFee + tuitionFee + computerFee + sportsFee + customMonthlyTotal;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Monthly fee</h3>
          <p className="text-sm text-slate-600">
            {className}
            {section !== 'ALL' ? ` · Section ${section}` : ' · all sections'} · billed every month, due on the 10th
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-slate-600">Total per student</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">₹{totalMonthlyFee.toLocaleString('en-IN')}<span className="text-sm font-normal text-slate-500"> / month</span></p>
        </div>
      </div>

      {/* Grid of Standard Monthly Heads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Monthly School Fee */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Monthly School Fee</h5>
                <span className="text-[10px] text-slate-400">Core academic education fee</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
              Mandatory
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Month (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-school-fee"
                type="number"
                min="0"
                step="50"
                value={config.monthlySchoolFee ?? 0}
                onChange={(e) => onChange({ monthlySchoolFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="2200"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Billing: <strong>Monthly</strong></span>
            <span>Due: <strong>10th of every month</strong></span>
          </div>
        </div>

        {/* 2. Tuition Fee */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Tuition / Remedial Fee</h5>
                <span className="text-[10px] text-slate-400">Subject tutoring or specialized instruction</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Optional / Class-Wise
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Month (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-tuition-fee"
                type="number"
                min="0"
                step="50"
                value={config.monthlyTuitionFee ?? 0}
                onChange={(e) => onChange({ monthlyTuitionFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Billing: <strong>Monthly</strong></span>
            <span>Due: <strong>10th of every month</strong></span>
          </div>
        </div>

        {/* 3. Computer / Smart Class Fee */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Computer / Smart Class Fee</h5>
                <span className="text-[10px] text-slate-400">IT lab, digital boards & coding curriculum</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
              Monthly
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Month (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-computer-fee"
                type="number"
                min="0"
                step="25"
                value={config.computerFee ?? 0}
                onChange={(e) => onChange({ computerFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="250"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Billing: <strong>Monthly</strong></span>
            <span>Status: <strong>{Number(config.computerFee) > 0 ? 'Active' : 'Not Billed'}</strong></span>
          </div>
        </div>

        {/* 4. Sports Fee */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Sports & Fitness Fee</h5>
                <span className="text-[10px] text-slate-400">Ground maintenance, equipment & coaching</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
              Monthly
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Month (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-sports-fee"
                type="number"
                min="0"
                step="25"
                value={config.sportsFee ?? 0}
                onChange={(e) => onChange({ sportsFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="150"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Billing: <strong>Monthly</strong></span>
            <span>Status: <strong>{Number(config.sportsFee) > 0 ? 'Active' : 'Not Billed'}</strong></span>
          </div>
        </div>
      </div>

      {/* Additional Custom Monthly Heads */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-bold text-slate-900 text-xs">
              Additional Monthly Fee Heads ({customItems.length})
            </h5>
            <p className="text-[11px] text-slate-500">
              Add custom recurring monthly charges like Science Lab Fee, Art & Craft, or Library maintenance.
            </p>
          </div>

          <button
            id="btn-add-monthly-fee"
            type="button"
            onClick={handleAddCustomItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Monthly Fee Head</span>
          </button>
        </div>

        {customItems.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
            No extra monthly heads. The 4 standard heads above form the routine monthly bill.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Fee Head Name</th>
                  <th className="py-2.5 px-3">Amount (₹/mo)</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3">Due Day</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Description</th>
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
                    <td className="py-2.5 px-3">
                      <select
                        value={item.frequency || 'Monthly'}
                        onChange={(e) => handleUpdateCustomItem(item.id, { frequency: e.target.value as any })}
                        className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-700"
                      >
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.dueDate || '10th of every month'}
                        onChange={(e) => handleUpdateCustomItem(item.id, { dueDate: e.target.value })}
                        className="h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-700 w-36"
                      />
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
                        placeholder="Purpose"
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
