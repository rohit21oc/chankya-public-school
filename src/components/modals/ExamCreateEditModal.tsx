import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  BookOpen,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  Tag,
} from 'lucide-react';
import { validateExamSchedule } from '../../utils/examSchedule';
import { AcademicClass, Exam, ExamScheduleItem, SchoolSettings, Subject } from '../../types';
import { api } from '../../services/api';
import { getApiUrl } from '../../services/apiConfig';
import { classSectionOptions } from '../../utils/classSections';

interface ExamCreateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: Exam | null;
  onSaved: (exam: Exam) => void;
  settings: SchoolSettings;
}

const BASE_EXAM_TYPES = [
  'Quarterly Examination',
  'Half-Yearly Examination',
  'Annual Examination',
  'Unit Test',
  'Periodic Assessment',
  'Pre-Board Examination',
];

export const ExamCreateEditModal: React.FC<ExamCreateEditModalProps> = ({
  isOpen,
  onClose,
  exam,
  onSaved,
  settings,
}) => {
  // Dynamic list of active classes from API / database
  const [activeClassesList, setActiveClassesList] = useState<AcademicClass[]>(() =>
    api.getActiveClasses().filter((c) => (c.status || 'ACTIVE') === 'ACTIVE')
  );

  // Dynamic cache of active assigned subjects per class (strictly classId-specific)
  const [classAssignedSubjects, setClassAssignedSubjects] = useState<Record<string, Subject[]>>({});
  const sessions = api.getAcademicSessions();

  // Form State
  const [name, setName] = useState('');
  const [academicSession, setAcademicSession] = useState(
    settings.currentAcademicSession || '2026-2027'
  );
  const [examType, setExamType] = useState<string>('Quarterly Examination');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [section, setSection] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roomVenue, setRoomVenue] = useState('School Examination Center');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'COMPLETED'>('DRAFT');
  const [admitCardStatus, setAdmitCardStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [resultsStatus, setResultsStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [schedule, setSchedule] = useState<ExamScheduleItem[]>([]);

  // Custom Exam Types management
  const [customExamTypesList, setCustomExamTypesList] = useState<string[]>(() => {
    const fromSettings = settings.customExamTypes || api.getSettings().customExamTypes || [];
    return Array.from(new Set([...BASE_EXAM_TYPES, ...fromSettings]));
  });
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSavingType, setIsSavingType] = useState(false);

  // Timetable view filtering tab: 'ALL' or a specific classId
  const [activeTimetableTab, setActiveTimetableTab] = useState<string>('ALL');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper: Fetch ONLY active subjects mapped to a specific class from backend / database
  const fetchAssignedSubjects = async (classId: string): Promise<Subject[]> => {
    if (classAssignedSubjects[classId]) {
      return classAssignedSubjects[classId];
    }
    try {
      const res = await fetch(getApiUrl(`/api/classes/${classId}/subjects`));
      if (res.ok) {
        const subs = await res.json();
        if (Array.isArray(subs)) {
          // Strictly ACTIVE and mapped to this classId
          const activeAssigned = subs.filter(
            (s: Subject) =>
              (s.status || 'ACTIVE') === 'ACTIVE' &&
              Array.isArray(s.classIds) &&
              s.classIds.includes(classId)
          );
          // Deduplicate by ID
          const uniqueSubs: Subject[] = [];
          const seen = new Set<string>();
          for (const s of activeAssigned) {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              uniqueSubs.push(s);
            }
          }
          setClassAssignedSubjects((prev) => ({ ...prev, [classId]: uniqueSubs }));
          return uniqueSubs;
        }
      }
    } catch (e) {
      console.error('[ExamModal] Error loading class subjects:', e);
    }
    // Fallback strictly matching classIds
    const fallback = api.getActiveSubjects(classId).filter(
      (s) =>
        (s.status || 'ACTIVE') === 'ACTIVE' &&
        Array.isArray(s.classIds) &&
        s.classIds.includes(classId)
    );
    const uniqueFallback: Subject[] = [];
    const seenFallback = new Set<string>();
    for (const s of fallback) {
      if (!seenFallback.has(s.id)) {
        seenFallback.add(s.id);
        uniqueFallback.push(s);
      }
    }
    setClassAssignedSubjects((prev) => ({ ...prev, [classId]: uniqueFallback }));
    return uniqueFallback;
  };

  // Helper: Retrieve subjects for class (from state or strict cache)
  const getClassAssignedSubjects = (classId: string): Subject[] => {
    if (classAssignedSubjects[classId]) {
      return classAssignedSubjects[classId];
    }
    const fallback = api.getActiveSubjects(classId).filter(
      (s) =>
        (s.status || 'ACTIVE') === 'ACTIVE' &&
        Array.isArray(s.classIds) &&
        s.classIds.includes(classId)
    );
    const uniqueFallback: Subject[] = [];
    const seen = new Set<string>();
    for (const s of fallback) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        uniqueFallback.push(s);
      }
    }
    return uniqueFallback;
  };

  // Sync state on open or exam prop changes
  useEffect(() => {
    if (!isOpen) return;

    // Dynamically fetch ALL currently active classes from server / database
    fetch(getApiUrl('/api/classes?status=ACTIVE'))
      .then((r) => (r.ok ? r.json() : null))
      .then((freshClasses) => {
        if (Array.isArray(freshClasses)) {
          const activeOnly = freshClasses.filter(
            (c: AcademicClass) => (c.status || 'ACTIVE') === 'ACTIVE'
          );
          if (activeOnly.length > 0) {
            setActiveClassesList(activeOnly);
          }
        }
      })
      .catch(() => {});

    // Refresh custom exam types list
    const fromSettings = settings.customExamTypes || api.getSettings().customExamTypes || [];
    const mergedTypes = Array.from(new Set([...BASE_EXAM_TYPES, ...fromSettings]));

    if (exam) {
      setName(exam.name || exam.title || '');
      setAcademicSession(exam.academicSession || settings.currentAcademicSession || '2026-2027');

      const curType = exam.examType || 'Half-Yearly Examination';
      if (!mergedTypes.includes(curType)) {
        mergedTypes.push(curType);
      }
      setExamType(curType);
      setCustomExamTypesList(mergedTypes);

      let initialClassIds: string[] = [];
      if (Array.isArray(exam.classIds) && exam.classIds.length > 0) {
        initialClassIds = exam.classIds;
      } else if (Array.isArray(exam.schedule) && exam.schedule.length > 0) {
        initialClassIds = Array.from(new Set(exam.schedule.map((s) => s.classId).filter(Boolean)));
      } else if (activeClassesList[0]) {
        initialClassIds = [activeClassesList[0].id];
      }

      // Strictly ACTIVE classes only
      const activeInitial = initialClassIds.filter((cid) =>
        activeClassesList.some((ac) => ac.id === cid)
      );
      const chosenClassIds =
        activeInitial.length > 0
          ? activeInitial
          : [activeClassesList[0]?.id].filter(Boolean);

      setSelectedClassIds(chosenClassIds);
      setSection(exam.section || 'ALL');
      setStartDate(exam.startDate || '');
      setEndDate(exam.endDate || '');
      setRoomVenue(exam.roomVenue || 'School Examination Center');
      setInstructions(exam.instructions || '');
      setStatus((exam.status as any) || 'DRAFT');
      setAdmitCardStatus(exam.admitCardStatus || 'DRAFT');
      setResultsStatus(exam.resultsStatus || 'DRAFT');

      // Preload assigned subjects for each selected class and strictly filter schedule
      Promise.all(chosenClassIds.map((cid) => fetchAssignedSubjects(cid))).then((results) => {
        const classSubsMap: Record<string, Subject[]> = {};
        chosenClassIds.forEach((cid, idx) => {
          classSubsMap[cid] = results[idx] || [];
        });
        const validSchedule = (exam.schedule || []).filter((item) => {
          const isClassActive = activeClassesList.some((c) => c.id === item.classId);
          if (!isClassActive) return false;
          const assigned = classSubsMap[item.classId] || getClassAssignedSubjects(item.classId);
          if (assigned.length > 0) {
            return assigned.some((s) => s.id === item.subjectId);
          }
          return false;
        });
        setSchedule(validSchedule);
      });
    } else {
      const today = new Date().toISOString().substring(0, 10);
      setName('');
      setAcademicSession(settings.currentAcademicSession || '2026-2027');
      setExamType('Quarterly Examination');
      setCustomExamTypesList(mergedTypes);

      const defaultClassId = activeClassesList[0]?.id;
      setSelectedClassIds(defaultClassId ? [defaultClassId] : []);
      setSection('ALL');
      setStartDate(today);
      setEndDate(today);
      setRoomVenue('School Examination Center');
      setInstructions(
        'Candidates must be present 15 minutes before the start of the examination in full school uniform with valid Admit Card. Electronic devices, mobile phones, and calculators are strictly prohibited.'
      );
      setStatus('DRAFT');
      setAdmitCardStatus('DRAFT');
      setResultsStatus('DRAFT');
      setSchedule([]);

      // Auto-initialize timetable for default class with its assigned active subjects
      if (defaultClassId) {
        fetchAssignedSubjects(defaultClassId).then((classSubs) => {
          if (classSubs && classSubs.length > 0) {
            const cls = activeClassesList.find((c) => c.id === defaultClassId);
            const clsName = cls?.name || 'Class';
            const baseDate = new Date(today);
            const initialRows: ExamScheduleItem[] = classSubs.map((sub, index) => {
              const paperDate = new Date(baseDate);
              paperDate.setDate(baseDate.getDate() + index * 2);
              return {
                id: `sch-${Date.now()}-${defaultClassId}-${index}`,
                classId: defaultClassId,
                className: clsName,
                section: 'ALL',
                subjectId: sub.id,
                subjectName: sub.name,
                date: paperDate.toISOString().substring(0, 10),
                startTime: '10:00 AM',
                endTime: '01:00 PM',
                maxMarks: sub.maxMarks || 100,
                passMarks: sub.passMarks || 33,
                roomNumber: 'School Examination Center',
                instructions: '',
              };
            });
            setSchedule(initialRows);
          }
        });
      }
    }
    setActiveTimetableTab('ALL');
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [exam, isOpen]);

  if (!isOpen) return null;

  // Selected classes objects (active only)
  const selectedClasses = activeClassesList.filter((c) => selectedClassIds.includes(c.id));
  const isAllActiveSelected =
    activeClassesList.length > 0 &&
    activeClassesList.every((c) => selectedClassIds.includes(c.id));

  // Toggle All Active Classes
  const handleToggleAllActive = async () => {
    if (isAllActiveSelected) {
      setSelectedClassIds([]);
      setSchedule([]);
    } else {
      const allActiveIds = activeClassesList.map((c) => c.id);
      setSelectedClassIds(allActiveIds);

      // Preload subjects and generate schedule for all active classes
      const baseDate = new Date(startDate || new Date().toISOString().substring(0, 10));
      const allGenerated: ExamScheduleItem[] = [];

      for (const cls of activeClassesList) {
        const classSubs = await fetchAssignedSubjects(cls.id);
        classSubs.forEach((sub, index) => {
          const paperDate = new Date(baseDate);
          paperDate.setDate(baseDate.getDate() + index * 2);
          allGenerated.push({
            id: `sch-${Date.now()}-${cls.id}-${index}`,
            classId: cls.id,
            className: cls.name,
            section: section || 'ALL',
            subjectId: sub.id,
            subjectName: sub.name,
            date: paperDate.toISOString().substring(0, 10),
            startTime: '10:00 AM',
            endTime: '01:00 PM',
            maxMarks: sub.maxMarks || 100,
            passMarks: sub.passMarks || 33,
            roomNumber: roomVenue || 'School Examination Center',
            instructions: '',
          });
        });
      }

      setSchedule(allGenerated);
    }
  };

  // Toggle individual class with dynamic subject reload from backend
  const handleToggleClass = async (classId: string) => {
    const isSelected = selectedClassIds.includes(classId);
    if (isSelected) {
      setSelectedClassIds((prev) => prev.filter((id) => id !== classId));
      setSchedule((prev) => prev.filter((s) => s.classId !== classId));
    } else {
      setSelectedClassIds((prev) => [...prev, classId]);

      // Dynamically reload assigned subjects from database
      const assigned = await fetchAssignedSubjects(classId);

      // If class timetable has no rows yet, populate exactly with its assigned active subjects
      if (assigned.length > 0) {
        setSchedule((prev) => {
          if (prev.some((s) => s.classId === classId)) return prev;

          const cls = activeClassesList.find((c) => c.id === classId);
          const clsName = cls?.name || 'Class';
          const baseDate = new Date(startDate || new Date().toISOString().substring(0, 10));

          const newRows: ExamScheduleItem[] = assigned.map((sub, index) => {
            const paperDate = new Date(baseDate);
            paperDate.setDate(baseDate.getDate() + index * 2);
            return {
              id: `sch-${Date.now()}-${classId}-${index}`,
              classId,
              className: clsName,
              section: section || 'ALL',
              subjectId: sub.id,
              subjectName: sub.name,
              date: paperDate.toISOString().substring(0, 10),
              startTime: '10:00 AM',
              endTime: '01:00 PM',
              maxMarks: sub.maxMarks || 100,
              passMarks: sub.passMarks || 33,
              roomNumber: roomVenue || 'School Examination Center',
              instructions: '',
            };
          });

          return [...prev, ...newRows];
        });
      }
    }
  };

  // Add custom exam type handler
  const handleSaveCustomExamType = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    setIsSavingType(true);
    try {
      const updatedTypes = await api.addCustomExamType(trimmed);
      const combined = Array.from(new Set([...customExamTypesList, ...updatedTypes, trimmed]));
      setCustomExamTypesList(combined);
      setExamType(trimmed);
      setNewTypeName('');
      setShowAddTypeModal(false);
      setSuccessMessage(`Custom exam type "${trimmed}" saved.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save custom exam type');
    } finally {
      setIsSavingType(false);
    }
  };

  // Add a schedule paper row for a specific class
  const handleAddScheduleRowForClass = async (classId: string) => {
    const cls = activeClassesList.find((c) => c.id === classId);
    if (!cls) return;

    const availableSubs = await fetchAssignedSubjects(classId);
    if (availableSubs.length === 0) {
      setErrorMessage(`No subjects assigned to ${cls.name}.`);
      return;
    }

    const scheduledSubIds = schedule
      .filter((s) => s.classId === classId)
      .map((s) => s.subjectId);
    const unusedSub = availableSubs.find((s) => !scheduledSubIds.includes(s.id)) || availableSubs[0];

    const newItem: ExamScheduleItem = {
      id: `sch-${Date.now()}-${classId}-${Math.random().toString(36).substring(7)}`,
      classId: cls.id,
      className: cls.name,
      section: section || 'ALL',
      subjectId: unusedSub.id,
      subjectName: unusedSub.name,
      date: startDate || new Date().toISOString().substring(0, 10),
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      maxMarks: unusedSub.maxMarks || 100,
      passMarks: unusedSub.passMarks || 33,
      roomNumber: roomVenue || 'School Examination Center',
      instructions: '',
    };

    setSchedule((prev) => [...prev, newItem]);
    setErrorMessage(null);
  };

  // Auto-populate active subjects for a single class
  const handleAutoPopulateClass = async (classId: string) => {
    const cls = activeClassesList.find((c) => c.id === classId);
    if (!cls) return;

    const classSubs = await fetchAssignedSubjects(classId);
    if (classSubs.length === 0) {
      setErrorMessage(`No subjects assigned to ${cls.name}.`);
      return;
    }

    const baseDate = new Date(startDate || new Date().toISOString().substring(0, 10));
    const newItems: ExamScheduleItem[] = classSubs.map((sub, index) => {
      const examDate = new Date(baseDate);
      examDate.setDate(baseDate.getDate() + index * 2);
      return {
        id: `sch-${Date.now()}-${classId}-${index}`,
        classId: cls.id,
        className: cls.name,
        section: section || 'ALL',
        subjectId: sub.id,
        subjectName: sub.name,
        date: examDate.toISOString().substring(0, 10),
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        maxMarks: sub.maxMarks || 100,
        passMarks: sub.passMarks || 33,
        roomNumber: roomVenue || 'School Examination Center',
        instructions: '',
      };
    });

    const otherRows = schedule.filter((s) => s.classId !== classId);
    const combined = [...otherRows, ...newItems];
    setSchedule(combined);

    const allDates = combined.map((s) => s.date).sort();
    if (allDates.length > 0) {
      setEndDate(allDates[allDates.length - 1]);
    }
    setErrorMessage(null);
  };

  // Auto-populate active subjects for ALL selected classes
  const handleAutoPopulateAllSelectedClasses = async () => {
    if (selectedClasses.length === 0) {
      setErrorMessage('Please select at least one class before auto-populating schedules.');
      return;
    }

    const baseDate = new Date(startDate || new Date().toISOString().substring(0, 10));
    const allGenerated: ExamScheduleItem[] = [];

    for (const cls of selectedClasses) {
      const classSubs = await fetchAssignedSubjects(cls.id);
      classSubs.forEach((sub, index) => {
        const examDate = new Date(baseDate);
        examDate.setDate(baseDate.getDate() + index * 2);
        allGenerated.push({
          id: `sch-${Date.now()}-${cls.id}-${index}`,
          classId: cls.id,
          className: cls.name,
          section: section || 'ALL',
          subjectId: sub.id,
          subjectName: sub.name,
          date: examDate.toISOString().substring(0, 10),
          startTime: '10:00 AM',
          endTime: '01:00 PM',
          maxMarks: sub.maxMarks || 100,
          passMarks: sub.passMarks || 33,
          roomNumber: roomVenue || 'School Examination Center',
          instructions: '',
        });
      });
    }

    setSchedule(allGenerated);

    const allDates = allGenerated.map((s) => s.date).sort();
    if (allDates.length > 0) {
      setEndDate(allDates[allDates.length - 1]);
    }
    setSuccessMessage(`Auto-populated active subject schedules for ${selectedClasses.length} class(es).`);
    setTimeout(() => setSuccessMessage(null), 3000);
    setErrorMessage(null);
  };

  // Clear schedule for a specific class
  const handleClearClassSchedule = (classId: string) => {
    setSchedule(schedule.filter((s) => s.classId !== classId));
  };

  // Update a schedule item
  const handleUpdateScheduleRow = (itemId: string, field: keyof ExamScheduleItem, value: any) => {
    setSchedule((prev) =>
      prev.map((row) => {
        if (row.id !== itemId) return row;

        if (field === 'subjectId') {
          const classSubs = getClassAssignedSubjects(row.classId);
          const sub = classSubs.find((s) => s.id === value);
          return {
            ...row,
            subjectId: value,
            subjectName: sub?.name || row.subjectName,
            maxMarks: sub?.maxMarks || row.maxMarks,
            passMarks: sub?.passMarks || row.passMarks,
          };
        }

        return { ...row, [field]: value };
      })
    );
  };

  // Remove a single schedule row
  const handleRemoveScheduleRow = (itemId: string) => {
    setSchedule((prev) => prev.filter((s) => s.id !== itemId));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Please enter an Examination Name.');
      return;
    }

    if (selectedClassIds.length === 0) {
      setErrorMessage('Please select at least one Target Class for this examination.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage('Please select exam start and end dates.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMessage('Exam End Date cannot be earlier than Start Date.');
      return;
    }

    // Verify all scheduled rows belong to currently selected classes and have valid assigned subjects
    const sanitizedSchedule = schedule.filter((s) => selectedClassIds.includes(s.classId));
    const scheduleProblems = validateExamSchedule(sanitizedSchedule, { startDate, endDate });
    if (scheduleProblems.length > 0) {
      setErrorMessage(scheduleProblems.slice(0, 4).join(' '));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const examPayload: Partial<Exam> = {
      name: name.trim(),
      title: name.trim(),
      academicSession,
      examType,
      classIds: selectedClassIds,
      section,
      startDate,
      endDate,
      roomVenue,
      instructions,
      status,
      admitCardStatus,
      resultsStatus,
      schedule: sanitizedSchedule,
    };

    try {
      let saved: Exam;
      if (exam?.id) {
        saved = await api.updateExam(exam.id, examPayload);
      } else {
        saved = await api.createExam(examPayload);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save examination schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-6 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>{exam ? 'Edit Examination & Schedule' : 'Create Examination Schedule'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Notification */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section 1: General Exam Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-700" />
              <span>1. General Examination Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Exam Name */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Examination Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quarterly Examination 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Academic Session */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Academic Session</label>
                <select
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                >
                  {sessions.length > 0 ? (
                    sessions.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.status === 'ACTIVE' ? '(Current)' : ''}
                      </option>
                    ))
                  ) : (
                    <option value={settings.currentAcademicSession || '2026-2027'}>
                      {settings.currentAcademicSession || '2026-2027'}
                    </option>
                  )}
                </select>
              </div>

              {/* Exam Type */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Exam Type</label>
                  <button
                    type="button"
                    onClick={() => setShowAddTypeModal(true)}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add New Type</span>
                  </button>
                </div>
                <select
                  value={examType}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_NEW__') {
                      setShowAddTypeModal(true);
                    } else {
                      setExamType(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                >
                  {customExamTypesList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="__ADD_NEW__" className="text-blue-700 font-bold">
                    + Add New Exam Type...
                  </option>
                </select>
                {/annual|final/i.test(examType) && (
                  <p className="mt-1 text-[11px] text-blue-700">
                    When published, the yearly Exam Fee is added once to every student of the selected classes.
                  </p>
                )}
              </div>

              {/* Section Filter */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Section</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="ALL">All sections</option>
                  {/* Sections of the selected classes (Academic Structure), not a fixed A–D list */}
                  {(() => {
                    const pool = selectedClasses.length ? selectedClasses : activeClassesList;
                    const set = new Set<string>();
                    pool.forEach((c) => classSectionOptions(c).forEach((x) => set.add(x)));
                    if (section && section !== 'ALL') set.add(section);
                    return Array.from(set)
                      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
                      .map((x) => (
                        <option key={x} value={x}>
                          Section {x}
                        </option>
                      ));
                  })()}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Venue */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Room/Venue</label>
                <input
                  type="text"
                  placeholder="e.g. School Examination Center"
                  value={roomVenue}
                  onChange={(e) => setRoomVenue(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Important Instructions</label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Candidate examination instructions..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Target Class Selection (Dynamic Active Classes) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-700" />
                <span>2. Target Class Selection</span>
                <span className="text-red-500">*</span>
              </h4>

              {/* All Active Classes Toggle */}
              <button
                type="button"
                onClick={handleToggleAllActive}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isAllActiveSelected
                    ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {isAllActiveSelected ? (
                  <CheckSquare className="w-4 h-4 text-white" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>All Active Classes ({activeClassesList.length})</span>
              </button>
            </div>

            {/* Class Checkbox Pills - ONLY Active Classes */}
            <div className="flex flex-wrap gap-2 pt-1">
              {activeClassesList.map((cls) => {
                const isSelected = selectedClassIds.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => handleToggleClass(cls.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-blue-700 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span>{cls.name}</span>
                  </button>
                );
              })}
            </div>

            {selectedClassIds.length === 0 && (
              <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                Please select at least one active class above to configure subject schedules.
              </p>
            )}
          </div>

          {/* Section 3: Publishing Controls */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              <span>3. Publishing Status</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Exam Schedule Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="DRAFT">DRAFT (Hidden)</option>
                  <option value="PUBLISHED">PUBLISHED (Visible)</option>
                  <option value="COMPLETED">COMPLETED (Concluded)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admit Card Status</label>
                <select
                  value={admitCardStatus}
                  onChange={(e) => setAdmitCardStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="DRAFT">DRAFT (Withheld)</option>
                  <option value="PUBLISHED">PUBLISHED (Available)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Results Status</label>
                <select
                  value={resultsStatus}
                  onChange={(e) => setResultsStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="DRAFT">DRAFT (Hidden)</option>
                  <option value="PUBLISHED">PUBLISHED (Visible)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Timetable Schedule */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-700" />
                <span>4. Examination Timetable Schedule</span>
              </h4>

              <button
                type="button"
                onClick={handleAutoPopulateAllSelectedClasses}
                disabled={selectedClasses.length === 0}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-800 font-semibold text-xs border border-indigo-200 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Auto-Populate All Classes</span>
              </button>
            </div>

            {/* Class Selector Filter when multiple classes are selected */}
            {selectedClasses.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 mr-1">Class:</span>
                <button
                  type="button"
                  onClick={() => setActiveTimetableTab('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTimetableTab === 'ALL'
                      ? 'bg-blue-700 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Selected ({selectedClasses.length})
                </button>
                {selectedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setActiveTimetableTab(cls.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeTimetableTab === cls.id
                        ? 'bg-blue-700 text-white font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cls.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Class-Wise Timetables */}
            {selectedClasses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No Target Classes Selected</p>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedClasses
                  .filter((cls) => activeTimetableTab === 'ALL' || activeTimetableTab === cls.id)
                  .map((cls) => {
                    const classPapers = schedule.filter((s) => s.classId === cls.id);
                    const classSubjects = getClassAssignedSubjects(cls.id);

                    return (
                      <div
                        key={cls.id}
                        className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3"
                      >
                        {/* Class Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-700"></span>
                            <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                              {cls.name} — Examination Schedule
                            </h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAutoPopulateClass(cls.id)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              <span>Auto-Populate {cls.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddScheduleRowForClass(cls.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Subject Paper</span>
                            </button>
                            {classPapers.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearClassSchedule(cls.id)}
                                className="px-2 py-1 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Papers Table */}
                        {classSubjects.length === 0 ? (
                          <div className="p-6 text-center bg-white rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs">
                            <p className="font-semibold text-slate-700">No subjects assigned</p>
                          </div>
                        ) : classPapers.length === 0 ? (
                          <div className="p-6 text-center bg-white rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs">
                            <p className="font-semibold text-slate-700">
                              No examination schedule configured for {cls.name}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Click &quot;Auto-Populate {cls.name}&quot; or &quot;+ Add Subject Paper&quot; to configure timetable.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5">Subject</th>
                                  <th className="p-2.5 w-20">Section</th>
                                  <th className="p-2.5">Exam Date</th>
                                  <th className="p-2.5 w-24">Start</th>
                                  <th className="p-2.5 w-24">End</th>
                                  <th className="p-2.5 w-16 text-center">Max</th>
                                  <th className="p-2.5 w-16 text-center">Pass</th>
                                  <th className="p-2.5">Room/Venue</th>
                                  <th className="p-2.5 text-right w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {classPapers.map((row) => (
                                  <tr key={row.id} className="hover:bg-slate-50">
                                    {/* Subject */}
                                    <td className="p-2">
                                      <select
                                        value={row.subjectId}
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(row.id!, 'subjectId', e.target.value)
                                        }
                                        className="w-48 px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                                      >
                                        {classSubjects.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.name} ({s.code})
                                          </option>
                                        ))}
                                      </select>
                                    </td>

                                    {/* Section */}
                                    <td className="p-2">
                                      <select
                                        value={row.section || 'ALL'}
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(row.id!, 'section', e.target.value)
                                        }
                                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-medium text-slate-900"
                                      >
                                        <option value="ALL">ALL</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                      </select>
                                    </td>

                                    {/* Exam Date */}
                                    <td className="p-2">
                                      <input
                                        type="date"
                                        required
                                        value={row.date}
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(row.id!, 'date', e.target.value)
                                        }
                                        className="w-32 px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                                      />
                                    </td>

                                    {/* Start */}
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={row.startTime}
                                        placeholder="10:00 AM"
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(row.id!, 'startTime', e.target.value)
                                        }
                                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-center font-medium"
                                      />
                                    </td>

                                    {/* End */}
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={row.endTime}
                                        placeholder="01:00 PM"
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(row.id!, 'endTime', e.target.value)
                                        }
                                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-center font-medium"
                                      />
                                    </td>

                                    {/* Max */}
                                    <td className="p-2 text-center">
                                      <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={row.maxMarks}
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(
                                            row.id!,
                                            'maxMarks',
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-16 px-1 py-1 bg-white border border-slate-300 rounded text-center font-bold"
                                      />
                                    </td>

                                    {/* Pass */}
                                    <td className="p-2 text-center">
                                      <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={row.passMarks}
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(
                                            row.id!,
                                            'passMarks',
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-16 px-1 py-1 bg-white border border-slate-300 rounded text-center font-bold text-red-700"
                                      />
                                    </td>

                                    {/* Room/Venue */}
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        placeholder="Room / Hall"
                                        value={row.roomNumber || ''}
                                        onChange={(e) =>
                                          handleUpdateScheduleRow(row.id!, 'roomNumber', e.target.value)
                                        }
                                        className="w-32 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                      />
                                    </td>

                                    {/* Delete */}
                                    <td className="p-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveScheduleRow(row.id!)}
                                        className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                        title="Remove Paper"
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
                    );
                  })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Total Scheduled Papers: <strong>{schedule.length}</strong> across{' '}
              <strong>{selectedClasses.length}</strong> class(es).
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-700/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Saving to Database...'
                    : exam
                    ? 'Update Examination'
                    : 'Save & Create Examination'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Custom Exam Type Modal */}
        {showAddTypeModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-sm">Add New Exam Type</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddTypeModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCustomExamType} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Exam Type Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Pre-Board Examination"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTypeModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingType || !newTypeName.trim()}
                    className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                  >
                    {isSavingType ? 'Saving...' : 'Save & Select'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
