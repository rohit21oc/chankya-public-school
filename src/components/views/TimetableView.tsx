import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileEdit,
  Filter,
  GripVertical,
  HelpCircle,
  Info,
  PlusCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type { AcademicClass, TeacherStaff, TimetableSlot, User as UserType, UserRole } from '../../types';
import { api } from '../../services/api';
import { createTimetablePdf } from '../../utils/timetablePdf';
import { printPdfBlob } from '../../utils/attendanceRegisterPdf';
import { PeriodConfigModal } from '../academics/ClassSectionModals';
import { useRealtimeListener } from '../../hooks/useRealtime';

const DEFAULT_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface TimetableViewProps {
  currentUser?: UserType;
  userRole?: UserRole;
}

export const TimetableView: React.FC<TimetableViewProps> = ({ currentUser, userRole }) => {
  const schoolSettings = api.getSettings();
  const [timetableConfig, setTimetableConfig] = useState(() => api.getTimetableConfig());
  const classes = api.getClasses();
  const staff = api.getStaff();
  const subjects = api.getSubjects();

  const isTeacherUser = userRole === 'TEACHER' || currentUser?.role === 'TEACHER';
  const currentStaff = useMemo(() => {
    return staff.find(
      (s) =>
        s.id === currentUser?.id ||
        (currentUser?.employeeId && s.employeeId?.toUpperCase() === currentUser.employeeId.toUpperCase()) ||
        (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [staff, currentUser]);

  // Working days and periods
  const workingDays = useMemo(() => {
    return timetableConfig.workingDays && timetableConfig.workingDays.length > 0
      ? timetableConfig.workingDays
      : [...DEFAULT_DAYS];
  }, [timetableConfig.workingDays]);

  const periods = useMemo(() => {
    return timetableConfig.periods && timetableConfig.periods.length > 0
      ? timetableConfig.periods
      : [
          { periodNumber: 1, name: 'Period 1', startTime: '08:00 AM', endTime: '08:45 AM' },
          { periodNumber: 2, name: 'Period 2', startTime: '08:45 AM', endTime: '09:30 AM' },
          { periodNumber: 3, name: 'Period 3', startTime: '09:30 AM', endTime: '10:15 AM' },
          { periodNumber: 4, name: 'Period 4', startTime: '10:15 AM', endTime: '11:00 AM' },
          { periodNumber: 5, name: 'Recess / Break', startTime: '11:00 AM', endTime: '11:30 AM', isBreak: true, breakType: 'RECESS' as const },
          { periodNumber: 6, name: 'Period 5', startTime: '11:30 AM', endTime: '12:15 PM' },
          { periodNumber: 7, name: 'Period 6', startTime: '12:15 PM', endTime: '01:00 PM' },
          { periodNumber: 8, name: 'Period 7', startTime: '01:00 PM', endTime: '01:45 PM' },
        ];
  }, [timetableConfig.periods]);

  // Filters State
  const academicSessions = api.getAcademicSessions();
  const [academicSession, setAcademicSession] = useState<string>(
    () => api.getActiveAcademicSession()?.name || schoolSettings.currentAcademicSession || '2026-2027'
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    const class10 = classes.find((c) => c.name.toLowerCase().includes('10'));
    return class10 ? class10.id : classes[0]?.id || '';
  });
  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const [selectedSection, setSelectedSection] = useState<string>(
    selectedClass?.sections[0] || 'A'
  );

  // View Mode: Class Timetable vs Teacher View
  const [viewPerspective, setViewPerspective] = useState<'CLASS' | 'TEACHER'>(() => {
    return isTeacherUser ? 'TEACHER' : 'CLASS';
  });
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (isTeacherUser) {
      const match = staff.find(
        (s) =>
          s.id === currentUser?.id ||
          (currentUser?.employeeId && s.employeeId?.toUpperCase() === currentUser.employeeId.toUpperCase())
      );
      return match ? match.id : staff[0]?.id || '';
    }
    return staff[0]?.id || '';
  });

  // Schedule Display Sub-tab for Teacher perspective: TODAY vs WEEKLY
  const [scheduleDisplayMode, setScheduleDisplayMode] = useState<'TODAY' | 'WEEKLY'>('TODAY');

  // Master Database Slots & Editable Working Copy
  const [savedSlots, setSavedSlots] = useState<TimetableSlot[]>([]);
  const [currentSlots, setCurrentSlots] = useState<TimetableSlot[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Draft State
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [draftInfo, setDraftInfo] = useState<{ slots: TimetableSlot[]; savedAt: string } | null>(null);

  // Drag and Drop tracking
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Modal State for Adding / Editing Slots
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [slotDay, setSlotDay] = useState<string>('Monday');
  const [slotPeriod, setSlotPeriod] = useState<number>(1);
  const [slotTeacherId, setSlotTeacherId] = useState<string>(staff[0]?.id || '');
  const [slotSubjectId, setSlotSubjectId] = useState<string>(subjects[0]?.id || '');
  const [slotRoom, setSlotRoom] = useState<string>('Room 204');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Navigation Guard confirmation modal (when user switches class/section with unsaved changes)
  const [pendingSwitch, setPendingSwitch] = useState<{
    type: 'CLASS' | 'SECTION' | 'SESSION';
    value: string;
  } | null>(null);

  // Period Configuration Modal
  const [isPeriodConfigOpen, setIsPeriodConfigOpen] = useState(false);

  // Feedback Notification Banner
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load database slots & check draft whenever Class, Section, or Session changes
  const loadDatabaseData = (forceReload = false) => {
    if (!selectedClassId || !selectedSection) return;
    const dbSlots = api.getTimetable(
      selectedClassId,
      selectedSection,
      undefined,
      undefined,
      academicSession
    );
    setSavedSlots(dbSlots);
    if (!hasUnsavedChanges || forceReload) {
      setCurrentSlots(dbSlots);
      if (forceReload) setHasUnsavedChanges(false);
    }

    // Check for draft
    const draft = api.getTimetableDraft(selectedClassId, selectedSection, academicSession);
    if (draft && draft.slots && draft.slots.length > 0) {
      setHasDraft(true);
      setDraftInfo(draft);
    } else {
      setHasDraft(false);
      setDraftInfo(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    api.syncTimetable().then(() => {
      if (isMounted) {
        loadDatabaseData(true);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    loadDatabaseData(true);
  }, [selectedClassId, selectedSection, academicSession]);

  // Live real-time sync for Timetable modifications
  useRealtimeListener(['TIMETABLE', 'CLASS', 'TEACHER', 'SESSION'], () => {
    setTimetableConfig(api.getTimetableConfig());
    if (!hasUnsavedChanges) {
      loadDatabaseData(true);
    }
  });

  // Handle Class Switch with unsaved changes guard
  const handleSelectClass = (newClassId: string) => {
    if (newClassId === selectedClassId) return;
    if (hasUnsavedChanges) {
      setPendingSwitch({ type: 'CLASS', value: newClassId });
      return;
    }
    const targetCls = classes.find((c) => c.id === newClassId);
    setSelectedClassId(newClassId);
    if (targetCls && targetCls.sections.length > 0) {
      setSelectedSection(targetCls.sections[0]);
    }
  };

  // Handle Section Switch with unsaved changes guard
  const handleSelectSection = (newSec: string) => {
    if (newSec === selectedSection) return;
    if (hasUnsavedChanges) {
      setPendingSwitch({ type: 'SECTION', value: newSec });
      return;
    }
    setSelectedSection(newSec);
  };

  // Handle Session Switch with unsaved changes guard
  const handleSelectSession = (newSession: string) => {
    if (newSession === academicSession) return;
    if (hasUnsavedChanges) {
      setPendingSwitch({ type: 'SESSION', value: newSession });
      return;
    }
    setAcademicSession(newSession);
  };

  // Confirm pending switch
  const handleConfirmSwitch = async (saveFirst: boolean) => {
    if (!pendingSwitch) return;

    if (saveFirst) {
      // Validate and save
      const res = await api.saveClassTimetableAsync(
        selectedClassId,
        selectedSection,
        currentSlots,
        academicSession
      );
      if (!res.success) {
        setNotification({
          type: 'error',
          message: res.error || 'Cannot save due to conflict. Please fix or discard changes before switching.',
        });
        setPendingSwitch(null);
        return;
      }
    }

    // Apply the pending switch
    if (pendingSwitch.type === 'CLASS') {
      const targetCls = classes.find((c) => c.id === pendingSwitch.value);
      setSelectedClassId(pendingSwitch.value);
      if (targetCls && targetCls.sections.length > 0) {
        setSelectedSection(targetCls.sections[0]);
      }
    } else if (pendingSwitch.type === 'SECTION') {
      setSelectedSection(pendingSwitch.value);
    } else if (pendingSwitch.type === 'SESSION') {
      setAcademicSession(pendingSwitch.value);
    }

    setPendingSwitch(null);
  };

  // Open modal for Adding a new slot
  const handleOpenAddSlot = (day?: string, periodNumber?: number) => {
    setEditingSlot(null);
    setSlotDay(day ? api.normalizeDayOfWeek(day) : workingDays[0] || 'Monday');
    setSlotPeriod(periodNumber || 1);
    setSlotSubjectId(subjects[0]?.id || '');
    setSlotTeacherId(staff[0]?.id || '');
    setSlotRoom(`Room ${selectedClass?.name.replace(/[^0-9]/g, '') || '204'}`);
    setConflictWarning(null);
    setIsSlotModalOpen(true);
  };

  // Open modal for Editing an existing slot
  const handleOpenEditSlot = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setSlotDay(api.normalizeDayOfWeek(slot.dayOfWeek));
    setSlotPeriod(Number(slot.periodNumber));
    setSlotSubjectId(slot.subjectId);
    setSlotTeacherId(slot.teacherId);
    setSlotRoom(slot.roomNumber || 'Room 204');
    setConflictWarning(null);
    setIsSlotModalOpen(true);
  };

  // Check real-time conflicts whenever user modifies modal selections
  const checkLiveConflict = (
    teacherId: string,
    day: string,
    period: number,
    room: string,
    currentSlotId?: string
  ): string | null => {
    const normDay = api.normalizeDayOfWeek(day);

    // 1. Check against other classes in database via API (exclude current class)
    const apiConflict = api.checkTimetableConflict({
      id: currentSlotId,
      dayOfWeek: normDay,
      periodNumber: period,
      teacherId,
      roomNumber: room,
      classId: selectedClassId,
      section: selectedSection,
      excludeSameClass: true,
    });

    if (apiConflict.hasConflict) {
      return apiConflict.message || 'Timetable conflict detected.';
    }

    // 2. Check against current local slots in memory (for intra-class clashes)
    const intraClash = currentSlots.find(
      (s) =>
        (!currentSlotId || s.id !== currentSlotId) &&
        api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === normDay.toLowerCase() &&
        Number(s.periodNumber) === period
    );

    if (intraClash) {
      return `Class Conflict: A subject (${intraClash.subjectName}) is already assigned to Period ${period} on ${normDay}.`;
    }

    return null;
  };

  // Handle Save inside the Slot Modal (Add or Update)
  const handleModalSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedTeacher = staff.find((st) => st.id === slotTeacherId);
    const selectedSubject = subjects.find((sb) => sb.id === slotSubjectId);
    const selectedPeriodObj = periods.find((p) => p.periodNumber === slotPeriod);

    // Validate conflict
    const conflictMsg = checkLiveConflict(
      slotTeacherId,
      slotDay,
      slotPeriod,
      slotRoom,
      editingSlot?.id
    );

    if (conflictMsg) {
      setConflictWarning(conflictMsg);
      return;
    }

    const normDay = api.normalizeDayOfWeek(slotDay);
    const newSlotData: TimetableSlot = {
      id: editingSlot ? editingSlot.id : `temp-${Date.now()}`,
      classId: selectedClassId,
      className: selectedClass?.name || 'Class',
      section: selectedSection,
      dayOfWeek: normDay,
      periodNumber: slotPeriod,
      startTime: selectedPeriodObj?.startTime || '08:00 AM',
      endTime: selectedPeriodObj?.endTime || '08:45 AM',
      subjectId: slotSubjectId,
      subjectName: selectedSubject?.name || 'Subject',
      teacherId: slotTeacherId,
      teacherName: selectedTeacher?.name || 'Faculty',
      roomNumber: slotRoom.trim() || 'Room 204',
      academicSession,
    };

    if (editingSlot) {
      setCurrentSlots((prev) =>
        prev.map((s) => (s.id === editingSlot.id ? newSlotData : s))
      );
    } else {
      setCurrentSlots((prev) => [
        ...prev.filter(
          (s) =>
            !(
              api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === normDay.toLowerCase() &&
              Number(s.periodNumber) === slotPeriod
            )
        ),
        newSlotData,
      ]);
    }

    setHasUnsavedChanges(true);
    setIsSlotModalOpen(false);
    setConflictWarning(null);
    setNotification({
      type: 'info',
      message: `Assignment configured for ${normDay} Period ${slotPeriod} (${selectedTeacher?.name || 'Faculty'}). Click "Save Timetable" to publish.`,
    });
  };

  // Handle Delete Slot from modal or grid
  const handleDeleteSlot = (slotId: string) => {
    const slot = currentSlots.find((s) => s.id === slotId);
    setCurrentSlots((prev) => prev.filter((s) => s.id !== slotId));
    setHasUnsavedChanges(true);
    if (isSlotModalOpen) setIsSlotModalOpen(false);
    setNotification({
      type: 'info',
      message: `Removed slot (${slot?.subjectName || 'Subject'} on ${slot?.dayOfWeek || ''}). Unsaved modifications pending.`,
    });
  };

  // Drag and drop handler
  const handleDropSlot = (targetDay: string, targetPeriod: number) => {
    if (!draggedSlotId) return;
    setDragOverCell(null);

    const draggedSlot = currentSlots.find((s) => s.id === draggedSlotId);
    if (!draggedSlot) return;

    const normTargetDay = api.normalizeDayOfWeek(targetDay);
    if (
      api.normalizeDayOfWeek(draggedSlot.dayOfWeek).toLowerCase() === normTargetDay.toLowerCase() &&
      Number(draggedSlot.periodNumber) === targetPeriod
    ) {
      return; // Dropped onto same cell
    }

    const targetPeriodObj = periods.find((p) => p.periodNumber === targetPeriod);
    if (targetPeriodObj?.isBreak) {
      setNotification({
        type: 'warning',
        message: 'Cannot schedule or move classes into Break / Recess periods.',
      });
      return;
    }

    // Check if target cell has an existing slot
    const targetSlot = currentSlots.find(
      (s) =>
        api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === normTargetDay.toLowerCase() &&
        Number(s.periodNumber) === targetPeriod
    );

    if (targetSlot) {
      // SWAP: Verify conflicts for both
      const conflictA = checkLiveConflict(
        draggedSlot.teacherId,
        normTargetDay,
        targetPeriod,
        draggedSlot.roomNumber || 'Room 204',
        draggedSlot.id
      );
      const conflictB = checkLiveConflict(
        targetSlot.teacherId,
        draggedSlot.dayOfWeek,
        draggedSlot.periodNumber,
        targetSlot.roomNumber || 'Room 204',
        targetSlot.id
      );

      if (conflictA) {
        setNotification({ type: 'error', message: conflictA });
        return;
      }
      if (conflictB) {
        setNotification({ type: 'error', message: conflictB });
        return;
      }

      // Perform swap in state
      const origDay = draggedSlot.dayOfWeek;
      const origPeriod = draggedSlot.periodNumber;
      const origStart = draggedSlot.startTime;
      const origEnd = draggedSlot.endTime;

      setCurrentSlots((prev) =>
        prev.map((s) => {
          if (s.id === draggedSlot.id) {
            return {
              ...s,
              dayOfWeek: normTargetDay,
              periodNumber: targetPeriod,
              startTime: targetPeriodObj?.startTime || s.startTime,
              endTime: targetPeriodObj?.endTime || s.endTime,
            };
          }
          if (s.id === targetSlot.id) {
            return {
              ...s,
              dayOfWeek: origDay,
              periodNumber: origPeriod,
              startTime: origStart,
              endTime: origEnd,
            };
          }
          return s;
        })
      );
      setHasUnsavedChanges(true);
      setNotification({
        type: 'info',
        message: `Swapped "${draggedSlot.subjectName}" and "${targetSlot.subjectName}". Unsaved modifications pending.`,
      });
    } else {
      // MOVE to empty period
      const conflict = checkLiveConflict(
        draggedSlot.teacherId,
        normTargetDay,
        targetPeriod,
        draggedSlot.roomNumber || 'Room 204',
        draggedSlot.id
      );

      if (conflict) {
        setNotification({ type: 'error', message: conflict });
        return;
      }

      setCurrentSlots((prev) =>
        prev.map((s) => {
          if (s.id === draggedSlot.id) {
            return {
              ...s,
              dayOfWeek: normTargetDay,
              periodNumber: targetPeriod,
              startTime: targetPeriodObj?.startTime || s.startTime,
              endTime: targetPeriodObj?.endTime || s.endTime,
            };
          }
          return s;
        })
      );
      setHasUnsavedChanges(true);
      setNotification({
        type: 'info',
        message: `Moved "${draggedSlot.subjectName}" to ${normTargetDay} Period ${targetPeriod}. Unsaved modifications pending.`,
      });
    }
  };

  // Primary Action 1: SAVE TIMETABLE TO DATABASE
  const handleSaveTimetable = async () => {
    setIsSaving(true);
    try {
      const result = await api.saveClassTimetableAsync(
        selectedClassId,
        selectedSection,
        currentSlots,
        academicSession
      );

      if (!result.success) {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to save timetable due to a scheduling conflict.',
        });
        return;
      }

      // Refresh saved slots immediately from database
      const freshDbSlots = api.getTimetable(
        selectedClassId,
        selectedSection,
        undefined,
        undefined,
        academicSession
      );
      const slotsToDisplay = freshDbSlots.length > 0 ? freshDbSlots : (result.slots || currentSlots);
      setSavedSlots(slotsToDisplay);
      setCurrentSlots(slotsToDisplay);
      setHasUnsavedChanges(false);
      setHasDraft(false);
      setDraftInfo(null);

      setNotification({
        type: 'success',
        message: `Weekly timetable for ${selectedClass?.name || 'Class'} Section ${selectedSection} saved. (${slotsToDisplay.length} assigned periods active)`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'The timetable could not be saved.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Primary Action 2: SAVE AS DRAFT
  const handleSaveDraft = () => {
    api.saveTimetableDraft(
      selectedClassId,
      selectedSection,
      currentSlots,
      academicSession
    );
    setHasDraft(true);
    setDraftInfo({
      slots: currentSlots,
      savedAt: new Date().toISOString(),
    });
    setHasUnsavedChanges(false);

    setNotification({
      type: 'success',
      message: `Timetable draft for ${selectedClass?.name}-${selectedSection} saved successfully. You can safely return and edit or publish later.`,
    });
  };

  // Primary Action 3: DISCARD CHANGES
  const handleDiscardChanges = () => {
    setCurrentSlots([...savedSlots]);
    setHasUnsavedChanges(false);
    setNotification({
      type: 'info',
      message: 'Unsaved changes discarded. Reverted back to the published master timetable.',
    });
  };

  // Action: LOAD DRAFT
  const handleLoadDraft = () => {
    if (!draftInfo) return;
    setCurrentSlots(draftInfo.slots);
    setHasUnsavedChanges(true);
    setNotification({
      type: 'info',
      message: `Restored draft from ${new Date(draftInfo.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Review and click "Save Timetable" to publish.`,
    });
  };

  // Action: DISCARD DRAFT
  const handleDiscardDraft = () => {
    api.clearTimetableDraft(selectedClassId, selectedSection, academicSession);
    setHasDraft(false);
    setDraftInfo(null);
    setNotification({
      type: 'info',
      message: 'Draft discarded.',
    });
  };

  // One A4 landscape document drives both Download and Print so they always match.
  const buildTimetableDoc = () => {
    const schoolName = schoolSettings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE';
    if (viewPerspective === 'CLASS') {
      return createTimetablePdf({
        schoolName,
        heading: `${selectedClass?.name || 'Class'} - Section ${selectedSection} Weekly Timetable`,
        meta: [`Session ${academicSession}`, hasUnsavedChanges ? 'Includes unsaved changes' : ''],
        workingDays,
        periods,
        slots: currentSlots,
        cellLines: (slot) => [
          slot.subjectName,
          slot.teacherName || staff.find((st) => st.id === slot.teacherId)?.name || '',
          slot.roomNumber ? `Room ${String(slot.roomNumber).replace(/^room\s*/i, '')}` : '',
        ],
      });
    }
    return createTimetablePdf({
      schoolName,
      heading: `Teaching Timetable - ${activeTeacher?.name || 'Teacher'}`,
      meta: [`Session ${academicSession}`, activeTeacher?.designation || ''],
      workingDays,
      periods,
      slots: teacherTimetableSlots,
      cellLines: (slot) => [
        slot.subjectName,
        `${slot.className}${slot.section ? ` - ${slot.section}` : ''}`,
        slot.roomNumber ? `Room ${String(slot.roomNumber).replace(/^room\s*/i, '')}` : '',
      ],
    });
  };

  const timetableHasSlots = () => (viewPerspective === 'CLASS' ? currentSlots : teacherTimetableSlots).length > 0;

  // Action: PRINT TIMETABLE (A4 landscape PDF opened in the print dialog)
  const handlePrintTimetable = async () => {
    if (!timetableHasSlots()) {
      setNotification({ type: 'warning', message: 'There are no timetable slots to print for this selection.' });
      return;
    }
    try {
      await printPdfBlob(buildTimetableDoc().output('blob'));
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Could not open the print dialog. Allow pop-ups or use Download PDF.' });
    }
  };

  // Action: DOWNLOAD PDF
  const handleDownloadPDF = () => {
    if (!timetableHasSlots()) {
      setNotification({ type: 'warning', message: 'There are no timetable slots to export for this selection.' });
      return;
    }
    try {
      const name =
        viewPerspective === 'CLASS'
          ? `Timetable_${selectedClass?.name || 'Class'}_Sec${selectedSection}_${academicSession}.pdf`
          : `Timetable_${activeTeacher?.name || 'Teacher'}_${academicSession}.pdf`;
      buildTimetableDoc().save(name.replace(/\s+/g, '_'));
      setNotification({ type: 'success', message: 'Timetable PDF downloaded.' });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setNotification({ type: 'error', message: err?.message || 'Failed to generate the PDF.' });
    }
  };

  // Action: EXPORT TIMETABLE TO CSV
  const handleExportCSV = () => {
    const slotsToExport = viewPerspective === 'CLASS' ? currentSlots : teacherTimetableSlots;
    if (slotsToExport.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No timetable slots available to export for the selected filter.',
      });
      return;
    }

    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Day', 'Period', 'Start Time', 'End Time', 'Subject', 'Teacher', 'Room', 'Class', 'Section', 'Session'];
    const rows = slotsToExport.map((slot) =>
      [slot.dayOfWeek, slot.periodNumber, slot.startTime, slot.endTime, slot.subjectName, slot.teacherName || '', slot.roomNumber || '', slot.className, slot.section, slot.academicSession || academicSession]
        .map(cell)
        .join(',')
    );
    // BOM keeps accents/₹ readable in Excel; a Blob avoids the "#" and "&" truncation of data: URIs.
    const blob = new Blob(['\uFEFF' + [headers.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename =
      viewPerspective === 'CLASS'
        ? `Timetable_Grade_${selectedClass?.name || 'Class'}_Sec_${selectedSection}_${academicSession}.csv`
        : `Timetable_Faculty_${activeTeacher?.name || 'Teacher'}_${academicSession}.csv`;
    link.download = filename.replace(/\s+/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setNotification({
      type: 'success',
      message: 'Timetable CSV spreadsheet exported successfully!',
    });
  };

  const activeTeacherId = useMemo(() => {
    if (isTeacherUser) {
      return currentStaff?.id || currentStaff?.employeeId || currentUser?.id || selectedTeacherId;
    }
    return selectedTeacherId;
  }, [isTeacherUser, currentStaff, currentUser, selectedTeacherId]);

  const activeTeacher = useMemo(() => {
    if (isTeacherUser && currentStaff) return currentStaff;
    return staff.find((s) => s.id === activeTeacherId) || currentStaff || staff[0];
  }, [isTeacherUser, currentStaff, staff, activeTeacherId]);

  // Teacher Schedule Slots for Teacher View Mode
  const teacherTimetableSlots = useMemo(() => {
    if (viewPerspective !== 'TEACHER') return [];
    const targetId = activeTeacherId;
    if (!targetId) return [];

    const allSlots = api.getTimetable(undefined, undefined, undefined, undefined, academicSession);
    const matchedStaff = activeTeacher;

    return allSlots.filter((s) => {
      if (s.teacherId === targetId) return true;
      if (matchedStaff && (s.teacherId === matchedStaff.id || s.teacherId === matchedStaff.employeeId)) return true;
      if (matchedStaff && s.teacherName && matchedStaff.name && s.teacherName.toLowerCase().trim() === matchedStaff.name.toLowerCase().trim()) return true;
      return false;
    });
  }, [viewPerspective, activeTeacherId, activeTeacher, academicSession, savedSlots, currentSlots]);

  const todayDayName = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()] || 'Monday';
  }, []);

  const todayTeacherSlots = useMemo(() => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMin = currentHours * 60 + currentMinutes;

    const parseTimeToMinutes = (timeStr?: string): number => {
      if (!timeStr) return 0;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    return teacherTimetableSlots
      .filter((s) => api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === todayDayName.toLowerCase())
      .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber))
      .map((s) => {
        const startMin = parseTimeToMinutes(s.startTime);
        const endMin = parseTimeToMinutes(s.endTime) || (startMin + 45);

        let status: 'COMPLETED' | 'ACTIVE' | 'UPCOMING' = 'UPCOMING';
        if (currentTotalMin > endMin) {
          status = 'COMPLETED';
        } else if (currentTotalMin >= startMin && currentTotalMin <= endMin) {
          status = 'ACTIVE';
        }
        return {
          ...s,
          status,
        };
      });
  }, [teacherTimetableSlots, todayDayName]);

  return (
    <div className="space-y-5">
      {/* Print-Only CSS Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-weekly-timetable, #printable-weekly-timetable * {
            visibility: visible !important;
          }
          #printable-weekly-timetable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8mm 10mm !important;
            background: #ffffff !important;
            display: block !important;
          }
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {isTeacherUser ? 'My Teaching Timetable' : 'Weekly Master Timetable'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Conflict Guard Active</span>
            </span>
            {!isTeacherUser && hasUnsavedChanges && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <span>Unsaved Changes</span>
              </span>
            )}
            {!isTeacherUser && hasDraft && !hasUnsavedChanges && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                <FileEdit className="w-3 h-3 text-blue-600" />
                <span>Draft Stored</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Admin modification controls */}
          {!isTeacherUser && (
            <>
              {/* Discard Changes Button (only when unsaved changes exist) */}
              {hasUnsavedChanges && (
                <button
                  onClick={handleDiscardChanges}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold shadow-2xs transition-colors"
                  title="Revert all unsaved modifications back to database"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Discard Changes</span>
                </button>
              )}

              {/* Save as Draft Button */}
              <button
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors"
                title="Save your current changes as a draft to finish later"
              >
                <FileEdit className="w-3.5 h-3.5 text-slate-500" />
                <span>Save as Draft</span>
              </button>

              {/* Save Timetable Button (Prominent) */}
              <button
                onClick={handleSaveTimetable}
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all ${
                  isSaving
                    ? 'bg-emerald-700 opacity-80 cursor-wait'
                    : hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400/40 animate-bounceOnce'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
                title="Publish and save this timetable to the master school database"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Timetable'}</span>
              </button>

              {/* Period Timings Button */}
              <button
                onClick={() => setIsPeriodConfigOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors"
                title="Configure working days, period timings and recesses"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Period Timings</span>
              </button>
            </>
          )}

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors"
            title="Export schedule to CSV file"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrintTimetable}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors"
            title="Print clean A4 landscape timetable"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Timetable</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold shadow-2xs transition-colors"
            title="Download crisp, vector-based HD PDF ready for printing"
          >
            <Download className="w-3.5 h-3.5 text-blue-700" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />}
            {notification.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
          >
            ✕
          </button>
        </div>
      )}

      {/* Draft Notification Ribbon (when draft exists) */}
      {hasDraft && draftInfo && (
        <div className="bg-amber-50/90 border border-amber-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Draft Available:</strong> An unpublished timetable draft was saved on{' '}
              {new Date(draftInfo.savedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              at{' '}
              {new Date(draftInfo.savedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDraft}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-2xs transition-colors"
            >
              Load Draft
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-bold transition-colors"
            >
              Discard Draft
            </button>
          </div>
        </div>
      )}

      {/* Filter & Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Left: Session, Class, Section OR Teacher Selector */}
        <div className="flex flex-wrap items-center gap-4">
          {/* View Perspective Toggle */}
          {!isTeacherUser ? (
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setViewPerspective('CLASS')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  viewPerspective === 'CLASS'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Class Timetable
              </button>
              <button
                onClick={() => setViewPerspective('TEACHER')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  viewPerspective === 'TEACHER'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teacher Schedule
              </button>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 font-bold text-blue-900 flex items-center gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>My Teaching Timetable</span>
            </div>
          )}

          {/* Academic Session Filter */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Session:</span>
            <select
              value={academicSession}
              onChange={(e) => handleSelectSession(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-bold text-slate-800"
            >
              {academicSessions.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {viewPerspective === 'CLASS' ? (
            <>
              {/* Class Filter */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Class:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleSelectClass(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-bold text-slate-800"
                >
                  {classes.length === 0 ? (
                    <option value="" disabled>No active classes</option>
                  ) : (
                    classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Section Filter Pills */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Section:</span>
                <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-100">
                  {(selectedClass?.sections || []).map((sec) => (
                    <button
                      key={sec}
                      onClick={() => handleSelectSection(sec)}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                        selectedSection === sec
                          ? 'bg-white text-blue-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Section {sec}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Teacher Filter for Teacher Perspective */
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Teacher:</span>
                {isTeacherUser ? (
                  <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>{activeTeacher?.name || currentUser?.name} ({activeTeacher?.designation || 'Faculty'})</span>
                  </div>
                ) : (
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-bold text-slate-800"
                  >
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.designation} - {st.department})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* View Switcher: Today's Schedule vs Weekly Timetable */}
              <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScheduleDisplayMode('TODAY')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    scheduleDisplayMode === 'TODAY'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Today's Schedule ({todayTeacherSlots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleDisplayMode('WEEKLY')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    scheduleDisplayMode === 'WEEKLY'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Weekly Timetable
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Schedule Slot Trigger */}
        {!isTeacherUser && viewPerspective === 'CLASS' && (
          <button
            onClick={() => handleOpenAddSlot()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-2xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Schedule Slot</span>
          </button>
        )}
      </div>

      {/* If Teacher Perspective and TODAY is selected, show Today's Schedule */}
      {viewPerspective === 'TEACHER' && scheduleDisplayMode === 'TODAY' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-700" />
                <span>Today's Assigned Schedule — {todayDayName}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic periods, classrooms, and live teaching status for {activeTeacher?.name} ({activeTeacher?.designation || 'Faculty'})
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                {todayTeacherSlots.length} Periods Scheduled Today
              </span>
            </div>
          </div>

          {todayTeacherSlots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {todayTeacherSlots.map((slot, idx) => {
                const isActive = slot.status === 'ACTIVE';
                const isCompleted = slot.status === 'COMPLETED';

                return (
                  <div
                    key={slot.id || idx}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-2 ring-blue-500/10'
                        : isCompleted
                        ? 'bg-slate-50/70 border-slate-200 text-slate-500 opacity-80'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isActive
                              ? 'bg-blue-700 text-white'
                              : isCompleted
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          P{slot.periodNumber}
                        </span>

                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-700 text-white animate-pulse">
                            ● Ongoing Period
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                            Completed
                          </span>
                        )}
                        {!isActive && !isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Upcoming
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 leading-snug">
                        {slot.subjectName}
                      </h3>
                      <p className="text-xs font-semibold text-slate-700 mt-1">
                        {slot.className} - Section {slot.section}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>{slot.roomNumber || 'Room 204'}</span>
                      <span className="font-bold text-slate-800">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No periods scheduled for {todayDayName}</p>
              <p className="text-xs text-slate-400 mt-1">
                You have no assigned teaching periods on this day. Switch to "Weekly Timetable" to review your complete week.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Timetable Interactive Grid Container */
        <div id="printable-weekly-timetable" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Info header ribbon */}
        <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="font-semibold">
            {viewPerspective === 'CLASS' ? (
              <span>
                Schedule for:{' '}
                <strong className="text-slate-900 font-bold">
                  {selectedClass?.name || 'Class'} - Section {selectedSection}
                </strong>{' '}
                ({academicSession})
              </span>
            ) : (
              <span>
                Schedule for Teacher:{' '}
                <strong className="text-slate-900 font-bold">{activeTeacher?.name}</strong>{' '}
                ({activeTeacher?.designation})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-300 inline-block" />
              <span>Assigned Class</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block" />
              <span>Recess / Break</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-dashed border-slate-300 inline-block" />
              <span>Free Period</span>
            </span>
          </div>
        </div>

        {/* Responsive Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-800">
                <th className="p-3 w-32 font-bold border-r border-slate-800 uppercase tracking-wider text-[11px]">
                  Day / Period
                </th>
                {periods.map((p) => (
                  <th
                    key={p.periodNumber}
                    className="p-3 text-center border-r border-slate-800 last:border-r-0 min-w-[130px] max-w-[160px]"
                  >
                    <div className="font-bold text-slate-100">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {p.startTime} - {p.endTime}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {workingDays.map((day) => {
                const normDay = api.normalizeDayOfWeek(day);
                return (
                  <tr key={normDay} className="hover:bg-slate-50/50 transition-colors">
                    {/* Day Column */}
                    <td className="p-3 font-bold text-slate-900 bg-slate-50/70 border-r border-slate-200">
                      {normDay}
                    </td>

                    {/* Period Columns */}
                    {periods.map((period) => {
                      const isRecess = period.isBreak;
                      const cellKey = `${normDay}-${period.periodNumber}`;
                      const isCellDragOver = dragOverCell === cellKey;

                      // Break / Recess Period
                      if (isRecess) {
                        return (
                          <td
                            key={period.periodNumber}
                            className="p-2 border-r border-slate-200 text-center bg-amber-50/60 align-middle"
                          >
                            <span className="text-[10px] font-extrabold text-amber-800 tracking-wider uppercase block">
                              {period.breakType || 'RECESS'}
                            </span>
                            <span className="text-[9px] text-amber-600 font-mono block mt-0.5">
                              {period.startTime} - {period.endTime}
                            </span>
                          </td>
                        );
                      }

                      // Find Slot for this period
                      const slot =
                        viewPerspective === 'CLASS'
                          ? currentSlots.find(
                              (s) =>
                                api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === normDay.toLowerCase() &&
                                Number(s.periodNumber) === period.periodNumber
                            )
                          : teacherTimetableSlots.find(
                              (s) =>
                                api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === normDay.toLowerCase() &&
                                Number(s.periodNumber) === period.periodNumber
                            );

                      return (
                        <td
                          key={period.periodNumber}
                          onDragOver={(e) => {
                            if (viewPerspective === 'CLASS') {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverCell(cellKey);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverCell === cellKey) setDragOverCell(null);
                          }}
                          onDrop={(e) => {
                            if (viewPerspective === 'CLASS') {
                              e.preventDefault();
                              handleDropSlot(normDay, period.periodNumber);
                            }
                          }}
                          className={`p-2 border-r border-slate-200 align-top transition-colors ${
                            isCellDragOver ? 'bg-blue-100/70 ring-2 ring-blue-500 ring-inset' : ''
                          }`}
                        >
                          {slot ? (
                            /* Assigned Slot Card */
                            <div
                              draggable={viewPerspective === 'CLASS'}
                              onDragStart={(e) => {
                                if (viewPerspective === 'CLASS') {
                                  e.dataTransfer.setData('text/plain', slot.id);
                                  setDraggedSlotId(slot.id);
                                }
                              }}
                              onDragEnd={() => {
                                setDraggedSlotId(null);
                                setDragOverCell(null);
                              }}
                              className={`p-2.5 rounded-xl border transition-all select-none group relative ${
                                viewPerspective === 'CLASS'
                                  ? 'bg-blue-50/80 border-blue-200/90 hover:border-blue-300 hover:shadow-xs cursor-grab active:cursor-grabbing'
                                  : 'bg-indigo-50/80 border-indigo-200'
                              }`}
                            >
                              {/* Subject Name */}
                              <div className="font-black text-blue-950 text-xs leading-snug">
                                {slot.subjectName}
                              </div>

                              {/* Teacher Display */}
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 mt-1.5">
                                <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="truncate">
                                  {viewPerspective === 'CLASS'
                                    ? slot.teacherName ||
                                      staff.find((st) => st.id === slot.teacherId)?.name ||
                                      'Assigned Faculty'
                                    : `${slot.className} - Sec ${slot.section}`}
                                </span>
                              </div>

                              {/* Room & Timing */}
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1.5 pt-1.5 border-t border-blue-100">
                                <span className="font-semibold text-slate-600">
                                  {slot.roomNumber || 'Room 204'}
                                </span>
                                {/* Time from the school-wide period setting (same for every class). */}
                                <span>{period.startTime || slot.startTime}</span>
                              </div>

                              {/* Quick Edit & Delete Hover Actions */}
                              {viewPerspective === 'CLASS' && (
                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-2xs p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditSlot(slot);
                                    }}
                                    className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                    title="Edit slot details"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSlot(slot.id);
                                    }}
                                    className="p-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                                    title="Delete slot"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Free Period Placeholder */
                            viewPerspective === 'CLASS' ? (
                              <button
                                onClick={() => handleOpenAddSlot(normDay, period.periodNumber)}
                                className="w-full h-20 flex flex-col items-center justify-center gap-1 border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 rounded-xl text-slate-400 hover:text-blue-700 text-[11px] font-semibold transition-all group"
                              >
                                <span className="text-slate-300 group-hover:text-blue-500">
                                  — Free Period —
                                </span>
                                <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <PlusCircle className="w-3 h-3" />
                                  <span>Assign</span>
                                </span>
                              </button>
                            ) : (
                              <div className="h-20 flex items-center justify-center text-slate-300 text-[11px] border border-dashed border-slate-200 rounded-xl italic">
                                — Free Period —
                              </div>
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

      {/* Schedule Slot Modal (Add / Edit) */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingSlot ? 'Edit Timetable Slot' : 'Schedule Timetable Period'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: <strong className="text-slate-800">{selectedClass?.name || 'Class'} - Section {selectedSection}</strong> ({academicSession})
                </p>
              </div>
              <button
                onClick={() => setIsSlotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Conflict Warning Box */}
            {conflictWarning && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Conflict Prevention Block:</strong>
                  <span>{conflictWarning}</span>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleModalSaveSlot} className="space-y-4 text-xs">
              {/* Day & Period Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Day of Week</label>
                  <select
                    value={slotDay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlotDay(val);
                      setConflictWarning(
                        checkLiveConflict(slotTeacherId, val, slotPeriod, slotRoom, editingSlot?.id)
                      );
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold text-slate-900"
                  >
                    {workingDays.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Period Number</label>
                  <select
                    value={slotPeriod}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSlotPeriod(val);
                      setConflictWarning(
                        checkLiveConflict(slotTeacherId, slotDay, val, slotRoom, editingSlot?.id)
                      );
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold text-slate-900"
                  >
                    {periods
                      .filter((p) => !p.isBreak)
                      .map((p) => (
                        <option key={p.periodNumber} value={p.periodNumber}>
                          {p.name} ({p.startTime} - {p.endTime})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Subject Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject</label>
                <select
                  value={slotSubjectId}
                  onChange={(e) => setSlotSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold text-slate-900"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Teacher Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Teacher</label>
                <select
                  value={slotTeacherId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSlotTeacherId(val);
                    setConflictWarning(
                      checkLiveConflict(val, slotDay, slotPeriod, slotRoom, editingSlot?.id)
                    );
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold text-slate-900"
                >
                  {staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.designation} - {st.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Classroom Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Classroom / Room Number</label>
                <input
                  type="text"
                  value={slotRoom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSlotRoom(val);
                    setConflictWarning(
                      checkLiveConflict(slotTeacherId, slotDay, slotPeriod, val, editingSlot?.id)
                    );
                  }}
                  placeholder="e.g. Room 204 or Physics Lab"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-semibold text-slate-900"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                {editingSlot ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(editingSlot.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-700 hover:bg-rose-50 font-bold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Slot</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSlotModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold shadow-xs transition-colors"
                  >
                    {editingSlot ? 'Update Slot' : 'Assign Slot'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Navigation Guard Dialog (Unsaved changes modal) */}
      {pendingSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Unsaved Changes Detected</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You have modified the weekly timetable for <strong>{selectedClass?.name || 'Class'} - Section {selectedSection}</strong> without saving. Switching now will lose these modifications unless you save them first.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingSwitch(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs"
              >
                Stay Here
              </button>
              <button
                onClick={() => handleConfirmSwitch(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold hover:bg-rose-100 text-xs"
              >
                Discard & Switch
              </button>
              <button
                onClick={() => handleConfirmSwitch(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs text-xs"
              >
                Save & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Printable Area (Hidden on screen, visible during window.print()) */}
      <div id="printable-weekly-timetable" className="hidden">
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: '0 0 4px 0', color: '#0f172a' }}>
            {schoolSettings.schoolName || 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE'}
          </h1>
          <h2 style={{ fontSize: '12pt', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1d4ed8' }}>
            WEEKLY MASTER TIMETABLE
          </h2>
          <p style={{ fontSize: '9pt', color: '#475569', margin: '0' }}>
            <strong>Academic Session:</strong> {academicSession} &nbsp;|&nbsp;{' '}
            <strong>Class:</strong> {selectedClass?.name || 'Class'} &nbsp;|&nbsp;{' '}
            <strong>Section:</strong> {selectedSection} &nbsp;|&nbsp;{' '}
            <strong>Generated Date:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', textAlign: 'center' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
              <th style={{ border: '1px solid #334155', padding: '6px', textAlign: 'left', width: '90px' }}>
                Day / Period
              </th>
              {periods.map((p) => (
                <th key={p.periodNumber} style={{ border: '1px solid #334155', padding: '6px' }}>
                  <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                  <div style={{ fontSize: '7pt', color: '#94a3b8' }}>
                    {p.startTime} - {p.endTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workingDays.map((day) => {
              const normDay = api.normalizeDayOfWeek(day);
              return (
                <tr key={normDay}>
                  <td
                    style={{
                      border: '1px solid #cbd5e1',
                      padding: '6px',
                      fontWeight: 'bold',
                      backgroundColor: '#f8fafc',
                      textAlign: 'left',
                    }}
                  >
                    {normDay}
                  </td>
                  {periods.map((period) => {
                    if (period.isBreak) {
                      return (
                        <td
                          key={period.periodNumber}
                          style={{
                            border: '1px solid #cbd5e1',
                            padding: '6px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 'bold',
                          }}
                        >
                          RECESS / BREAK
                        </td>
                      );
                    }
                    const slot = currentSlots.find(
                      (s) =>
                        api.normalizeDayOfWeek(s.dayOfWeek).toLowerCase() === normDay.toLowerCase() &&
                        Number(s.periodNumber) === period.periodNumber
                    );
                    if (slot) {
                      const teacher =
                        slot.teacherName ||
                        staff.find((st) => st.id === slot.teacherId)?.name ||
                        'Faculty';
                      return (
                        <td
                          key={period.periodNumber}
                          style={{
                            border: '1px solid #cbd5e1',
                            padding: '6px',
                            backgroundColor: '#eff6ff',
                            color: '#1e3a8a',
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{slot.subjectName}</div>
                          <div style={{ fontSize: '7.5pt', color: '#1e40af' }}>{teacher}</div>
                          <div style={{ fontSize: '7pt', color: '#64748b' }}>
                            {slot.roomNumber || 'Room 204'}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={period.periodNumber}
                        style={{
                          border: '1px solid #cbd5e1',
                          padding: '6px',
                          color: '#94a3b8',
                          fontStyle: 'italic',
                        }}
                      >
                        — Free Period —
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: '16px', fontSize: '7pt', color: '#94a3b8', textAlign: 'center' }}>
          CHANAKYA PUBLIC SCHOOL & COACHING CENTRE • Official Master Academic Timetable • Confidential Document
        </div>
      </div>

      {/* Period Timings & Working Days Configuration Modal */}
      <PeriodConfigModal
        isOpen={isPeriodConfigOpen}
        onClose={() => setIsPeriodConfigOpen(false)}
        onSaved={(message?: string) => {
          const cfg = api.getTimetableConfig();
          setTimetableConfig(cfg);
          // Lessons on screen (including unsaved edits) take the new times of their period.
          const byNum = new Map((cfg.periods || []).map((p) => [p.periodNumber, p]));
          const retime = (list: TimetableSlot[]) =>
            list.map((sl) => {
              const per = byNum.get(sl.periodNumber);
              return per && !per.isBreak ? { ...sl, startTime: per.startTime, endTime: per.endTime } : sl;
            });
          setCurrentSlots((prev) => retime(prev));
          setSavedSlots((prev) => retime(prev));
          setNotification({
            type: 'success',
            message: message || 'Period timings saved.',
          });
        }}
        initialPeriods={timetableConfig.periods || []}
        initialDays={timetableConfig.workingDays || []}
        schoolTiming={timetableConfig.schoolTiming || { startTime: '08:00 AM', endTime: '02:00 PM' }}
      />
    </div>
  );
};
