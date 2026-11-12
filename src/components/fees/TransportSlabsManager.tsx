import React, { useState } from 'react';
import {
  Bus,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Info,
  MapPin,
} from 'lucide-react';
import { TransportSlab } from '../../types';
import { api } from '../../services/api';

interface TransportSlabsManagerProps {
  slabs: TransportSlab[];
  onSlabsUpdated: (slabs: TransportSlab[]) => void;
  academicSession?: string;
}

export const TransportSlabsManager: React.FC<TransportSlabsManagerProps> = ({
  slabs,
  onSlabsUpdated,
  academicSession = '2026-2027',
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New slab form
  const [newSlab, setNewSlab] = useState<Partial<TransportSlab>>({
    slabName: '',
    minDistanceKm: 0,
    maxDistanceKm: 5,
    monthlyFee: 1200,
    description: '',
    isActive: true,
  });

  // Inline edit form
  const [editForm, setEditForm] = useState<Partial<TransportSlab>>({});

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleStartEdit = (slab: TransportSlab) => {
    setEditingId(slab.id);
    setEditForm({
      ...slab,
      monthlyFee: slab.monthlyFee || slab.monthlyAmount || 1000,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.slabName?.trim()) {
      showNotice('Please provide a name for the distance slab.', 'error');
      return;
    }
    if ((editForm.monthlyFee ?? 0) < 0) {
      showNotice('Monthly fee cannot be negative.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateTransportSlab(id, {
        ...editForm,
        monthlyFee: Number(editForm.monthlyFee) || 0,
        monthlyAmount: Number(editForm.monthlyFee) || 0,
      });

      if (updated) {
        const updatedList = slabs.map((s) => (s.id === id ? updated : s));
        onSlabsUpdated(updatedList);
        setEditingId(null);
        showNotice('Transport slab updated successfully.');
      }
    } catch (e: any) {
      showNotice(e.message || 'Failed to update transport slab', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (slab: TransportSlab) => {
    const newStatus = !slab.isActive;
    const updated = await api.updateTransportSlab(slab.id, { isActive: newStatus });
    if (updated) {
      onSlabsUpdated(slabs.map((s) => (s.id === slab.id ? updated : s)));
      showNotice(`Slab marked as ${newStatus ? 'Active' : 'Inactive'}.`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete transport slab "${name}"?`)) return;

    setIsSaving(true);
    try {
      const ok = await api.deleteTransportSlab(id);
      if (ok) {
        onSlabsUpdated(slabs.filter((s) => s.id !== id));
        showNotice('Transport slab deleted successfully.');
      }
    } catch (e: any) {
      showNotice('Failed to delete transport slab', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlab.slabName?.trim()) {
      showNotice('Please enter a slab name or route label.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const created = await api.addTransportSlab({
        slabName: newSlab.slabName.trim(),
        name: newSlab.slabName.trim(),
        minDistanceKm: Number(newSlab.minDistanceKm) || 0,
        maxDistanceKm: Number(newSlab.maxDistanceKm) || 5,
        monthlyFee: Number(newSlab.monthlyFee) || 1200,
        monthlyAmount: Number(newSlab.monthlyFee) || 1200,
        isActive: newSlab.isActive !== false,
        academicSession,
        description: newSlab.description || '',
      });

      onSlabsUpdated([...slabs, created]);
      setIsAdding(false);
      setNewSlab({
        slabName: '',
        minDistanceKm: 0,
        maxDistanceKm: 5,
        monthlyFee: 1200,
        description: '',
        isActive: true,
      });
      showNotice('New transport slab created successfully.');
    } catch (e: any) {
      showNotice('Failed to create transport slab', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Informational Guidance */}
      <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm text-sky-950">Distance-Based Transport Fee Slabs</p>
          <p className="text-sky-800 leading-relaxed">
            Configure monthly bus fare based on distance ranges or pickup routes. When a student selects transport during admission, their monthly transport billing automatically adopts their assigned slab.
          </p>
          <p className="text-[11px] text-sky-700 font-medium pt-0.5">
            📌 Transport charges apply only to students who opt for school bus service.
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bus className="w-4 h-4 text-blue-600" />
            <span>Configured Transport Distance Slabs ({slabs.length})</span>
          </h4>
          <p className="text-xs text-slate-500">Manage route slabs, distance tiers and monthly charges</p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isAdding ? 'Close Form' : 'Add Transport Slab'}</span>
        </button>
      </div>

      {/* Add New Slab Form */}
      {isAdding && (
        <form
          onSubmit={handleCreateSlab}
          className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <h5 className="font-bold text-xs text-slate-900">
                Create New Distance / Route Slab
              </h5>
            </div>
            <span className="text-[11px] text-slate-500">Session: {academicSession}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Slab Name / Range Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 0 – 3 KM or City Route"
                value={newSlab.slabName || ''}
                onChange={(e) => setNewSlab({ ...newSlab, slabName: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Min Distance (KM)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={newSlab.minDistanceKm ?? 0}
                onChange={(e) => setNewSlab({ ...newSlab, minDistanceKm: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Max Distance (KM)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={newSlab.maxDistanceKm ?? 5}
                onChange={(e) => setNewSlab({ ...newSlab, maxDistanceKm: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Monthly Fee (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  value={newSlab.monthlyFee ?? 1200}
                  onChange={(e) => setNewSlab({ ...newSlab, monthlyFee: parseFloat(e.target.value) || 0 })}
                  required
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Description / Major Pickup Stops</label>
              <input
                type="text"
                placeholder="e.g. Civil Lines, Main Market, Clock Tower, Bus Stand"
                value={newSlab.description || ''}
                onChange={(e) => setNewSlab({ ...newSlab, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={newSlab.isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setNewSlab({ ...newSlab, isActive: e.target.value === 'ACTIVE' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ACTIVE">Active (Available for Admission)</option>
                <option value="INACTIVE">Inactive (Disabled)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              Save Slab
            </button>
          </div>
        </form>
      )}

      {/* Slabs Table / Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px]">
              <tr>
                <th className="p-3.5">Distance / Route Slab</th>
                <th className="p-3.5">Distance Range</th>
                <th className="p-3.5">Stops / Coverage</th>
                <th className="p-3.5 text-right">Monthly Fee</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {slabs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Bus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No transport slabs configured yet.</p>
                    <p className="text-[11px] mt-1">Click &quot;Add Transport Slab&quot; above to create distance tiers.</p>
                  </td>
                </tr>
              ) : (
                slabs.map((slab) => {
                  const isEditing = editingId === slab.id;

                  if (isEditing) {
                    return (
                      <tr key={slab.id} className="bg-blue-50/50">
                        <td className="p-3">
                          <input
                            type="text"
                            value={editForm.slabName || ''}
                            onChange={(e) => setEditForm({ ...editForm, slabName: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded-md font-bold text-slate-900 bg-white"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={editForm.minDistanceKm ?? 0}
                              onChange={(e) => setEditForm({ ...editForm, minDistanceKm: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="number"
                              step="0.5"
                              value={editForm.maxDistanceKm ?? 5}
                              onChange={(e) => setEditForm({ ...editForm, maxDistanceKm: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            />
                            <span className="text-slate-500 text-[10px]">KM</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Stops..."
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              value={editForm.monthlyFee ?? 1000}
                              onChange={(e) => setEditForm({ ...editForm, monthlyFee: parseFloat(e.target.value) || 0 })}
                              className="w-24 px-2 py-1 text-xs border border-blue-300 rounded font-bold text-blue-700 text-right bg-white"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              editForm.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {editForm.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(slab.id)}
                            disabled={isSaving}
                            className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={slab.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <span>{slab.slabName || slab.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">
                        {slab.minDistanceKm ?? 0} – {slab.maxDistanceKm ?? 5} KM
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                        {slab.description || slab.routeCoverage || 'Standard City Route'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-sm text-slate-900">
                        ₹{Number(slab.monthlyFee || slab.monthlyAmount || 0).toLocaleString('en-IN')}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(slab)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                            slab.isActive !== false
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {slab.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(slab)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Slab"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(slab.id, slab.slabName || slab.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Slab"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
