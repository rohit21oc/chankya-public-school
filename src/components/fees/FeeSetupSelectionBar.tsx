import React from 'react';
import {
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  Copy,
  RotateCcw,
  Save,
  CheckCircle2,
  Info,
  ShieldCheck,
  Split,
  Trash2,
} from 'lucide-react';
import { AcademicClass } from '../../types';

interface FeeSetupSelectionBarProps {
  academicSession: string;
  onSessionChange: (session: string) => void;
  availableSessions: string[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  classes: AcademicClass[];
  selectedSection: string;
  onSectionChange: (section: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  isSectionOverride: boolean;
  hasInheritedFromClass: boolean;
  onCreateOverride: () => void;
  onRemoveOverride: () => void;
  onOpenCopyModal: () => void;
  onResetChanges: () => void;
  onSaveChanges: () => void;
  isDirty: boolean;
  isSaving: boolean;
}

export const FeeSetupSelectionBar: React.FC<FeeSetupSelectionBarProps> = ({
  academicSession,
  onSessionChange,
  availableSessions,
  selectedClassId,
  onClassChange,
  classes,
  selectedSection,
  onSectionChange,
  selectedCategory,
  onCategoryChange,
  isSectionOverride,
  hasInheritedFromClass,
  onCreateOverride,
  onRemoveOverride,
  onOpenCopyModal,
  onResetChanges,
  onSaveChanges,
  isDirty,
  isSaving,
}) => {
  const currentClass = classes.find((c) => c.id === selectedClassId);
  const availableSections = currentClass?.sections && currentClass.sections.length > 0
    ? currentClass.sections
    : ['A', 'B', 'C', 'D'];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Top row: Class & Session Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Academic Session */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Academic Session</span>
          </label>
          <select
            id="fee-select-academic-session"
            value={academicSession}
            onChange={(e) => onSessionChange(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {availableSessions.map((session) => (
              <option key={session} value={session}>
                Session {session}
              </option>
            ))}
          </select>
        </div>

        {/* Class Selection */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>Class</span>
          </label>
          <select
            id="fee-select-class"
            value={selectedClassId}
            onChange={(e) => onClassChange(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section Selection */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Section</span>
          </label>
          <select
            id="fee-select-section"
            value={selectedSection}
            onChange={(e) => onSectionChange(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="ALL">All sections</option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Student Category / Type */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Student Category</span>
          </label>
          <select
            id="fee-select-category"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="ALL">All students</option>
            <option value="GENERAL">General Category</option>
            <option value="RTE">RTE / Concessional Ward</option>
            <option value="STAFF_CHILD">Staff Child Concession</option>
            <option value="MANAGEMENT">Management Quota</option>
          </select>
        </div>
      </div>

      {/* Override Status Banner & Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Scope & Hierarchy Indicator */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="font-medium text-slate-700">Editing:</span>
          <span className="px-2.5 py-1 rounded-md font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
            {currentClass?.name || 'Class'}
            {selectedSection === 'ALL' ? ' • All sections' : ` • Section ${selectedSection}`}
          </span>

          {selectedSection !== 'ALL' && isSectionOverride && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
              <Split className="w-3 h-3 text-amber-700" />
              <span>Section {selectedSection} Custom Override</span>
            </span>
          )}

          {selectedSection !== 'ALL' && !isSectionOverride && hasInheritedFromClass && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <Info className="w-3 h-3 text-blue-600" />
              <span>Using the class fee (no separate fee for this section)</span>
            </span>
          )}

          {selectedSection !== 'ALL' && !isSectionOverride && (
            <button
              id="btn-create-section-override"
              type="button"
              onClick={onCreateOverride}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
              title="Create a dedicated fee configuration for this section"
            >
              <Split className="w-3 h-3" />
              <span>Customize Section {selectedSection} Fee</span>
            </button>
          )}

          {selectedSection !== 'ALL' && isSectionOverride && (
            <button
              id="btn-remove-section-override"
              type="button"
              onClick={onRemoveOverride}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
              title="Remove section override and inherit class-level default again"
            >
              <Trash2 className="w-3 h-3" />
              <span>Use class fee</span>
            </button>
          )}
        </div>

        {/* Right: Copy, Reset & Save Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Copy Structure Button */}
          <button
            id="btn-copy-fee-config"
            type="button"
            onClick={onOpenCopyModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            title="Duplicate fee configuration to another Class or Section"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy to…</span>
          </button>

          {/* Reset Changes Button */}
          {isDirty && (
            <button
              id="btn-reset-fee-changes"
              type="button"
              onClick={onResetChanges}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
          )}

          {/* Save Fee Structure Button */}
          <button
            id="btn-save-fee-config"
            type="button"
            onClick={onSaveChanges}
            disabled={isSaving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs transition-colors cursor-pointer ${
              isDirty
                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 ring-2 ring-blue-300'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
