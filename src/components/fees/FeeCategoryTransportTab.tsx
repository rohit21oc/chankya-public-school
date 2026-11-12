import React, { useState } from 'react';
import {
  Bus,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Compass,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { TransportSlab } from '../../types';
import { api } from '../../services/api';

interface FeeCategoryTransportTabProps {
  slabs: TransportSlab[];
  onSlabsChange: (slabs: TransportSlab[]) => void;
}

export const FeeCategoryTransportTab: React.FC<FeeCategoryTransportTabProps> = ({
  slabs,
  onSlabsChange,
}) => {
  const [localSlabs, setLocalSlabs] = useState<TransportSlab[]>(slabs);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New slab form
  const [newSlabName, setNewSlabName] = useState('');
  const [newMinKm, setNewMinKm] = useState<number>(0);
  const [newMaxKm, setNewMaxKm] = useState<number>(2);
  const [newMonthlyFee, setNewMonthlyFee] = useState<number>(600);
  const [newDesc, setNewDesc] = useState('');

  const handleUpdateField = (id: string, updates: Partial<TransportSlab>) => {
    const updated = localSlabs.map((s) => (s.id === id ? { ...s, ...updates } : s));
    setLocalSlabs(updated);
  };

  const handleDeleteSlab = (id: string) => {
    if (!window.confirm('Are you sure you want to remove this transport slab?')) return;
    const updated = localSlabs.filter((s) => s.id !== id);
    setLocalSlabs(updated);
  };

  const handleAddNewSlab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlabName.trim()) return;

    const newSlab: TransportSlab = {
      id: `ts-${Date.now()}`,
      slabName: newSlabName.trim(),
      minDistanceKm: Number(newMinKm) || 0,
      maxDistanceKm: Number(newMaxKm) || 1,
      monthlyFee: Number(newMonthlyFee) || 500,
      active: true,
      description: newDesc || `${newMinKm} - ${newMaxKm} KM Route`,
    };

    const updated = [...localSlabs, newSlab];
    setLocalSlabs(updated);
    setShowAddModal(false);
    setNewSlabName('');
    setNewDesc('');
  };

  const handleSaveAllSlabs = async () => {
    setIsSaving(true);
    try {
      const saved = await api.updateTransportSlabs(localSlabs);
      setLocalSlabs(saved);
      onSlabsChange(saved);
      setSaveSuccess('Transport distance slabs saved.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to save slabs:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Rule Notice */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Bus className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-950">
              Dynamic Distance-Based Transport Fee Slabs
            </h4>
            <p className="text-amber-900 leading-relaxed">
              Transport fee is <strong>distance-slab dependent</strong> and is not a fixed blanket rate. During student admission and routine monthly billing, the system charges the exact monthly amount configured for the student's assigned distance slab.
            </p>
          </div>
        </div>

        <button
          id="btn-save-slabs-top"
          type="button"
          onClick={handleSaveAllSlabs}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shrink-0 shadow-xs cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Saving Slabs...' : 'Save All Slabs'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Slabs Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-bold text-slate-900 text-xs">
              Configured Distance Slabs ({localSlabs.length})
            </h5>
            <p className="text-[11px] text-slate-500">
              Edit rates, kilometer ranges, and active status for each transit bracket.
            </p>
          </div>

          <button
            id="btn-add-slab"
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Distance Slab</span>
          </button>
        </div>

        {/* Add Slab Modal */}
        {showAddModal && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 text-xs">
            <h6 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-700" />
              <span>Add New Distance Transit Slab</span>
            </h6>
            <form onSubmit={handleAddNewSlab} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Slab Label *</label>
                  <input
                    type="text"
                    required
                    value={newSlabName}
                    onChange={(e) => setNewSlabName(e.target.value)}
                    placeholder="e.g. 7 – 10 KM"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Min Distance (KM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newMinKm}
                    onChange={(e) => setNewMinKm(Number(e.target.value) || 0)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Distance (KM)</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newMaxKm}
                    onChange={(e) => setNewMaxKm(Number(e.target.value) || 1)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Monthly Fee (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    value={newMonthlyFee}
                    onChange={(e) => setNewMonthlyFee(Number(e.target.value) || 0)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Route Coverage / Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Outer ring road stops and northern junction"
                  className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Add Slab
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Distance Slab</th>
                <th className="py-2.5 px-3">Min KM</th>
                <th className="py-2.5 px-3">Max KM</th>
                <th className="py-2.5 px-3">Monthly Charge (₹)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Coverage Description</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {localSlabs.map((slab) => (
                <tr key={slab.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={slab.slabName}
                      onChange={(e) => handleUpdateField(slab.id, { slabName: e.target.value })}
                      className="h-8 px-2.5 rounded border border-slate-300 text-xs font-bold text-slate-900 w-36"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={slab.minDistanceKm ?? 0}
                      onChange={(e) => handleUpdateField(slab.id, { minDistanceKm: Number(e.target.value) || 0 })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-800 w-16"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={slab.maxDistanceKm ?? 1}
                      onChange={(e) => handleUpdateField(slab.id, { maxDistanceKm: Number(e.target.value) || 1 })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs text-slate-800 w-16"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="relative w-28">
                      <span className="absolute left-2 top-2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={slab.monthlyFee || slab.monthlyAmount || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          handleUpdateField(slab.id, { monthlyFee: val, monthlyAmount: val });
                        }}
                        className="h-8 pl-5 pr-2 rounded border border-slate-300 text-xs font-bold text-slate-900 w-full"
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleUpdateField(slab.id, { active: slab.active === false ? true : false })}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                        slab.active !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {slab.active !== false ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={slab.description || ''}
                      onChange={(e) => handleUpdateField(slab.id, { description: e.target.value })}
                      placeholder="Route stops included"
                      className="h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-600 w-52"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteSlab(slab.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove slab"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            id="btn-save-slabs-bottom"
            type="button"
            onClick={handleSaveAllSlabs}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving to Database...' : 'Save & Sync Transport Slabs'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
