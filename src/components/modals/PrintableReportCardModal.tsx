import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X, GraduationCap, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { SchoolSettings, Student, Subject, Exam, ExamMark } from '../../types';
import { api } from '../../services/api';
import { fileUploadService } from '../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { buildMarksheet } from '../../utils/marksheetModel';
import { makeMarksheetQr } from '../../utils/marksheetExtras';
import { exportReportCardToPdf, exportBulkReportCardsToPdf } from '../../utils/reportCardPdfExporter';
import { getDocumentImageBase64Async, preloadDocumentAssets } from '../../utils/documentImageHelper';

interface PrintableReportCardModalProps {
  student?: Student | null;
  students?: Student[];
  subjects?: Subject[];
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  examId?: string;
  isBulk?: boolean;
}

// Stable empty defaults: a fresh `[]` default on every render made the effects below re-run forever.
const NO_STUDENTS: Student[] = [];
const NO_SUBJECTS: Subject[] = [];

export const PrintableReportCardModal: React.FC<PrintableReportCardModalProps> = ({
  student: initialStudent,
  students = NO_STUDENTS,
  subjects = NO_SUBJECTS,
  isOpen,
  onClose,
  settings: initialSettings,
  examId,
  isBulk = false,
}) => {
  const [activeSettings, setActiveSettings] = useState<SchoolSettings>(() => initialSettings || api.getSettings());
  const [freshStudentsMap, setFreshStudentsMap] = useState<Map<string, Student>>(new Map());
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [photosMap, setPhotosMap] = useState<Map<string, string>>(new Map());
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [sigBase64, setSigBase64] = useState<string | null>(null);
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());

  // Deduplicated list of applicable students
  const studentList = useMemo(() => {
    const list: Student[] = [];
    const seen = new Set<string>();

    const rawList = students && students.length > 0 ? students : initialStudent ? [initialStudent] : [];
    for (const s of rawList) {
      const key = s.id || s.admissionNumber;
      if (!seen.has(key)) {
        seen.add(key);
        // Use fresh student if available in fresh map
        const fresh = freshStudentsMap.get(s.id) || freshStudentsMap.get(s.admissionNumber) || s;
        list.push(fresh);
      }
    }
    return list;
  }, [students, initialStudent, freshStudentsMap]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'SINGLE' | 'ALL'>(isBulk && studentList.length > 1 ? 'ALL' : 'SINGLE');

  // Track modal active for print stylesheet isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('report-card-modal-active');
      return () => {
        document.body.classList.remove('report-card-modal-active');
      };
    }
  }, [isOpen]);

  // Fetch the currently selected student's latest data from MongoDB through Student API
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setIsLoadingFresh(true);

      const targetStudents = students && students.length > 0 ? students : initialStudent ? [initialStudent] : [];
      const fetchPromises = targetStudents.slice(0, 10).map((st) => api.fetchStudentDirect(st.id));

      Promise.all(fetchPromises)
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
          console.warn('[ReportCardModal] Error syncing student data from MongoDB:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingFresh(false);
        });

      // Also dynamically refresh school settings
      api
        .syncSettings()
        .then((freshSettings) => {
          if (isMounted && freshSettings) {
            setActiveSettings(freshSettings);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
    // Keyed on the ids, not the array, so a parent re-render never restarts the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStudent?.id, (students || []).map((x) => x.id).join(',')]);

  // Preload base64 images for student photos, crest, and principal signature
  useEffect(() => {
    let isMounted = true;
    if (isOpen && studentList.length > 0) {
      preloadDocumentAssets(studentList, activeSettings)
        .then((assets) => {
          if (!isMounted) return;
          setLogoBase64(assets.logoBase64);
          setSigBase64(assets.sigBase64);
          setPhotosMap(assets.photosMap);
        })
        .catch((err) => {
          console.warn('[ReportCardModal] Asset preload warning:', err);
        });
    }
    return () => {
      isMounted = false;
    };
    // Only the things that decide which images to load; not object identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    studentList.map((x) => `${x.id}|${x.photo || x.photoFileKey || ''}`).join(','),
    activeSettings.schoolLogo,
    activeSettings.principalSignature,
  ]);

  // Sync index when student changes
  useEffect(() => {
    if (initialStudent && studentList.length > 0) {
      const idx = studentList.findIndex((s) => s.id === initialStudent.id);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [initialStudent, studentList]);

  // Ensure viewMode is properly set when isBulk changes
  useEffect(() => {
    if (isBulk && studentList.length > 1) {
      setViewMode('ALL');
    } else {
      setViewMode('SINGLE');
    }
  }, [isBulk, studentList.length]);

  const currentStudent = studentList[currentIndex] || studentList[0];

  // Resolve exam
  const exams = api.getExams();
  const examIdToUse = examId || exams[0]?.id || '';
  const currentExam = exams.find((e) => e.id === examIdToUse) || exams[0];

  // Load marks for the exam from memory and sync fresh from server
  const [allExamMarks, setAllExamMarks] = useState<ExamMark[]>(() =>
    examIdToUse ? api.getExamMarks(examIdToUse) : []
  );

  useEffect(() => {
    if (examIdToUse) {
      setAllExamMarks(api.getExamMarks(examIdToUse));
      api.fetchExamMarks(examIdToUse).then((fresh) => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          setAllExamMarks(fresh);
        }
      });
    }
  }, [examIdToUse]);

  const [, setSubjectsRevision] = useState(0);

  // Pre-fetch class subjects for all student classes
  useEffect(() => {
    const classIds = Array.from(new Set(studentList.map((s) => s.classId).filter(Boolean))) as string[];
    if (classIds.length > 0) {
      Promise.all(classIds.map((cid: string) => api.fetchClassSubjects(cid)))
        .then(() => {
          setSubjectsRevision((prev) => prev + 1);
        })
        .catch(() => {});
    }
  }, [studentList]);

  // Helper: Get strictly active subjects assigned to a student's class
  const getStudentClassSubjects = (st: Student): Subject[] => {
    if (!st.classId) return [];

    // Prioritize explicitly passed subjects if matching student's class
    if (subjects && subjects.length > 0) {
      const matched = subjects.filter(
        (s) =>
          (s.status || 'ACTIVE') === 'ACTIVE' &&
          Array.isArray(s.classIds) &&
          s.classIds.includes(st.classId)
      );
      if (matched.length > 0) {
        const seen = new Set<string>();
        const list: Subject[] = [];
        for (const sub of matched) {
          if (!seen.has(sub.id)) {
            seen.add(sub.id);
            list.push(sub);
          }
        }
        return list;
      }
    }

    const apiSubs = api.getActiveSubjects(st.classId);
    const seen = new Set<string>();
    const list: Subject[] = [];
    for (const sub of apiSubs) {
      if (
        (sub.status || 'ACTIVE') === 'ACTIVE' &&
        Array.isArray(sub.classIds) &&
        sub.classIds.includes(st.classId) &&
        !seen.has(sub.id)
      ) {
        seen.add(sub.id);
        list.push(sub);
      }
    }
    return list;
  };

  // QR code per student (plain-text student details + result), built from the same marksheet model
  useEffect(() => {
    let alive = true;
    if (!isOpen) return;
    Promise.all(
      studentList.map(async (st) => {
        const sheet = buildMarksheet(getStudentClassSubjects(st), allExamMarks.filter((m) => m.studentId === st.id));
        return [st.id, await makeMarksheetQr(st, sheet)] as const;
      })
    ).then((pairs) => {
      if (!alive) return;
      const map = new Map<string, string>();
      pairs.forEach(([id, url]) => { if (url) map.set(id, url); });
      setQrMap(map);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentList, allExamMarks, subjects]);

  if (!isOpen || studentList.length === 0) return null;

  // Print action
  // Print the same A4 PDF that Download produces so the two always match.
  const handlePrint = () => handleDownloadPdf('print');

  // Helper: marks, totals and result for one student (shared with the PDF export)
  const getStudentEvaluationData = (st: Student) => {
    const sheet = buildMarksheet(
      getStudentClassSubjects(st),
      allExamMarks.filter((m) => m.studentId === st.id)
    );
    return { sheet };
  };

  // PDF Export Action
  const handleDownloadPdf = async (action: 'download' | 'print' = 'download') => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      if (viewMode === 'ALL' && studentList.length > 1) {
        await exportBulkReportCardsToPdf({
          settings: activeSettings,
          exam: currentExam,
          students: studentList,
          marksList: allExamMarks,
          getStudentSubjects: getStudentClassSubjects,
          photosMap,
          logoBase64,
          sigBase64,
        }, action);
      } else {
        const studentPhoto = photosMap.get(currentStudent.id) || photosMap.get(currentStudent.admissionNumber) || null;
        await exportReportCardToPdf({
          settings: activeSettings,
          exam: currentExam,
          student: currentStudent,
          subjects: getStudentClassSubjects(currentStudent),
          marksList: allExamMarks,
          photoBase64: studentPhoto,
          logoBase64,
          sigBase64,
        }, action);
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Single Card Renderer
  const renderSingleReportCard = (st: Student) => {
    const data = getStudentEvaluationData(st);
    const examTitle = currentExam?.name || currentExam?.title || 'Academic Assessment';
    const session = currentExam?.academicSession || st.academicSession || activeSettings.currentAcademicSession || '2026-2027';
    const father = st.fatherName || st.parentName || '';
    const mother = st.motherName || '';
    const regNo = st.registrationNumber || `PDS${st.admissionNumber}`;

    const photoSrc =
      photosMap.get(st.id) ||
      photosMap.get(st.admissionNumber) ||
      (st.photo ? fileUploadService.getFileUrl(st.photo) : '');

    const logoSrc = logoBase64 || getSchoolLogoSrc(activeSettings.schoolLogo);
    const sigSrc =
      sigBase64 ||
      (activeSettings.principalSignature
        ? fileUploadService.getFileUrl(activeSettings.principalSignature)
        : '');

    return (
      <div
        key={st.id}
        className="report-card-page bg-white p-4 sm:p-6 font-serif text-slate-900 border border-slate-300 rounded-xl shadow-xs mb-6 print:mb-0 print:border-slate-900 print:shadow-none print:p-4 print:break-inside-avoid print:page-break-inside-avoid print:break-after-page print:rounded-none"
        style={{ boxSizing: 'border-box' }}
      >
        {/* School Header */}
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-3">
          <div className="flex items-center justify-center gap-3 mb-1.5">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={activeSettings.schoolName}
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg border border-slate-200"
                referrerPolicy="no-referrer"
                onError={handleLogoError}
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-blue-900 text-amber-300 flex items-center justify-center border border-slate-300 shrink-0">
                <GraduationCap className="w-8 h-8 text-amber-400" />
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-slate-950 font-serif">
                {activeSettings.schoolName}
              </h2>
              <p className="text-xs font-sans text-slate-600">{activeSettings.schoolAddress}</p>
              <p className="text-[10px] font-sans font-semibold text-slate-700">
                {[
                  activeSettings.affiliatedBoard ? `Affiliated to ${activeSettings.affiliatedBoard}` : '',
                  activeSettings.affiliationCode || activeSettings.affiliationNumber ? `Affiliation No: ${activeSettings.affiliationCode || activeSettings.affiliationNumber}` : '',
                  activeSettings.schoolCode ? `School Code: ${activeSettings.schoolCode}` : '',
                ].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
          <div className="inline-block border border-slate-900 px-3.5 py-0.5 mt-0.5 text-xs font-bold uppercase tracking-widest bg-slate-50 font-sans">
            Official Examination Marksheet • Academic Session {session}
          </div>
        </div>

        {/* Student Demographic Matrix */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 border border-slate-300 p-2.5 sm:p-3 mb-3.5 bg-slate-50/60 rounded-lg">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={st.name}
              className="w-[84px] h-[105px] rounded-md object-cover object-top border border-slate-300 shadow-2xs shrink-0 bg-white"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-[84px] h-[105px] rounded-md bg-slate-200 text-slate-700 font-bold text-2xl flex items-center justify-center border border-slate-300 shrink-0">
              {st.name.charAt(0)}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-5 text-xs font-sans flex-1 w-full">
            <div>
              <span className="text-slate-500">Student Name:</span>{' '}
              <strong className="text-slate-950 uppercase font-bold">{st.name}</strong>
            </div>
            <div>
              <span className="text-slate-500">Class & Section:</span>{' '}
              <strong className="text-slate-950">{st.className || 'Class'} - {st.section || 'A'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Admission No:</span>{' '}
              <strong className="text-slate-950 font-mono font-bold">{st.admissionNumber}</strong>
            </div>
            <div>
              <span className="text-slate-500">Roll No:</span>{' '}
              <strong className="text-slate-950 font-mono">{st.rollNumber || '—'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Registration No:</span>{' '}
              <strong className="text-slate-950 font-mono">{regNo}</strong>
            </div>
            <div>
              <span className="text-slate-500">Date of Birth:</span>{' '}
              <strong className="text-slate-950">{st.dob || '—'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Gender:</span>{' '}
              <strong className="text-slate-950">{st.gender || '—'}</strong>
            </div>
            {father && (
              <div>
                <span className="text-slate-500">Father&apos;s Name:</span>{' '}
                <strong className="text-slate-950">{father}</strong>
              </div>
            )}
            {mother && (
              <div>
                <span className="text-slate-500">Mother&apos;s Name:</span>{' '}
                <strong className="text-slate-950">{mother}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Scholastic Marks Table */}
        <h4 className="text-xs font-bold font-sans uppercase tracking-wider mb-1.5 text-slate-800">
          Scholastic Performance ({examTitle})
        </h4>
        <div className="overflow-x-auto mb-3.5">
          <table className="w-full text-left border-collapse border border-slate-900 text-xs font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900 text-slate-900">
                <th className="border border-slate-900 py-1.5 px-2">Subject</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center w-20">Max Marks</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center w-24">Marks Obtained</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center w-16">Grade</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center w-24">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.sheet.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-900 p-4 text-center text-slate-500 italic">
                    No subjects are assigned to this class
                  </td>
                </tr>
              ) : (
                data.sheet.rows.map((row) => (
                  <tr key={row.subjectId} className="border-b border-slate-300">
                    <td className="border border-slate-900 py-1 px-2 font-semibold text-slate-900">{row.subjectName}</td>
                    <td className="border border-slate-900 py-1 px-2 text-center text-slate-700">{row.maxMarks}</td>
                    <td className="border border-slate-900 py-1 px-2 text-center font-bold text-slate-900">
                      {row.result === 'PENDING' ? <span className="text-slate-400">—</span> : row.isAbsent ? <span className="text-red-600 font-bold">AB</span> : row.obtained}
                    </td>
                    <td className={`border border-slate-900 py-1 px-2 text-center font-bold ${row.result === 'FAIL' || row.result === 'ABSENT' ? 'text-red-700' : 'text-blue-900'}`}>
                      {row.grade}
                    </td>
                    <td className={`border border-slate-900 py-1 px-2 text-center font-semibold ${row.result === 'PASS' ? 'text-emerald-800' : row.result === 'PENDING' ? 'text-slate-500' : 'text-red-700'}`}>
                      {row.result === 'PENDING' ? 'Pending' : row.result === 'ABSENT' ? 'Absent' : row.result === 'PASS' ? 'Pass' : 'Fail'}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                <td className="border border-slate-900 py-1.5 px-2 uppercase">Total</td>
                <td className="border border-slate-900 py-1.5 px-2 text-center">{data.sheet.totalMax}</td>
                <td className="border border-slate-900 py-1.5 px-2 text-center text-slate-900">{data.sheet.totalObtained}</td>
                <td className="border border-slate-900 py-1.5 px-2 text-center">{data.sheet.grade}</td>
                <td className="border border-slate-900 py-1.5 px-2 text-center">
                  {data.sheet.totalMax > 0 ? `${data.sheet.percentage.toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Result */}
        <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-900 px-3 py-2 mb-3.5 text-xs font-sans">
          <span className="font-bold uppercase tracking-wide text-slate-700">Result</span>
          <span
            className={`font-bold uppercase tracking-wide ${
              data.sheet.result === 'PASS' ? 'text-emerald-800' : data.sheet.result === 'FAIL' ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            {data.sheet.result === 'INCOMPLETE'
              ? `Incomplete — marks pending for ${data.sheet.pendingCount} subject${data.sheet.pendingCount === 1 ? '' : 's'}`
              : data.sheet.result === 'NO MARKS'
              ? 'Marks not yet published'
              : data.sheet.result}
          </span>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs font-sans pt-3 border-t border-slate-400">
          <div>
            <div className="h-7 border-b border-dashed border-slate-500 mx-3 sm:mx-6 flex items-center justify-center">
              {activeSettings.examControllerSignature ? (
                <img
                  src={fileUploadService.getFileUrl(activeSettings.examControllerSignature)}
                  alt="Controller of Examinations signature"
                  className="max-h-7 max-w-[110px] object-contain"
                />
              ) : null}
            </div>
            <span className="font-bold block mt-1 text-slate-900 text-[11px]">{activeSettings.examControllerName || 'Controller of Examinations'}</span>
            {activeSettings.examControllerName && <span className="text-[9.5px] text-slate-500 block">Controller of Examinations</span>}
          </div>
          <div className="flex flex-col items-center">
            {qrMap.get(st.id) ? (
              <img src={qrMap.get(st.id)} alt="Student details QR" className="w-24 h-24 -mt-3 border border-slate-300 bg-white" />
            ) : (
              <div className="w-24 h-24 -mt-3 border border-dashed border-slate-300" />
            )}
            <span className="text-[9.5px] text-slate-500 block mt-0.5">Scan to view student details</span>
          </div>
          <div>
            <div className="h-7 border-b border-dashed border-slate-500 mx-3 sm:mx-6 flex items-center justify-center">
              {sigSrc ? (
                <img
                  src={sigSrc}
                  alt="Principal Signature"
                  className="max-h-7 max-w-[110px] object-contain"
                />
              ) : null}
            </div>
            <span className="font-bold block mt-1 text-slate-900 text-[11px]">{activeSettings.principalName || 'Principal'}</span>
            <span className="text-[9.5px] text-slate-500 block">Principal / Head of School</span>
          </div>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div className="report-card-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-2 sm:my-4 overflow-hidden flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:m-0">
        
        {/* ========================================================================= */}
        {/* RESPONSIVE HEADER TOOLBAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 text-white shrink-0 sticky top-0 z-30 print:hidden border-b border-slate-800">
          <div className="px-3.5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors border border-slate-700 cursor-pointer"
                title="Return to Reports & ID Cards"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <GraduationCap className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                    {currentExam?.name || currentExam?.title || 'Academic Report Card'}
                  </h3>
                  {isLoadingFresh && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Syncing...
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  {viewMode === 'ALL'
                    ? `Consolidated Class Marksheets (${studentList.length} Students)`
                    : `${currentStudent.name} • Adm: ${currentStudent.admissionNumber} • Class ${currentStudent.className}-${currentStudent.section}`}
                </p>
              </div>
            </div>

            {/* Actions: View Toggle, Navigation, Download | Print | Close */}
            <div className="flex items-center gap-2 shrink-0">
              {studentList.length > 1 && (
                <>
                  <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setViewMode('SINGLE')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        viewMode === 'SINGLE' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Single View
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        viewMode === 'ALL' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      All ({studentList.length})
                    </button>
                  </div>

                  {viewMode === 'SINGLE' && (
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
                title="Download High-Resolution A4 Marksheet PDF"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>
                  {isExportingPdf
                    ? 'Exporting...'
                    : viewMode === 'ALL'
                    ? `Download All (${studentList.length})`
                    : 'Download PDF'}
                </span>
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                disabled={isExportingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Print Clean A4 Report Card"
              >
                {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                <span>{isExportingPdf ? 'Preparing...' : viewMode === 'ALL' ? `Print All (${studentList.length})` : 'Print'}</span>
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
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[85vh] bg-slate-100 print:bg-white print:max-h-none print:overflow-visible print:p-0">
          {viewMode === 'ALL' ? (
            studentList.map((st) => renderSingleReportCard(st))
          ) : (
            renderSingleReportCard(currentStudent)
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
