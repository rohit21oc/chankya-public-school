import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Sparkles,
  Layers,
  Calendar,
  FileText,
  Bus,
  Building,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  RotateCcw,
  Save,
  Info,
} from 'lucide-react';
import { ClassFeeConfiguration, TransportSlab, AcademicClass } from '../../types';
import { api } from '../../services/api';
import { FeeSetupSelectionBar } from './FeeSetupSelectionBar';
import { FeeCategoryGeneralTab } from './FeeCategoryGeneralTab';
import { FeeCategoryMonthlyTab } from './FeeCategoryMonthlyTab';
import { FeeCategoryYearlyTab } from './FeeCategoryYearlyTab';
import { FeeCategoryExamTab } from './FeeCategoryExamTab';
import { FeeCategoryTransportTab } from './FeeCategoryTransportTab';
import { FeeCategoryHostelTab } from './FeeCategoryHostelTab';
import { FeeSetupSummaryTab } from './FeeSetupSummaryTab';
import { CopyFeeConfigModal } from './CopyFeeConfigModal';

type FeeTabType =
  | 'ONE_TIME'
  | 'MONTHLY'
  | 'YEARLY'
  | 'EXAM'
  | 'TRANSPORT'
  | 'HOSTEL'
  | 'SUMMARY';

const AVAILABLE_SESSIONS = ['2026-2027', '2025-2026', '2027-2028'];

