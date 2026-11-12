import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Printer,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckCircle2,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { SchoolSettings, Student, TeacherStaff } from '../../types';
import { api } from '../../services/api';
import { StudentIdCard } from '../common/StudentIdCard';
import { TeacherIdCard } from '../common/TeacherIdCard';
import { exportIdCardToPdf, exportMultipleCardsToPdf, waitForCardsReady } from '../../utils/idCardPdfExporter';
import type { CardSide } from '../common/idcard/IdCardDesign';
import { NOT_CONFIGURED } from '../../utils/schoolIdentity';

interface PrintableIdCardModalProps {
  student?: Student | null;
  students?: Student[];
  staff?: TeacherStaff | null;
  /** Several staff cards at once (bulk view, print and one combined PDF). */
  staffList?: TeacherStaff[];
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  onBackToProfile?: () => void;
}

export const PrintableIdCardModal: React.FC<PrintableIdCardModalProps> = ({
  student: initialStudent,
  students: passedStudents,
  staff: singleStaff,
  staffList: passedStaffList,
  isOpen,
  onClose,
  settings: initialSettings,
  onBackToProfile,
}) => {
  // 'flip' shows one card that turns over; print and PDF always use both sides.
  const [activeSide, setActiveSide] = useState<CardSide>('flip');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBulkViewAll, setIsBulkViewAll] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [activeSettings, setActiveSettings] = useState<SchoolSettings>(() => initialSettings || api.getSettings());
  const [freshStudentsMap, setFreshStudentsMap] = useState<Map<string, Student>>(new Map());
  const staffMembers = useMemo<TeacherStaff[]>(
    () => (singleStaff ? [singleStaff] : Array.isArray(passedStaffList) ? passedStaffList.filter(Boolean) : []),
    [singleStaff, passedStaffList]
  );
  const isStaffMode = staffMembers.length > 0;
  const staff: TeacherStaff | null = isStaffMode ? staffMembers[Math.min(currentIndex, staffMembers.length - 1)] : null;
  const [freshStaff, setFreshStaff] = useState<TeacherStaff | null>(staff || null);
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);

  // Sync settings when initialSettings changes
  useEffect(() => {
    if (initialSettings) {
      setActiveSettings(initialSettings);
    }
  }, [initialSettings]);

  // Sync fresh staff details dynamically from MongoDB
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !staff?.id) return;
    setFreshStaff(staff);
    api.fetchStaffDirect(staff.id)
      .then((res) => {
        if (isMounted && res) {
          setFreshStaff(res);
        }
      })
      .catch((err) => {
        console.warn('[IdCardModal] Using current staff record:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, staff?.id]);

  // Determine if student mode is active
  const isStudent = !isStaffMode && (Boolean(initialStudent) || (Array.isArray(passedStudents) && passedStudents.length > 0));

  // Memoized raw list of students
  const rawList = useMemo(() => {
    if (!isStudent) return [];
    if (passedStudents && passedStudents.length > 0) return passedStudents;
    if (initialStudent) return [initialStudent];
    return [];
  }, [isStudent, passedStudents, initialStudent]);

  // Stable key for student list to prevent unnecessary effect triggers
  const studentIdsKey = useMemo(() => {
    return rawList.map((s) => s.id).join(',');
  }, [rawList]);

  // Dynamically fetch currently selected student's latest data from MongoDB ONLY if student card is active
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !isStudent || rawList.length === 0) return;

    setIsLoadingFresh(true);
    // Latest record (photo, class, roll no) for every selected student, a few at a time.
    // Before, only the first 10 were refreshed and the rest used whatever the list had loaded.
    const loadAll = async () => {
      const out: (Student | null)[] = [];
      for (let i = 0; i < rawList.length; i += 6) {
        if (!isMounted) break;
        const part = await Promise.all(rawList.slice(i, i + 6).map((st) => api.fetchStudentDirect(st.id).catch(() => null)));
        out.push(...part);
      }
      return out;
    };

    loadAll()
      .then((freshResults) => {
        if (!isMounted) return;
        const map = new Map<string, Student>();
        freshResults.forEach((fresh) => {
          if (fresh) {
            map.set(fresh.id, fresh);
            map.set(fresh.admissionNumber, fresh);
          }
        });
        setFreshStudentsMap(map);
      })
      .catch((err) => {
        console.warn('[IdCardModal] Error syncing student data from MongoDB:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFresh(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, isStudent, studentIdsKey]);

  // Prevent background scroll and manage print isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('id-card-modal-active');
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.classList.remove('id-card-modal-active');
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Adjust default zoom on mobile / narrow screens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width < 640) {
        setZoom(activeSide === 'both' ? 0.48 : 0.85);
      } else if (width < 1024) {
        setZoom(activeSide === 'both' ? 0.75 : 1);
      } else {
        setZoom(1);
      }
    }
  }, [isOpen, activeSide]);

  const studentList = useMemo(() => {
    return rawList.map((s) => freshStudentsMap.get(s.id) || freshStudentsMap.get(s.admissionNumber) || s);
  }, [rawList, freshStudentsMap]);

  const bulkCount = isStudent ? studentList.length : staffMembers.length;
  const isBulk = bulkCount > 1;
  const currentStudent = isStudent ? (studentList[currentIndex] || studentList[0]) : null;
  // freshStaff can briefly belong to the previous card while paging; only trust it for the current one.
  const effectiveStaff = freshStaff && staff && freshStaff.id === staff.id ? freshStaff : staff;
  const currentTarget = isStudent ? currentStudent : effectiveStaff;

  // Print and PDF need both faces laid out side by side, not the flip view.
  const withBothSides = useCallback(
    async <T,>(fn: () => Promise<T> | T): Promise<T> => {
      if (activeSide !== 'flip') return fn();
      setActiveSide('both');
      await new Promise((r) => setTimeout(r, 350));
      try {
        return await fn();
      } finally {
        setActiveSide('flip');
      }
    },
    [activeSide]
  );

  const handlePrint = useCallback(() => {
    if (isPrinting) return;
    if (isBulk) {
      // Print every selected card (both sides), not only the one on screen.
      setIsPrinting(true);
      setIsBulkViewAll(true);
      if (activeSide === 'flip') setActiveSide('both');
      (async () => {
        await new Promise((r) => setTimeout(r, 300));
        const stage = document.getElementById('bulk-cards-print-stage');
        if (stage) await waitForCardsReady(stage, 30000);
        try {
          window.print();
        } catch (err) {
          console.warn('[IdCardModal] Print error:', err);
        } finally {
          setIsPrinting(false);
        }
      })();
      return;
    }
    if (activeSide === 'flip') {
      setIsPrinting(true);
      withBothSides(() => {
        try {
          window.print();
        } catch (err) {
          console.warn('[IdCardModal] Print error:', err);
        }
      }).finally(() => setIsPrinting(false));
      return;
    }
    setIsPrinting(true);
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn('[IdCardModal] Print error:', err);
      } finally {
        setIsPrinting(false);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isPrinting, activeSide, withBothSides, isBulk]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(1.5, +(prev + 0.1).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.4, +(prev - 0.1).toFixed(2)));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const handleZoomFit = () => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width < 640) {
        setZoom(activeSide === 'both' ? 0.48 : 0.85);
      } else if (width < 1024) {
        setZoom(activeSide === 'both' ? 0.75 : 1);
      } else {
        setZoom(1);
      }
    }
  };

  const handleDownloadSinglePdf = async () => {
    if (!currentTarget || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setFeedback('Generating High-Definition PDF...');

    try {
      const adm = isStudent ? (currentStudent?.admissionNumber || 'ADM') : (effectiveStaff?.employeeId || 'EMP');
      const name = (currentTarget.name || 'Member').replace(/\s+/g, '_');
      const filename = isStudent ? `StudentID_${adm}_${name}.pdf` : `Staff_ID_${adm}_${name}.pdf`;

      const exportPromise = withBothSides(() => exportIdCardToPdf('printable-id-card-view', filename));
      const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 12000));
      const success = await Promise.race([exportPromise, timeoutPromise]);

      if (success) {
        setFeedback('PDF downloaded successfully!');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback('Error creating PDF. Please use the Print option.');
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error('[IdCardModal] Error generating PDF:', err);
      setFeedback('Error creating PDF. Please use the Print option.');
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    if (bulkCount === 0 || isGeneratingPdf) return;
    if (isStudent && isLoadingFresh) {
      setFeedback('Loading the latest student details, try again in a moment.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setIsGeneratingPdf(true);
    setPdfProgress(`0 / ${bulkCount}`);

    const ids = Array.from({ length: bulkCount }, (_, i) => `bulk-card-${i}`);
    
    // Ensure all cards are visible in DOM during bulk capture
    setIsBulkViewAll(true);
    await new Promise((r) => setTimeout(r, 400));

    const success = await exportMultipleCardsToPdf(
      ids,
      isStudent ? `Batch_Student_ID_Cards_${bulkCount}_Students.pdf` : `Batch_Staff_ID_Cards_${bulkCount}_Staff.pdf`,
      (current, total, stage) => {
        setPdfProgress(stage === 'preparing' ? 'Loading photos…' : `${current} / ${total}`);
      }
    );

    setIsGeneratingPdf(false);
    setPdfProgress(null);

    if (success) {
      setFeedback(`Successfully generated PDF for ${bulkCount} ${isStudent ? 'students' : 'staff members'}!`);
      setTimeout(() => setFeedback(null), 3500);
    } else {
      setFeedback('Failed to generate batch PDF. You can print individual cards.');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const modalContent = (
    <div className="id-card-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-0 sm:p-3 md:p-6 overflow-hidden print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Container Dialog - Strictly bounded height to ensure top toolbar never gets pushed off-screen */}
      <div className="bg-slate-900 text-white w-full h-[100dvh] sm:h-[94vh] sm:max-h-[94vh] max-w-6xl rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-800 flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full print:h-auto print:m-0 print:bg-white print:text-black">
        
        {/* ========================================================================= */}
        {/* FIXED / STICKY PREVIEW TOOLBAR (Top) */}
        {/* ========================================================================= */}

        {/* 1. Desktop & Tablet Toolbar (>= 640px) */}
        <div className="hidden sm:flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0 sticky top-0 z-30 print:hidden gap-3">
          {/* Left: Back / Title */}
          <div className="flex items-center gap-3 min-w-0">
            {onBackToProfile ? (
              <button
                type="button"
                onClick={onBackToProfile}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors border border-slate-700"
                title="Return to Student Profile"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Profile</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors border border-slate-700"
                title="Close ID Card Preview"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white leading-tight truncate">
                  {isBulk
                    ? `Bulk ${isStudent ? 'Student' : 'Staff'} ID Cards (${bulkCount} Selected)`
                    : isStudent
                    ? `Student ID Card: ${currentTarget?.name}`
                    : `Staff / Faculty ID Card: ${staff?.name} (${staff?.employeeId})`}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {activeSide === 'flip'
                    ? 'Tap the card to see the other side. Print and PDF include both sides.'
                    : 'CR80 card size. The QR code on the back is used for scan attendance.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: View Side, Zoom, Print, Download, Close */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Side Selector */}
            <div className="flex rounded-lg bg-slate-800 p-0.5 text-xs font-semibold border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveSide('flip')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${
                  activeSide === 'flip' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Show one card; tap it to turn it over"
              >
                Flip
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('both')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${
                  activeSide === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Both Sides
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('front')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${
                  activeSide === 'front' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('back')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${
                  activeSide === 'back' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Back
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center rounded-lg bg-slate-800 p-0.5 text-xs border border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.4}
                className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="px-1.5 py-1 text-[11px] font-mono font-bold text-slate-300 hover:text-white"
                title="Reset to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 1.5}
                className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomFit}
                className="p-1.5 rounded text-slate-400 hover:text-amber-300 transition-colors border-l border-slate-700 ml-0.5"
                title="Fit to Screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors shadow-xs"
              title="Print directly to physical card printer"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Print</span>
            </button>

            {/* Download PDF button */}
            {isBulk ? (
              <button
                type="button"
                onClick={handleDownloadAllPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                title="Download all selected cards in one PDF"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{pdfProgress || 'Exporting...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download All (PDF)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadSinglePdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                title="Download pristine high-definition PDF"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            )}

            {/* Close (X) button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Mobile Responsive Toolbar (< 640px) */}
        <div className="flex sm:hidden flex-col bg-slate-950 border-b border-slate-800 shrink-0 sticky top-0 z-30 print:hidden">
          {/* Mobile Top Row: Identity & Close/Back */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-900">
            <div className="flex items-center gap-2 min-w-0">
              {onBackToProfile ? (
                <button
                  type="button"
                  onClick={onBackToProfile}
                  className="px-2 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Profile</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <div className="min-w-0 flex items-center gap-1.5">
                <span className="font-bold text-xs text-white truncate max-w-[130px]">
                  {currentTarget?.name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 text-[10px] text-blue-300 font-mono font-bold shrink-0">
                  {staff?.employeeId || currentStudent?.admissionNumber || 'ID'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Bottom Row: View Side Switcher, Zoom, Print, Download */}
          <div className="flex items-center justify-between px-3 py-2 gap-2 bg-slate-950/90">
            {/* View Side Selector */}
            <div className="flex rounded-md bg-slate-800 p-0.5 text-[11px] font-semibold border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveSide('flip')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSide === 'flip' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Flip
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('both')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSide === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('front')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSide === 'front' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('back')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSide === 'back' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Back
              </button>
            </div>

            {/* Mobile Zoom */}
            <div className="flex items-center rounded-md bg-slate-800 p-0.5 text-xs border border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.4}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomFit}
                className="px-1 text-[10px] font-mono text-slate-300 font-bold"
                title="Auto Fit"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 1.5}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Actions: Print & Download */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1 transition-colors"
                title="Print Card"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={isBulk ? handleDownloadAllPdf : handleDownloadSinglePdf}
                disabled={isGeneratingPdf}
                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors"
                title="Download PDF"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Banner if any */}
        {feedback && (
          <div className="px-4 sm:px-6 py-2 bg-blue-950 border-b border-blue-800 text-xs text-blue-200 flex items-center gap-2 print:hidden shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{feedback}</span>
          </div>
        )}

        {/* Bulk Pager or Grid Switcher if multiple students */}
        {isBulk && (
          <div className="px-4 sm:px-6 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkViewAll(!isBulkViewAll)}
                className={`px-3 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                  isBulkViewAll
                    ? 'bg-blue-900/60 border-blue-500 text-blue-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isBulkViewAll ? 'View Single Card' : 'View All Grid'}</span>
              </button>
            </div>

            {!isBulkViewAll && (
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-xs">
                  Card <strong className="text-white">{currentIndex + 1}</strong> of <strong className="text-white">{bulkCount}</strong>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min(bulkCount - 1, prev + 1))}
                    disabled={currentIndex === bulkCount - 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CARD STAGE / CANVAS AREA: Centered with 2D Smooth Scroll & Safe Spacing */}
        {/* ========================================================================= */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-slate-950/95 flex touch-pan-x touch-pan-y relative print:bg-white print:p-0 print:min-h-0 print:overflow-visible">
          {/* Centering wrapper with margin: auto to prevent negative-coordinate clipping */}
          <div className="m-auto flex flex-col items-center justify-center py-6 px-4 shrink-0 min-w-min">
            {isBulk && isBulkViewAll ? (
              <div
                id="bulk-cards-print-stage"
                className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl justify-items-center print:block print:w-full"
              >
                {isStudent
                  ? studentList.map((stu, idx) => (
                      <div
                        key={stu.id}
                        id={`bulk-card-${idx}`}
                        className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-slate-900/60 rounded-2xl border border-slate-800 print:border-none print:p-0 print:break-after-page"
                      >
                        <span className="text-[11px] font-bold text-slate-400 print:hidden">
                          #{idx + 1} • {stu.name} ({stu.className}-{stu.section})
                        </span>
                        <StudentIdCard
                          student={stu}
                          settings={activeSettings}
                          side={activeSide === 'flip' ? 'both' : activeSide}
                          idPrefix={`bulk-card-${idx}`}
                        />
                      </div>
                    ))
                  : staffMembers.map((st, idx) => (
                      <div
                        key={st.id}
                        id={`bulk-card-${idx}`}
                        className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-slate-900/60 rounded-2xl border border-slate-800 print:border-none print:p-0 print:break-after-page"
                      >
                        <span className="text-[11px] font-bold text-slate-400 print:hidden">
                          #{idx + 1} • {st.name} ({st.employeeId || st.designation})
                        </span>
                        <TeacherIdCard
                          staff={st}
                          settings={activeSettings}
                          side={activeSide === 'flip' ? 'both' : activeSide}
                          idPrefix={`bulk-card-${idx}`}
                        />
                      </div>
                    ))}
              </div>
            ) : (
              <div
                id="printable-card-zoom-wrapper"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="flex items-center justify-center shrink-0"
              >
                <div
                  id="printable-id-card-view"
                  className="p-3 sm:p-5 bg-slate-900/40 rounded-3xl border border-slate-800/80 shadow-2xl flex items-center justify-center shrink-0 print:bg-white print:p-0 print:border-none print:shadow-none"
                >
                  {effectiveStaff && !currentStudent ? (
                    <TeacherIdCard
                      staff={effectiveStaff}
                      settings={activeSettings}
                      side={activeSide}
                      idPrefix="active-card"
                    />
                  ) : (
                    <StudentIdCard
                      student={currentStudent}
                      staff={effectiveStaff}
                      settings={activeSettings}
                      side={activeSide}
                      idPrefix="active-card"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOOTER INFO BAR (Fixed at bottom) */}
        {/* ========================================================================= */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 print:hidden">
          <div className="flex items-center gap-2">
            <span>Dimensions: 54mm × 85.6mm (CR80 Standard)</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">300 DPI High-Definition</span>
          </div>
          <div className="flex items-center gap-2">
            <span>School Code: <strong className="text-slate-200">{activeSettings.schoolCode || NOT_CONFIGURED}</strong></span>
            <span>•</span>
            <span>Affiliation: <strong className="text-amber-400">{activeSettings.affiliationCode || activeSettings.affiliationNumber || NOT_CONFIGURED}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );

  // Callers that keep the modal mounted (parent Documents, My Children) rely on this.
  // Without it the modal was always visible and the close button had no effect.
  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
