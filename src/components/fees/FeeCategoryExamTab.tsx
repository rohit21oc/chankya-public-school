import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { ClassFeeConfiguration, ExamFeeConfig } from '../../types';

interface FeeCategoryExamTabProps {
  config: Partial<ClassFeeConfiguration>;
  onChange: (updates: Partial<ClassFeeConfiguration>) => void;
  className: string;
  section: string;
}

export const FeeCategoryExamTab: React.FC<FeeCategoryExamTabProps> = ({
  config,
  onChange,
  className,
  section,
}) => {
  const exams: ExamFeeConfig[] = config.examinationFees || [
    {
      id: 'exam-1',
      examName: 'Mid-Term / Half-Yearly Examination',
      amount: 600,
      applicableClass: className,
      applicableSection: section || 'ALL',
      dueDate: '2026-09-15',
      frequency: 'One-Time/Event Based',
      required: true,
      active: true,
      remarks: 'Answer sheets, printed question papers & evaluation fee',
    },
    {
      id: 'exam-2',
      examName: 'Annual Final Examination',
      amount: 800,
      applicableClass: className,
      applicableSection: section || 'ALL',
      dueDate: '2027-02-15',
      frequency: 'One-Time/Event Based',
      required: true,
      active: true,
      remarks: 'Comprehensive terminal board & report card printing',
    },
  ];

  const [showAddForm, setShowAddForm] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newAmount, setNewAmount] = useState<number>(500);
  const [newDueDate, setNewDueDate] = useState('2026-11-20');
  const [newRequired, setNewRequired] = useState(true);
  const [newRemarks, setNewRemarks] = useState('');

  const handleUpdateExam = (id: string, updates: Partial<ExamFeeConfig>) => {
    const updated = exams.map((ex) => (ex.id === id ? { ...ex, ...updates } : ex));
    onChange({ examinationFees: updated });
  };

  const handleDeleteExam = (id: string) => {
    const updated = exams.filter((ex) => ex.id !== id);
    onChange({ examinationFees: updated });
  };

  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) return;

    const newExam: ExamFeeConfig = {
      id: `exam-${Date.now()}`,
      examName: newExamName.trim(),
      amount: Number(newAmount) || 0,
      applicableClass: className,
      applicableSection: section || 'ALL',
      dueDate: newDueDate,
      frequency: 'One-Time/Event Based',
      required: newRequired,
      active: true,
      remarks: newRemarks || 'Examination fee',
    };

    onChange({ examinationFees: [...exams, newExam] });
    setNewExamName('');
    setNewAmount(500);
    setNewRemarks('');
    setShowAddForm(false);
  };

  const totalActiveExamFees = exams
    .filter((e) => e.active)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Informational Header */}
      <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-700" />
            <span>Examination-Based Fees ({className} {section !== 'ALL' ? `Sec ${section}` : 'Default'})</span>
          </h4>
          <p className="text-slate-600 mt-1">
            Event-based fees billed specifically prior to term exams, practicals, or unit assessments.
          </p>
        </div>
        <div className="bg-white px-3.5 py-2 rounded-lg border border-indigo-200 shadow-2xs text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Active Exam Fees</span>
          <span className="text-base font-extrabold text-indigo-700">₹{totalActiveExamFees.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Exam Fees Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-bold text-slate-900 text-xs">
              Configured Examination Fees ({exams.length})
            </h5>
            <p className="text-[11px] text-slate-500">
              Exam fee schedules linked to this class curriculum.
            </p>
          </div>

          <button
            id="btn-add-exam-fee"
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Close Form' : 'Add Examination Fee'}</span>
          </button>
        </div>

        {/* Add Exam Form Drawer */}
        {showAddForm && (
          <form onSubmit={handleAddExam} className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-3 text-xs">
            <h6 className="font-bold text-indigo-950 text-xs">New Examination Fee Head</h6>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Exam / Test Name *</label>
                <input
                  type="text"
                  required
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="e.g. Term 1 Periodic Assessment"
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Fee Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="50"
                  value={newAmount}
                  onChange={(e) => setNewAmount(Number(e.target.value) || 0)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Requirement Type</label>
                <select
                  value={newRequired ? 'YES' : 'NO'}
                  onChange={(e) => setNewRequired(e.target.value === 'YES')}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                >
                  <option value="YES">Mandatory (All Students)</option>
                  <option value="NO">Optional / Elective</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">Remarks / Purpose</label>
                <input
                  type="text"
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  placeholder="e.g. Practical lab exam & external examiner charges"
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-indigo-700 text-white text-xs font-bold hover:bg-indigo-800 cursor-pointer"
              >
                Save Exam Fee Head
              </button>
            </div>
          </form>
        )}

        {exams.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
            No examination fees configured for this class.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Exam Name</th>
                  <th className="py-2.5 px-3">Amount (₹)</th>
                  <th className="py-2.5 px-3">Applicable Scope</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Requirement</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <input
                        type="text"
                        value={ex.examName}
                        onChange={(e) => handleUpdateExam(ex.id, { examName: e.target.value })}
                        className="h-8 px-2.5 rounded border border-slate-300 text-xs font-semibold text-slate-900 w-48"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <input
                        type="number"
                        min="0"
                        value={ex.amount}
                        onChange={(e) => handleUpdateExam(ex.id, { amount: Number(e.target.value) || 0 })}
                        className="h-8 px-2.5 rounded border border-slate-300 text-xs font-bold text-slate-900 w-24"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {ex.applicableClass} {ex.applicableSection !== 'ALL' ? `• Sec ${ex.applicableSection}` : '• All Sec'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <input
                        type="date"
                        value={ex.dueDate || ''}
                        onChange={(e) => handleUpdateExam(ex.id, { dueDate: e.target.value })}
                        className="h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-700 w-32"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ex.required ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ex.required ? 'Required' : 'Optional'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateExam(ex.id, { active: !ex.active })}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          ex.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ex.active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={ex.remarks || ''}
                        onChange={(e) => handleUpdateExam(ex.id, { remarks: e.target.value })}
                        placeholder="Remarks"
                        className="h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-600 w-40"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteExam(ex.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete exam fee"
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
