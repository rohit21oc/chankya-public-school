import React from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Book,
  CreditCard,
  Building,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { ClassFeeConfiguration, FeeItemConfig } from '../../types';

interface FeeCategoryYearlyTabProps {
  config: Partial<ClassFeeConfiguration>;
  onChange: (updates: Partial<ClassFeeConfiguration>) => void;
  className: string;
  section: string;
}

export const FeeCategoryYearlyTab: React.FC<FeeCategoryYearlyTabProps> = ({
  config,
  onChange,
  className,
  section,
}) => {
  const customItems: FeeItemConfig[] = (config.items || []).filter(
    (item) => item.category === 'YEARLY'
  );

  const handleUpdateCustomItem = (id: string, updates: Partial<FeeItemConfig>) => {
    const updated = (config.items || []).map((it) => (it.id === id ? { ...it, ...updates } : it));
    onChange({ items: updated });
  };

  const handleAddCustomItem = () => {
    const newItem: FeeItemConfig = {
      id: `fee-yr-${Date.now()}`,
      name: 'Annual Magazine & Diary',
      category: 'YEARLY',
      frequency: 'Yearly',
      amount: 450,
      mandatory: true,
      active: true,
      dueDate: 'April (Session Start)',
      applicableClass: className,
      applicableSection: section,
      description: 'School annual handbook, calendar, and literary journal',
    };
    onChange({ items: [...(config.items || []), newItem] });
  };

  const handleDeleteCustomItem = (id: string) => {
    const updated = (config.items || []).filter((it) => it.id !== id);
    onChange({ items: updated });
  };

  // Subtotal calculation
  const booksFee = Number(config.booksFee || config.booksStationeryFee) || 0;
  const idCardFee = Number(config.idCardFee) || 0;
  const annualCharges = Number(config.annualCharges) || 0;
  const customYearlySubtotal = customItems
    .filter((it) => it.active)
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const totalYearly = booksFee + idCardFee + annualCharges + customYearlySubtotal;

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Yearly & Periodic Charges ({className} {section !== 'ALL' ? `Sec ${section}` : 'Default'})</span>
          </h4>
          <p className="text-slate-600 mt-1">
            Charges billed once or twice per session (e.g. Session start in April or Term 2 in October).
          </p>
        </div>
        <div className="bg-white px-3.5 py-2 rounded-lg border border-emerald-200 shadow-2xs text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Yearly / Periodic</span>
          <span className="text-base font-extrabold text-emerald-700">₹{totalYearly.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Grid of Standard Yearly Heads */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Books & Stationery */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Book className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Books & Stationery</h5>
                <span className="text-[10px] text-slate-400">Class textbook kit & notebooks</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Session (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-books"
                type="number"
                min="0"
                step="50"
                value={config.booksFee || config.booksStationeryFee || 0}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  onChange({ booksFee: val, booksStationeryFee: val });
                }}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="1800"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Frequency: <strong>Annual (April)</strong></span>
          </div>
        </div>

        {/* 2. ID Card & Student Kit */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">ID Card & Belt</h5>
                <span className="text-[10px] text-slate-400">RFID Smart ID badge & lanyard</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Session (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-idcard"
                type="number"
                min="0"
                step="25"
                value={config.idCardFee ?? 0}
                onChange={(e) => onChange({ idCardFee: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="200"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Frequency: <strong>Annual (April)</strong></span>
          </div>
        </div>

        {/* 3. Annual Charges / Development */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Annual Development Fee</h5>
                <span className="text-[10px] text-slate-400">Campus upkeep & infra fund</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">Amount per Session (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                id="fee-input-annual-charges"
                type="number"
                min="0"
                step="100"
                value={config.annualCharges ?? 0}
                onChange={(e) => onChange({ annualCharges: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="1000"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Frequency: <strong>Annual</strong></span>
          </div>
        </div>
      </div>

      {/* Additional Custom Yearly Heads */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-bold text-slate-900 text-xs">
              Additional Periodic / Yearly Fee Heads ({customItems.length})
            </h5>
            <p className="text-[11px] text-slate-500">
              Configure items like Annual Picnic, Cultural Fest, Alumni Fund, or Science Exhibition charges.
            </p>
          </div>

          <button
            id="btn-add-yearly-fee"
            type="button"
            onClick={handleAddCustomItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Yearly Fee Head</span>
          </button>
        </div>

        {customItems.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
            No extra yearly heads configured.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Fee Head Name</th>
                  <th className="py-2.5 px-3">Amount (₹)</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3">Due Schedule</th>
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
                        value={item.frequency || 'Yearly'}
                        onChange={(e) => handleUpdateCustomItem(item.id, { frequency: e.target.value as any })}
                        className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-700"
                      >
                        <option value="Yearly">Yearly</option>
                        <option value="Half-Yearly">Half-Yearly</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.dueDate || 'April (Session Start)'}
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