export const ClassFeeConfigPanel: React.FC = () => {
  const [classes, setClasses] = useState<AcademicClass[]>(() => api.getClassesSync());
  const [transportSlabs, setTransportSlabs] = useState<TransportSlab[]>(() => api.getTransportSlabsSync());
  const [allConfigs, setAllConfigs] = useState<ClassFeeConfiguration[]>(() => api.getFeeConfigurationsSync());

  // Filter selections
  const [academicSession, setAcademicSession] = useState<string>('2026-2027');
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    const cls5 = api.getClassesSync().find((c) => c.name.toLowerCase().includes('class 5'));
    return cls5 ? cls5.id : api.getClassesSync()[0]?.id || '';
  });
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<FeeTabType>('MONTHLY');

  // Form State
  const [workingConfig, setWorkingConfig] = useState<Partial<ClassFeeConfiguration>>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Copy Modal
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);

  // Load initial data from backend/database
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [fetchedClasses, fetchedConfigs, fetchedSlabs] = await Promise.all([
        api.getClasses(),
        api.getFeeConfigurations(),
        api.getTransportSlabs(),
      ]);
      setClasses(fetchedClasses);
      setAllConfigs(fetchedConfigs);
      setTransportSlabs(fetchedSlabs);
    } catch (err) {
      console.warn('Error fetching fee setup data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine current class object
  const currentClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0],
    [classes, selectedClassId]
  );

  // Check if current selection is an exact section override
  const sectionOverrideConfig = useMemo(() => {
    if (selectedSection === 'ALL') return null;
    return (
      allConfigs.find(
        (c) =>
          (c.classId === selectedClassId || c.className === currentClass?.name) &&
          c.section === selectedSection &&
          c.academicSession === academicSession &&
          (selectedCategory === 'ALL'
            ? (!c.studentCategory || c.studentCategory === 'ALL')
            : c.studentCategory === selectedCategory)
      ) ||
      allConfigs.find(
        (c) =>
          (c.classId === selectedClassId || c.className === currentClass?.name) &&
          c.section === selectedSection &&
          c.academicSession === academicSession
      ) ||
      null
    );
  }, [allConfigs, selectedClassId, currentClass, selectedSection, academicSession, selectedCategory]);

  // Check class-level default config (section === 'ALL' or empty)
  const classDefaultConfig = useMemo(() => {
    return (
      allConfigs.find(
        (c) =>
          (c.classId === selectedClassId || c.className === currentClass?.name) &&
          (!c.section || c.section === 'ALL') &&
          c.academicSession === academicSession &&
          (selectedCategory === 'ALL'
            ? (!c.studentCategory || c.studentCategory === 'ALL')
            : c.studentCategory === selectedCategory)
      ) ||
      allConfigs.find(
        (c) =>
          (c.classId === selectedClassId || c.className === currentClass?.name) &&
          (!c.section || c.section === 'ALL') &&
          c.academicSession === academicSession &&
          (!c.studentCategory || c.studentCategory === 'ALL')
      ) ||
      allConfigs.find(
        (c) =>
          (c.classId === selectedClassId || c.className === currentClass?.name) &&
          (!c.section || c.section === 'ALL') &&
          c.academicSession === academicSession
      ) ||
      allConfigs.find(
        (c) => c.classId === selectedClassId || c.className === currentClass?.name
      )
    );
  }, [allConfigs, selectedClassId, currentClass, academicSession, selectedCategory]);

  const isSectionOverride = Boolean(sectionOverrideConfig);
  const hasInheritedFromClass = Boolean(selectedSection !== 'ALL' && !isSectionOverride);

  // When class, section, session, or category changes, resolve the working configuration
  useEffect(() => {
    const resolved = api.getEffectiveFeeConfig(
      selectedClassId,
      selectedSection === 'ALL' ? undefined : selectedSection,
      academicSession,
      selectedCategory === 'ALL' ? undefined : selectedCategory
    );

    setWorkingConfig({
      ...resolved,
      classId: selectedClassId,
      className: currentClass?.name || 'Class',
      academicSession,
      section: selectedSection,
      studentCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
    });
    setIsDirty(false);
  }, [selectedClassId, selectedSection, academicSession, selectedCategory, allConfigs, currentClass]);

  const handleConfigChange = (updates: Partial<ClassFeeConfiguration>) => {
    setWorkingConfig((prev) => ({
      ...prev,
      ...updates,
    }));
    setIsDirty(true);
  };

  // Create section override explicitly
  const handleCreateSectionOverride = () => {
    if (selectedSection === 'ALL') return;
    const catSuffix = selectedCategory !== 'ALL' ? `-${selectedCategory.toLowerCase()}` : '';
    const base = { ...workingConfig };
    base.id = `fc-${selectedClassId}-${selectedSection.toLowerCase()}${catSuffix}-${academicSession}`;
    base.section = selectedSection;
    base.isSectionOverride = true;
    base.studentCategory = selectedCategory !== 'ALL' ? selectedCategory : undefined;
    base.academicSession = academicSession;
    setWorkingConfig(base);
    setIsDirty(true);
  };

  // Remove section override (reverts to class default)
  const handleRemoveSectionOverride = async () => {
    if (!sectionOverrideConfig) return;
    if (
      !window.confirm(
        `Are you sure you want to remove the Section ${selectedSection} override? It will inherit fee rates from the Class-level default.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await api.deleteFeeConfiguration(sectionOverrideConfig.id);
      const updatedList = await api.getFeeConfigurations();
      setAllConfigs(updatedList);
      setSaveSuccessMsg(`Section ${selectedSection} override removed. Now inheriting from Class default.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to remove section override:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset unsaved changes
  const handleResetChanges = () => {
    const resolved = api.getEffectiveFeeConfig(
      selectedClassId,
      selectedSection === 'ALL' ? undefined : selectedSection,
      academicSession,
      selectedCategory === 'ALL' ? undefined : selectedCategory
    );
    setWorkingConfig({
      ...resolved,
      classId: selectedClassId,
      className: currentClass?.name || 'Class',
      academicSession,
      section: selectedSection,
      studentCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
    });
    setIsDirty(false);
  };

  // Save current working configuration
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const catSuffix = selectedCategory !== 'ALL' ? `-${selectedCategory.toLowerCase()}` : '';
      const defaultId = `fc-${selectedClassId}-${(selectedSection || 'all').toLowerCase()}${catSuffix}-${academicSession}`;
      const configToSave: ClassFeeConfiguration = {
        id:
          workingConfig.id && !workingConfig.id.startsWith('fc-default')
            ? workingConfig.id
            : defaultId,
        classId: selectedClassId,
        className: currentClass?.name || 'Class',
        academicSession,
        section: selectedSection,
        isSectionOverride: selectedSection !== 'ALL',
        studentCategory: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        admissionFee: Number(workingConfig.admissionFee) || 0,
        monthlySchoolFee: Number(workingConfig.monthlySchoolFee) || 0,
        monthlyTuitionFee: Number(workingConfig.monthlyTuitionFee) || 0,
        dressCodeFee: Number(workingConfig.dressCodeFee) || 0,
        examFee: Number(workingConfig.examFee) || 0,
        computerFee: Number(workingConfig.computerFee) || 0,
        sportsFee: Number(workingConfig.sportsFee) || 0,
        booksFee: Number(workingConfig.booksFee || workingConfig.booksStationeryFee) || 0,
        booksStationeryFee: Number(workingConfig.booksFee || workingConfig.booksStationeryFee) || 0,
        idCardFee: Number(workingConfig.idCardFee) || 0,
        medicalFee: Number(workingConfig.medicalFee) || 0,
        miscFee: Number(workingConfig.miscFee) || 0,
        annualCharges: Number(workingConfig.annualCharges) || 0,
        hostelFee: Number(workingConfig.hostelFee) || 0,
        messFee: Number(workingConfig.messFee) || 0,
        items: workingConfig.items || [],
        examinationFees: workingConfig.examinationFees || [],
        hostelConfig: workingConfig.hostelConfig,
      };

      await api.saveFeeConfiguration(configToSave);
      const updatedList = await api.getFeeConfigurations();
      setAllConfigs(updatedList);
      setIsDirty(false);
      setSaveSuccessMsg(
        `Fee configuration for ${currentClass?.name || 'Class'} (${
          selectedSection === 'ALL' ? 'All Sections' : `Section ${selectedSection}`
        }${selectedCategory !== 'ALL' ? ` • ${selectedCategory}` : ''}) saved.`
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error saving fee configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate / Copy fee structure
  const handleConfirmCopy = async (target: {
    academicSession: string;
    classId: string;
    className: string;
    section: string;
    copyExams: boolean;
  }) => {
    setIsSaving(true);
    try {
      const targetConfigId = `fc-${target.classId}-${target.section}-${target.academicSession}`;
      const clonedConfig: ClassFeeConfiguration = {
        ...(workingConfig as ClassFeeConfiguration),
        id: targetConfigId,
        classId: target.classId,
        className: target.className,
        academicSession: target.academicSession,
        section: target.section,
        isSectionOverride: target.section !== 'ALL',
        examinationFees: target.copyExams ? workingConfig.examinationFees || [] : [],
      };

      await api.saveFeeConfiguration(clonedConfig);
      const updatedList = await api.getFeeConfigurations();
      setAllConfigs(updatedList);

      // Switch view to target if desired
      setSelectedClassId(target.classId);
      setSelectedSection(target.section);
      setAcademicSession(target.academicSession);

      setSaveSuccessMsg(
        `Fee structure duplicated successfully to ${target.className} (${
          target.section === 'ALL' ? 'All Sections' : `Section ${target.section}`
        }) for Session ${target.academicSession}.`
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error duplicating fee configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Selection Bar (Academic Session, Class, Section, Student Category, Hierarchy Status) */}
      <FeeSetupSelectionBar
        academicSession={academicSession}
        onSessionChange={setAcademicSession}
        availableSessions={AVAILABLE_SESSIONS}
        selectedClassId={selectedClassId}
        onClassChange={setSelectedClassId}
        classes={classes}
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        isSectionOverride={isSectionOverride}
        hasInheritedFromClass={hasInheritedFromClass}
        onCreateOverride={handleCreateSectionOverride}
        onRemoveOverride={handleRemoveSectionOverride}
        onOpenCopyModal={() => setIsCopyModalOpen(true)}
        onResetChanges={handleResetChanges}
        onSaveChanges={handleSaveChanges}
        isDirty={isDirty}
        isSaving={isSaving}
      />

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 2. Horizontal Category Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
        <button
          id="fee-tab-monthly"
          onClick={() => setActiveTab('MONTHLY')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'MONTHLY'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Monthly</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
            activeTab === 'MONTHLY' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            ₹{Number(workingConfig.monthlySchoolFee || 0) + Number(workingConfig.monthlyTuitionFee || 0)}/mo
          </span>
        </button>

        <button
          id="fee-tab-onetime"
          onClick={() => setActiveTab('ONE_TIME')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'ONE_TIME'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Admission (one-time)</span>
        </button>

        <button
          id="fee-tab-yearly"
          onClick={() => setActiveTab('YEARLY')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'YEARLY'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Yearly</span>
        </button>

        <button
          id="fee-tab-exam"
          onClick={() => setActiveTab('EXAM')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'EXAM'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Exams</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
            activeTab === 'EXAM' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {(workingConfig.examinationFees || []).length}
          </span>
        </button>

        <button
          id="fee-tab-transport"
          onClick={() => setActiveTab('TRANSPORT')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'TRANSPORT'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          <span>Transport Slabs ({transportSlabs.length})</span>
        </button>

        <button
          id="fee-tab-hostel"
          onClick={() => setActiveTab('HOSTEL')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'HOSTEL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Hostel & Mess</span>
        </button>

        <button
          id="fee-tab-summary"
          onClick={() => setActiveTab('SUMMARY')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ml-auto cursor-pointer ${
            activeTab === 'SUMMARY'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Summary</span>
        </button>
      </div>

      {/* 3. Tab Content Renderers */}
      <div>
        {activeTab === 'ONE_TIME' && (
          <FeeCategoryGeneralTab
            config={workingConfig}
            onChange={handleConfigChange}
            className={currentClass?.name || 'Class'}
            section={selectedSection}
          />
        )}

        {activeTab === 'MONTHLY' && (
          <FeeCategoryMonthlyTab
            config={workingConfig}
            onChange={handleConfigChange}
            className={currentClass?.name || 'Class'}
            section={selectedSection}
          />
        )}

        {activeTab === 'YEARLY' && (
          <FeeCategoryYearlyTab
            config={workingConfig}
            onChange={handleConfigChange}
            className={currentClass?.name || 'Class'}
            section={selectedSection}
          />
        )}

        {activeTab === 'EXAM' && (
          <FeeCategoryExamTab
            config={workingConfig}
            onChange={handleConfigChange}
            className={currentClass?.name || 'Class'}
            section={selectedSection}
          />
        )}

        {activeTab === 'TRANSPORT' && (
          <FeeCategoryTransportTab
            slabs={transportSlabs}
            onSlabsChange={setTransportSlabs}
          />
        )}

        {activeTab === 'HOSTEL' && (
          <FeeCategoryHostelTab
            config={workingConfig}
            onChange={handleConfigChange}
            className={currentClass?.name || 'Class'}
            section={selectedSection}
          />
        )}

        {activeTab === 'SUMMARY' && (
          <FeeSetupSummaryTab
            config={workingConfig}
            className={currentClass?.name || 'Class'}
            section={selectedSection}
            transportSlabs={transportSlabs}
          />
        )}
      </div>

      {/* 4. Bottom Sticky Action Bar when dirty */}
      {isDirty && (
        <div className="sticky bottom-4 z-20 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl border border-slate-700 shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold">
              You have unsaved changes to the fee structure of{' '}
              <strong>
                {currentClass?.name} ({selectedSection === 'ALL' ? 'All Sections' : `Section ${selectedSection}`})
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetChanges}
              className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Copy/Duplicate Modal */}
      <CopyFeeConfigModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        sourceConfig={workingConfig}
        sourceClassName={currentClass?.name || 'Class'}
        sourceSection={selectedSection}
        sourceSession={academicSession}
        classes={classes}
        availableSessions={AVAILABLE_SESSIONS}
        onConfirmCopy={handleConfirmCopy}
      />
    </div>
  );
};
