import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { GradeDefinition } from '../../types';
import { api } from '../../services/api';

interface GradingSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const GradingSystemModal: React.FC<GradingSystemModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [grades, setGrades] = useState<GradeDefinition[]>(() => api.getGradingSystem());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGrades(api.getGradingSystem());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGradeChange = (idx: number, field: keyof GradeDefinition, val: any) => {
    const list = [...grades];
    list[idx] = { ...list[idx], [field]: val };
    setGrades(list);
  };

  const addGradeThreshold = () => {
    const newGrade: GradeDefinition = {
      id: `grade-${Date.now()}`,
      grade: 'C',
      minPercentage: 40,
      maxPercentage: 49,
      gradePoint: 5,
      status: 'PASS',
      description: 'Average Performance',
    };
    setGrades([...grades, newGrade]);
  };

  const removeGradeThreshold = (idx: number) => {
    if (grades.length <= 1) return;
    setGrades(grades.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    try {
      api.saveGradingSystem(grades);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update grading system.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-6 overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Grading System & Thresholds</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Thresholds Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 block">Grade Ranges & Points</label>
              <button
                type="button"
                onClick={addGradeThreshold}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Grade</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="p-3 bg-slate-50 grid grid-cols-12 gap-2 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <div className="col-span-2">Grade</div>
                <div className="col-span-2">Min %</div>
                <div className="col-span-2">Max %</div>
                <div className="col-span-2">Points</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-1 text-right">Del</div>
              </div>

              {grades.map((t, idx) => (
                <div key={idx} className="p-2.5 bg-white grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={t.grade}
                      onChange={(e) => handleGradeChange(idx, 'grade', e.target.value.toUpperCase())}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-center uppercase"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={t.minPercentage}
                      onChange={(e) => handleGradeChange(idx, 'minPercentage', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={t.maxPercentage}
                      onChange={(e) => handleGradeChange(idx, 'maxPercentage', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.5"
                      value={t.gradePoint}
                      onChange={(e) => handleGradeChange(idx, 'gradePoint', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-center font-bold text-blue-900"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={t.description || ''}
                      onChange={(e) => handleGradeChange(idx, 'description', e.target.value)}
                      placeholder="e.g. Excellent"
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeGradeThreshold(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Save Grading Scheme
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
