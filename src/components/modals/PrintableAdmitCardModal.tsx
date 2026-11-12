import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X, GraduationCap, ChevronLeft, ChevronRight, Layers, Loader2, Eye } from 'lucide-react';
import { Exam, ExamScheduleItem, SchoolSettings, Student } from '../../types';
import { fileUploadService } from '../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { exportAdmitCardToPdf, exportBulkAdmitCardsToPdf } from '../../utils/admitCardPdfExporter';
import {
  captureDomImageAsBase64,
  ensureRasterJpegOrPng,
  getDocumentImageBase64Async,
  preloadDocumentAssets,
  resolveStudentPhotoBase64,
} from '../../utils/documentImageHelper';
import { letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';

interface PrintableAdmitCardModalProps {
  student?: Student | null;
  students?: Student[];
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
}

export const PrintableAdmitCardModal: React.FC<PrintableAdmitCardModalProps> = ({
  student,
  students = [],
  exam,
  isOpen,
  onClose,
  settings,
}) => {
  const studentList = useMemo(() => {
    return students && students.length > 0 ? students : student ? [student] : [];
  }, [students, student]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBulkViewAll, setIsBulkViewAll] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [photosMap, setPhotosMap] = useState<Map<string, string>>(new Map());
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [sigBase64, setSigBase64] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('admit-card-modal-active');
      return () => {
        document.body.classList.remove('admit-card-modal-active');
      };
    }
  }, [isOpen]);

  // Preload high-resolution image assets (logo, photo, signature) for instant CORS-free render & PDF
  useEffect(() => {
    let isMounted = true;
    if (isOpen && studentList.length > 0) {
      preloadDocumentAssets(studentList, settings)
        .then((assets) => {
          if (!isMounted) return;
          setLogoBase64(assets.logoBase64);
          setSigBase64(assets.sigBase64);
          setPhotosMap(assets.photosMap);
        })
        .catch((err) => {
          console.warn('[PrintableAdmitCardModal] Asset preload warning:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, studentList, settings]);

  useEffect(() => {
    if (student && studentList.length > 0) {
      const idx = studentList.findIndex((s) => s.id === student.id);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [student, studentList]);

  if (!isOpen || studentList.length === 0) return null;

  const currentStudent = studentList[currentIndex] || studentList[0];

  // Helper to filter schedule applicable to this student's class and section
  const getStudentSchedule = (st: Student): ExamScheduleItem[] => {
    if (!exam.schedule || exam.schedule.length === 0) return [];
    return exam.schedule.filter((item) => {
      const matchClass =
        !item.classId ||
        item.classId === st.classId ||
        (st.className && item.className === st.className);
      const matchSection =
        !item.section ||
        item.section === 'ALL' ||
        !st.section ||
        item.section === st.section;
      return matchClass && matchSection;
    });
  };

  // Print the same A4 PDF that Download produces so the two always match.
  const handlePrint = () => handleDownloadPdf('print');

  const handleDownloadPdf = async (action: 'download' | 'print' = 'download') => {
    setIsExportingPdf(true);
    try {
      if (isBulkViewAll && studentList.length > 1) {
        const updatedPhotosMap = new Map<string, string>(photosMap);
        for (const st of studentList) {
          if (!updatedPhotosMap.has(st.id) && !updatedPhotosMap.has(st.admissionNumber)) {
            const b64 = await resolveStudentPhotoBase64(st, `admit-card-student-photo-${st.id}`);
            if (b64) {
              updatedPhotosMap.set(st.id, b64);
              if (st.admissionNumber) updatedPhotosMap.set(st.admissionNumber, b64);
            }
          }
        }
        await exportBulkAdmitCardsToPdf({
          students: studentList,
          exam,
          settings,
          getStudentSchedule,
          photosMap: updatedPhotosMap,
          logoBase64,
          sigBase64,
        }, action);
      } else {
        let studentPhoto =
          photosMap.get(currentStudent.id) ||
          photosMap.get(currentStudent.admissionNumber) ||
          null;

        if (!studentPhoto) {
          studentPhoto = await resolveStudentPhotoBase64(
            currentStudent,
            `admit-card-student-photo-${currentStudent.id}`
          );
        }

        if (studentPhoto) {
          const raster = await ensureRasterJpegOrPng(studentPhoto);
          if (raster) studentPhoto = raster;
          setPhotosMap((prev) => {
            const next = new Map(prev);
            next.set(currentStudent.id, studentPhoto!);
            if (currentStudent.admissionNumber) next.set(currentStudent.admissionNumber, studentPhoto!);
            return next;
          });
        }

        await exportAdmitCardToPdf({
          student: currentStudent,
          exam,
          settings,
          schedule: getStudentSchedule(currentStudent),
          photoBase64: studentPhoto,
          logoBase64,
          sigBase64,
        }, action);
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const renderSingleAdmitCard = (st: Student) => {
    const applicableSchedule = getStudentSchedule(st);
    const photoSrc =
      photosMap.get(st.id) ||
      photosMap.get(st.admissionNumber) ||
      (st.photo ? fileUploadService.getFileUrl(st.photo) : '');

    const logoSrc = logoBase64 || getSchoolLogoSrc(settings.schoolLogo);
    const sigSrc = sigBase64 || (settings.principalSignature ? fileUploadService.getFileUrl(settings.principalSignature) : '');

    return (
      <div
        key={st.id}
        className="admit-card-page bg-white p-5 sm:p-7 font-serif text-slate-900 border border-slate-300 rounded-lg shadow-sm mb-6 print:mb-0 print:border-none print:shadow-none print:p-5 print:break-inside-avoid print:page-break-inside-avoid print:break-after-page"
        style={{ boxSizing: 'border-box' }}
      >
        {/* School Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={settings.schoolName}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-contain border border-slate-300 p-0.5 bg-white shrink-0"
                  referrerPolicy="no-referrer"
                  onError={handleLogoError}
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-blue-900 text-amber-300 flex items-center justify-center border border-slate-300 shrink-0">
                  <GraduationCap className="w-8 h-8 text-amber-400" />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 leading-tight">
                  {settings.schoolName}
                </h1>
                <p className="text-[10.5px] font-sans text-slate-600 leading-tight mt-0.5">
                  {settings.schoolAddress}
                </p>
                <p className="text-[9.5px] font-sans font-bold text-slate-700 mt-0.5">
                  {letterheadLine(schoolIdentity(settings)) || 'School details not configured'}
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block shrink-0">
              <span className="inline-block px-2.5 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 rounded text-[10.5px] font-bold font-sans uppercase tracking-wider">
                Official Hall Ticket
              </span>
              <p className="text-[9.5px] font-sans text-slate-500 mt-0.5">Session {exam.academicSession || settings.currentAcademicSession}</p>
            </div>
          </div>

          <div className="text-center mt-2.5 pt-1.5 border-t border-dashed border-slate-300">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest font-sans text-slate-900 inline-block px-3.5 py-0.5 bg-slate-100 rounded">
              ADMIT CARD: {exam.name || exam.title} ({exam.examType ? exam.examType.replace('_', ' ') : 'EXAMINATION'})
            </h2>
          </div>
        </div>

        {/* Student Particulars and Photo */}
        <div className="flex flex-col sm:flex-row items-start gap-3.5 border border-slate-300 p-3 mb-4 bg-slate-50/60 rounded">
          <div className="shrink-0 flex flex-col items-center">
            {photoSrc ? (
              <img
                id={`admit-card-student-photo-${st.id}`}
                src={photoSrc}
                alt={st.name}
                className="w-20 h-24 sm:w-22 sm:h-26 rounded object-cover border border-slate-400 shadow-2xs bg-white"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  const b64 = captureDomImageAsBase64(target);
                  if (b64) {
                    setPhotosMap((prev) => {
                      if (prev.has(st.id)) return prev;
                      const next = new Map(prev);
                      next.set(st.id, b64);
                      if (st.admissionNumber) next.set(st.admissionNumber, b64);
                      return next;
                    });
                  }
                }}
              />
            ) : (
              <div className="w-20 h-24 sm:w-22 sm:h-26 rounded bg-slate-200 text-slate-600 font-bold text-xl flex flex-col items-center justify-center border border-slate-400">
                <span>{st.name?.charAt(0) || 'S'}</span>
                <span className="text-[8.5px] font-sans uppercase text-slate-500 mt-1">Photo</span>
              </div>
            )}
            <span className="text-[9px] font-mono text-slate-600 mt-1 font-sans font-semibold">
              Roll No: {st.rollNumber || '—'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 text-xs font-sans flex-1 w-full">
            <div>
              <span className="text-slate-500 text-[10.5px] block">Candidate's Full Name:</span>
              <strong className="text-slate-900 text-[13px] uppercase">{st.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Class & Section:</span>
              <strong className="text-slate-900 text-[13px]">{st.className} - Section {st.section}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Admission / Scholar No:</span>
              <strong className="text-slate-900 font-mono">{st.admissionNumber}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Registration No:</span>
              <strong className="text-slate-900 font-mono">{st.registrationNumber || st.admissionNumber}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Father's / Guardian's Name:</span>
              <strong className="text-slate-900">{st.parentName || st.fatherName || 'Guardian'}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Date of Birth:</span>
              <strong className="text-slate-900">{st.dob || '—'}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Examination Venue / Center:</span>
              <strong className="text-slate-900">{exam.roomVenue || 'Main Campus Examination Hall'}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10.5px] block">Admit Card Status:</span>
              <span className="inline-flex items-center px-2 py-0.2 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                VERIFIED & ISSUED
              </span>
            </div>
          </div>
        </div>

        {/* Timetable / Schedule Table */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-slate-800">
              Examination Schedule & Seating Allotment
            </h3>
            <span className="text-[9.5px] font-sans text-slate-500">
              * Candidate must be seated 15 mins prior to start time
            </span>
          </div>

          <table className="w-full text-left border-collapse border border-slate-900 text-xs font-sans">
            <thead>
              <tr className="bg-slate-200 border-b border-slate-900 text-slate-900 font-bold">
                <th className="border border-slate-900 py-1.5 px-2 w-8 text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2">Date & Day</th>
                <th className="border border-slate-900 py-1.5 px-2">Subject Name</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">Time</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">Max Marks</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">Room / Hall</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center w-24">Invigilator Sign</th>
              </tr>
            </thead>
            <tbody>
              {applicableSchedule.length > 0 ? (
                applicableSchedule.map((item, idx) => {
                  let dayOfWeek = '';
                  try {
                    if (item.date) {
                      const d = new Date(item.date);
                      dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
                    }
                  } catch {
                    dayOfWeek = '';
                  }

                  return (
                    <tr key={item.id || idx} className="border-b border-slate-300">
                      <td className="border border-slate-900 py-1 px-2 text-center font-bold text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-semibold">
                        {item.date} {dayOfWeek ? `(${dayOfWeek})` : ''}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-bold text-slate-900">
                        {item.subjectName}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center font-semibold">
                        {item.startTime} - {item.endTime}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center">
                        {item.maxMarks || 100}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center text-slate-700">
                        {item.roomNumber || exam.roomVenue || 'Exam Hall'}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center text-slate-400">
                        &nbsp;
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="border border-slate-900 p-3 text-center text-slate-500 font-sans">
                    No scheduled papers registered for {st.className} in this examination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Instructions */}
        <div className="border border-slate-300 rounded p-2.5 mb-4 bg-slate-50/40 text-[10px] font-sans">
          <strong className="block text-slate-900 font-bold mb-1 uppercase tracking-wider text-[9.5px]">
            Rules & Instructions for Candidates:
          </strong>
          <ol className="list-decimal pl-4 space-y-0.5 text-slate-700 leading-normal">
            <li>Candidates must occupy their allotted seats 15 minutes before the scheduled time. No entry will be permitted after commencement.</li>
            <li>Admit Card along with School ID Card must be produced on all examination days.</li>
            <li>Mobile phones, smartwatches, digital calculators, study notes, or any electronic devices are strictly prohibited inside the hall.</li>
            <li>Use only blue or royal blue ballpoint pen for writing answers. Borrowing stationery during exam hours is strictly disallowed.</li>
            <li>{exam.instructions || 'Any candidate caught using unfair means will be disqualified immediately as per school examination bylaws.'}</li>
          </ol>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-4 text-center text-xs font-sans pt-3 border-t border-slate-400">
          <div>
            <div className="h-8 border-b border-dashed border-slate-500 mx-3 sm:mx-6"></div>
            <span className="font-semibold block mt-1 text-slate-700 text-[11px]">Candidate's Signature</span>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-slate-500 mx-3 sm:mx-6"></div>
            <span className="font-semibold block mt-1 text-slate-700 text-[11px]">Class Teacher's Signature</span>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-slate-500 mx-3 sm:mx-6 flex items-center justify-center">
              {sigSrc ? (
                <img
                  src={sigSrc}
                  alt="Principal Signature"
                  className="max-h-7 max-w-[110px] object-contain"
                />
              ) : null}
            </div>
            <span className="font-bold block mt-1 text-slate-900 text-[11px]">{settings.principalName || 'Principal'}</span>
            <span className="text-[9.5px] text-slate-500 block">Controller of Examinations</span>
          </div>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div className="admit-card-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-100 rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl my-2 sm:my-4 overflow-hidden flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:m-0 print:bg-white">
        
        {/* ========================================================================= */}
        {/* RESPONSIVE HEADER TOOLBAR (Hidden in Print) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 text-white shrink-0 sticky top-0 z-30 print:hidden border-b border-slate-800">
          <div className="px-3.5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950 shrink-0">
                HALL TICKET
              </span>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white truncate block">
                  {exam.name || exam.title}
                </span>
                <p className="text-[11px] text-slate-300 truncate">
                  {isBulkViewAll ? `All Class Students (${studentList.length})` : `${currentStudent.name} • Adm: ${currentStudent.admissionNumber} • Class ${currentStudent.className}-${currentStudent.section}`}
                </p>
              </div>
            </div>

            {/* Action Bar: Preview | Download PDF | Print | Close */}
            <div className="flex items-center gap-2 shrink-0">
              {studentList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsBulkViewAll(!isBulkViewAll)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isBulkViewAll ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isBulkViewAll ? 'Single View' : 'View All Class Cards'}</span>
                  </button>

                  {!isBulkViewAll && (
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
                      <button
                        type="button"
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                        title="Previous Student"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2 font-mono text-[11px] text-slate-300">
                        {currentIndex + 1} / {studentList.length}
                      </span>
                      <button
                        type="button"
                        disabled={currentIndex === studentList.length - 1}
                        onClick={() => setCurrentIndex((prev) => Math.min(studentList.length - 1, prev + 1))}
                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                        title="Next Student"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Download PDF Button */}
              <button
                type="button"
                onClick={() => handleDownloadPdf()}
                disabled={isExportingPdf}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-slate-100 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Download High-Resolution A4 Admit Card PDF"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>
                  {isExportingPdf
                    ? 'Exporting...'
                    : isBulkViewAll
                    ? `Download All (${studentList.length})`
                    : 'Download PDF'}
                </span>
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Print Clean A4 Admit Card"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isBulkViewAll ? `Print All (${studentList.length})` : 'Print'}</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Printable Sheet Container */}
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[85vh] print:max-h-none print:overflow-visible print:p-0">
          {isBulkViewAll ? (
            studentList.map((st) => renderSingleAdmitCard(st))
          ) : (
            renderSingleAdmitCard(currentStudent)
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
