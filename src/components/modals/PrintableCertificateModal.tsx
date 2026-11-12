import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X, Award, GraduationCap, Loader2 } from 'lucide-react';
import { SchoolSettings, Student, CertificateType } from '../../types';
import { api } from '../../services/api';
import { fileUploadService } from '../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { exportCertificateToPdf } from '../../utils/certificatePdfExporter';
import { getDocumentImageBase64Async, preloadDocumentAssets, resolveStudentPhotoBase64 } from '../../utils/documentImageHelper';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity } from '../../utils/schoolIdentity';

interface PrintableCertificateModalProps {
  student: Student | null;
  certType: CertificateType;
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
}

export const PrintableCertificateModal: React.FC<PrintableCertificateModalProps> = ({
  student: initialStudent,
  certType: initialCertType,
  isOpen,
  onClose,
  settings: initialSettings,
}) => {
  const [currentCertType, setCurrentCertType] = useState<CertificateType>(initialCertType || 'BONAFIDE');
  const [activeStudent, setActiveStudent] = useState<Student | null>(initialStudent);
  const [activeSettings, setActiveSettings] = useState<SchoolSettings>(() => initialSettings || api.getSettings());
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [sigBase64, setSigBase64] = useState<string | null>(null);

  // Sync initial student whenever prop changes
  useEffect(() => {
    if (initialStudent) {
      setActiveStudent(initialStudent);
    }
  }, [initialStudent]);

  // Fetch the currently selected student's latest data from MongoDB through Student API
  useEffect(() => {
    let isMounted = true;
    if (isOpen && initialStudent?.id) {
      setIsLoadingFresh(true);
      api
        .fetchStudentDirect(initialStudent.id)
        .then((fresh) => {
          if (isMounted && fresh) {
            setActiveStudent(fresh);
          }
        })
        .catch((err) => {
          console.warn('[CertificateModal] Error loading fresh student data from MongoDB:', err);
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
  }, [isOpen, initialStudent?.id]);

  // Preload base64 images for student photo, school crest, and principal signature
  useEffect(() => {
    let isMounted = true;
    if (isOpen && activeStudent) {
      preloadDocumentAssets([activeStudent], activeSettings).then((assets) => {
        if (!isMounted) return;
        setLogoBase64(assets.logoBase64);
        setSigBase64(assets.sigBase64);
        setPhotoBase64(assets.photosMap.get(activeStudent.id) || null);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeStudent?.id, activeSettings]);

  // Body print class for complete print isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('certificate-modal-active');
      return () => {
        document.body.classList.remove('certificate-modal-active');
      };
    }
  }, [isOpen]);

  if (!isOpen || !activeStudent) return null;

  const currentStudent = activeStudent;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!currentStudent) return;
    setIsExportingPdf(true);
    try {
      // Ensure all visual assets (student photo, logo, signature) are fully loaded and rasterized before generation
      let currentPhoto = photoBase64;
      let currentLogo = logoBase64;
      let currentSig = sigBase64;

      if (!currentPhoto && (currentStudent.photo || currentStudent.photoFileKey || (currentStudent as any).photoUrl || (currentStudent as any).avatar)) {
        currentPhoto = await resolveStudentPhotoBase64(
          currentStudent,
          `certificate-student-photo-${currentStudent.id}`
        );
        if (currentPhoto) setPhotoBase64(currentPhoto);
      }

      if (!currentLogo) {
        currentLogo = await getDocumentImageBase64Async(activeSettings.schoolLogo, true);
        if (currentLogo) setLogoBase64(currentLogo);
      }

      if (!currentSig && activeSettings.principalSignature) {
        currentSig = await getDocumentImageBase64Async(activeSettings.principalSignature);
        if (currentSig) setSigBase64(currentSig);
      }

      await exportCertificateToPdf({
        student: currentStudent,
        certType: currentCertType,
        settings: activeSettings,
        photoBase64: currentPhoto,
        logoBase64: currentLogo,
        sigBase64: currentSig,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const studentFather = currentStudent.fatherName || currentStudent.parentName || 'Father';
  const studentMother = currentStudent.motherName || 'Verified Mother';
  const session = currentStudent.academicSession || activeSettings.currentAcademicSession || '2026-2027';
  const regNo = currentStudent.registrationNumber || `CPS${currentStudent.admissionNumber}`;
  const studentAddress = `${currentStudent.address || ''}, ${currentStudent.city || ''}, ${currentStudent.state || 'Bihar'} - ${currentStudent.pincode || '843329'}`.trim();
  // Only saved School Settings values; missing ones print as "Not configured".
  const affiliationCode = activeSettings.affiliationCode || activeSettings.affiliationNumber || NOT_CONFIGURED;
  const schoolCode = activeSettings.schoolCode || NOT_CONFIGURED;
  const affiliatedBoard = activeSettings.affiliatedBoard || NOT_CONFIGURED;

  const photoSrc =
    photoBase64 ||
    (currentStudent.photo ? fileUploadService.getFileUrl(currentStudent.photo) : '');

  const logoSrc = logoBase64 || getSchoolLogoSrc(activeSettings.schoolLogo);
  const sigSrc =
    sigBase64 ||
    (activeSettings.principalSignature
      ? fileUploadService.getFileUrl(activeSettings.principalSignature)
      : '');

  const modalContent = (
    <div className="certificate-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-2 sm:my-4 overflow-hidden flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:m-0">
        
        {/* ========================================================================= */}
        {/* FIXED / RESPONSIVE HEADER TOOLBAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 text-white shrink-0 sticky top-0 z-30 print:hidden border-b border-slate-800">
          
          {/* Top Row: Title, Student Info, Close */}
          <div className="px-3.5 sm:px-6 py-2.5 flex items-center justify-between border-b border-slate-800/80 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Award className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                    Institutional Certificate
                  </h3>
                  {isLoadingFresh && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading…
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  {currentStudent.name} • Adm: <span className="font-mono font-bold text-amber-300">{currentStudent.admissionNumber}</span> • Class {currentStudent.className}-{currentStudent.section}
                </p>
              </div>
            </div>

            {/* Always visible Close (X) button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Row: Certificate Type Selector + Download & Print Actions */}
          <div className="px-3.5 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90">
            {/* Certificate Type Selector Tabs */}
            <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCurrentCertType('BONAFIDE')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  currentCertType === 'BONAFIDE' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Bonafide
              </button>
              <button
                type="button"
                onClick={() => setCurrentCertType('CHARACTER')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  currentCertType === 'CHARACTER' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Character
              </button>
              <button
                type="button"
                onClick={() => setCurrentCertType('TC')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  currentCertType === 'TC' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Transfer (TC)
              </button>
            </div>

            {/* Actions: Download | Print | Close */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isExportingPdf}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-slate-100 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="Download High-Resolution A4 Certificate PDF"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>{isExportingPdf ? 'Exporting...' : 'Download PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="Print Clean A4 Certificate"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold hidden sm:flex items-center gap-1 transition-colors cursor-pointer"
                title="Close"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PREVIEW CONTAINER & A4 PRINT ISOLATED SHEET */}
        {/* ========================================================================= */}
        <div className="overflow-x-auto overflow-y-auto max-h-[82vh] p-2 sm:p-5 bg-slate-100 print:bg-white print:p-0 print:overflow-visible print:max-h-none">
          <div className="certificate-sheet-container min-w-[620px] print:min-w-0 max-w-[780px] mx-auto p-4 sm:p-6 font-serif text-slate-900 bg-white border-4 sm:border-6 border-double border-slate-900 shadow-md print:shadow-none print:m-0 print:border-4 print:border-double print:border-slate-900 flex flex-col justify-between">
            
            {/* School Institutional Header - Horizontal Logo + School Info */}
            <div className="border-b border-slate-900 pb-2 mb-2">
              <div className="flex items-center justify-center gap-3.5 sm:gap-4.5">
                {/* Logo on the left side of the school name */}
                <div className="shrink-0 flex items-center justify-center">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={activeSettings.schoolName}
                      crossOrigin="anonymous"
                      className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded"
                      referrerPolicy="no-referrer"
                      onError={handleLogoError}
                    />
                  ) : (
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded bg-blue-900 text-amber-300 flex items-center justify-center p-0.5">
                      <GraduationCap className="w-8 h-8 text-amber-400" />
                    </div>
                  )}
                </div>

                {/* School Name & Institutional Details */}
                <div className="text-center">
                  <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950 font-serif leading-tight">
                    {activeSettings.schoolName}
                  </h2>
                  <p className="text-[11px] sm:text-xs font-sans text-slate-700 mt-0.5 leading-snug">
                    {activeSettings.schoolAddress}
                  </p>
                  <p className="text-[10px] sm:text-[10.5px] font-sans text-slate-600 font-medium leading-snug mt-0.5">
                    Affiliated to {affiliatedBoard} • Affiliation No: {affiliationCode} • School Code: {schoolCode}
                  </p>
                </div>
              </div>

              {/* Certificate Title Badge */}
              <div className="text-center mt-2">
                <div className="inline-block border border-slate-950 px-3.5 py-0.5 text-xs font-bold uppercase tracking-widest bg-slate-50 font-sans shadow-2xs">
                  {currentCertType === 'TC'
                    ? 'TRANSFER CERTIFICATE / SCHOOL LEAVING CERTIFICATE'
                    : currentCertType === 'CHARACTER'
                    ? 'CHARACTER & CONDUCT CERTIFICATE'
                    : 'BONAFIDE STUDY CERTIFICATE'}
                </div>
              </div>
            </div>

            {/* Certificate Meta & Student Photo */}
            <div className="flex items-center justify-between text-xs sm:text-sm font-sans mb-3 text-slate-700">
              <div className="space-y-1 sm:space-y-1.5">
                <p>
                  Cert Ref No:{' '}
                  <strong className="font-mono text-slate-950 font-bold">
                    {currentCertType}/2026/{currentStudent.admissionNumber}
                  </strong>
                </p>
                <p>
                  Date of Issue: <strong className="text-slate-950">{new Date().toLocaleDateString('en-GB')}</strong>
                </p>
                <p>
                  Student ID / Adm No:{' '}
                  <strong className="font-mono text-slate-950 font-bold">
                    {currentStudent.admissionNumber}
                  </strong>
                </p>
              </div>
              {photoSrc ? (
                <img
                  id={`certificate-student-photo-${currentStudent.id}`}
                  src={photoSrc}
                  alt={currentStudent.name}
                  crossOrigin="anonymous"
                  className="w-18 h-[90px] sm:w-22 sm:h-[110px] object-cover border border-slate-400 rounded shadow-xs"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img && img.complete && img.naturalWidth > 0 && !photoBase64) {
                      try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = '#FFFFFF';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(img, 0, 0);
                          const b64 = canvas.toDataURL('image/jpeg', 0.95);
                          if (b64) setPhotoBase64(b64);
                        }
                      } catch {}
                    }
                  }}
                />
              ) : (
                <div className="w-18 h-[90px] sm:w-22 sm:h-[110px] rounded bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-400 font-sans text-xs">
                  <span className="font-bold text-base text-slate-600">{currentStudent.name.charAt(0)}</span>
                  <span className="text-[10px]">PHOTO</span>
                </div>
              )}
            </div>

            {/* Certificate Body (Dynamic Student Data) */}
            {currentCertType === 'TC' ? (
              <div className="space-y-1.5 sm:space-y-2 text-xs font-sans print:space-y-2.5 print:text-[11px] print:leading-relaxed">
                <p>
                  1. Name of the Pupil:{' '}
                  <strong className="uppercase border-b border-slate-400 pb-0.5 px-2 text-slate-950 font-bold">
                    {currentStudent.name}
                  </strong>
                </p>
                <p>
                  2. Father&apos;s / Guardian&apos;s Name:{' '}
                  <strong className="uppercase border-b border-slate-400 pb-0.5 px-2 text-slate-950 font-bold">
                    {studentFather}
                  </strong>
                </p>
                <p>
                  3. Mother&apos;s Name:{' '}
                  <strong className="uppercase border-b border-slate-400 pb-0.5 px-2 text-slate-950 font-bold">
                    {studentMother}
                  </strong>
                </p>
                <p>
                  4. Nationality:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    Indian
                  </strong>
                </p>
                <p>
                  5. Category:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {currentStudent.category || 'GENERAL'}
                  </strong>
                </p>
                <p>
                  6. Gender:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {currentStudent.gender || 'MALE'}
                  </strong>
                </p>
                <p>
                  7. Institutional Admission Number:{' '}
                  <strong className="font-mono border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {currentStudent.admissionNumber}
                  </strong>
                </p>
                <p>
                  8. Class Roll Number:{' '}
                  <strong className="font-mono border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {currentStudent.rollNumber || '—'}
                  </strong>
                </p>
                <p>
                  9. Registration Number:{' '}
                  <strong className="font-mono border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {regNo}
                  </strong>
                </p>
                <p>
                  10. Date of Birth (in figures):{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {currentStudent.dob || '—'}
                  </strong>
                </p>
                <p>
                  11. Class in which pupil last studied:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {currentStudent.className} ({currentStudent.section})
                  </strong>
                </p>
                <p>
                  12. School / Board Annual Examination last taken with result:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    PROMOTED / PASSED
                  </strong>
                </p>
                <p>
                  13. Academic Session:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {session}
                  </strong>
                </p>
                <p>
                  14. Month up to which the pupil has paid school dues:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    ALL DUES CLEARED IN FULL
                  </strong>
                </p>
                <p>
                  15. General Conduct & Character:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    VERY GOOD & EXEMPLARY
                  </strong>
                </p>
                <p>
                  16. Reason for leaving the school:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    Course completion / Transfer on parent request
                  </strong>
                </p>
                <p>
                  17. Permanent Residential Address:{' '}
                  <strong className="border-b border-slate-400 pb-0.5 px-2 font-bold text-slate-950">
                    {studentAddress}
                  </strong>
                </p>
              </div>
            ) : currentCertType === 'CHARACTER' ? (
              <div className="flex-1 flex flex-col justify-between py-2 sm:py-3">
                <div className="text-sm sm:text-base leading-relaxed sm:leading-loose font-serif px-2 sm:px-3 space-y-4 sm:space-y-6 text-slate-900">
                  <p className="indent-6 sm:indent-8 text-justify">
                    This is to certify that Mr./Mrs.{' '}
                    <strong className="uppercase text-slate-950 font-sans border-b border-slate-500 px-2 font-bold">
                      {currentStudent.name}
                    </strong>
                    , Son / Daughter of Shri{' '}
                    <strong className="uppercase text-slate-950 font-sans border-b border-slate-500 px-2">
                      {studentFather}
                    </strong>{' '}
                    and Smt.{' '}
                    <strong className="uppercase text-slate-950 font-sans border-b border-slate-500 px-2">
                      {studentMother}
                    </strong>
                    , bearing Admission Number{' '}
                    <strong className="font-mono text-slate-950 font-sans border-b border-slate-500 px-2 font-bold">
                      {currentStudent.admissionNumber}
                    </strong>{' '}
                    and Registration Number{' '}
                    <strong className="font-mono text-slate-950 font-sans border-b border-slate-500 px-2">
                      {regNo}
                    </strong>
                    , has been a regular student of this institution studying in{' '}
                    <strong className="text-slate-950 font-sans border-b border-slate-500 px-2 font-bold">
                      {currentStudent.className}, Section {currentStudent.section}
                    </strong>{' '}
                    during the Academic Session <strong>{session}</strong>.
                  </p>
                  <p className="indent-6 sm:indent-8 text-justify">
                    According to institutional admission records, his/her official date of birth is{' '}
                    <strong className="text-slate-950 font-sans font-bold">{currentStudent.dob || '—'}</strong>.
                    To the best of our knowledge and official institutional records, he/she bears an{' '}
                    <strong className="font-bold text-slate-950 underline">EXEMPLARY MORAL CHARACTER</strong> and pleasant conduct.
                    He/She has demonstrated active discipline, courteous demeanor, and cheerful participation in scholastic and co-curricular programs.
                  </p>
                  <p className="indent-6 sm:indent-8 text-justify">
                    We wish him/her immense success, bright health, and outstanding prospects in all future academic pursuits.
                  </p>
                </div>

                {/* Institutional Record Verification Box */}
                <div className="mt-4 sm:mt-6 mx-2 sm:mx-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center font-sans">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Institutional Record Verification & Seal
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    This certificate is an official record verified against the school admission register and bears institutional authenticity.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Valid for official admission, governmental, educational, and verification requirements.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between py-2 sm:py-3">
                <div className="text-sm sm:text-base leading-relaxed sm:leading-loose font-serif px-2 sm:px-3 space-y-4 sm:space-y-6 text-slate-900">
                  <p className="indent-6 sm:indent-8 text-justify">
                    This is to certify that Mr. / Mrs. {' '}
                    <strong className="uppercase text-slate-950 font-sans border-b border-slate-500 px-2 font-bold">
                      {currentStudent.name}
                    </strong>
                    , Son / Daughter of Shri{' '}
                    <strong className="uppercase text-slate-950 font-sans border-b border-slate-500 px-2">
                      {studentFather}
                    </strong>{' '}
                    and Smt.{' '}
                    <strong className="uppercase text-slate-950 font-sans border-b border-slate-500 px-2">
                      {studentMother}
                    </strong>
                    , bearing Admission Number{' '}
                    <strong className="font-mono text-slate-950 font-sans border-b border-slate-500 px-2 font-bold">
                      {currentStudent.admissionNumber}
                    </strong>{' '}
                    and Registration Number{' '}
                    <strong className="font-mono text-slate-950 font-sans border-b border-slate-500 px-2">
                      {regNo}
                    </strong>
                    , is a bonafide student of this institution currently enrolled in{' '}
                    <strong className="text-slate-950 font-sans border-b border-slate-500 px-2 font-bold">
                      {currentStudent.className}, Section {currentStudent.section}
                    </strong>{' '}
                    during the Academic Session <strong>{session}</strong>.
                  </p>
                  <p className="indent-6 sm:indent-8 text-justify">
                    According to the school admission register, his/her official date of birth is{' '}
                    <strong className="text-slate-950 font-sans font-bold">{currentStudent.dob || '—'}</strong>.
                    His/Her registered permanent address is <strong className="font-sans text-slate-800">{studentAddress}</strong>.
                    He/She bears a good moral character.
                  </p>
                  <p className="indent-6 sm:indent-8 text-justify">
                    This certificate is issued upon the request of the parent / guardian for official documentation, banking, passport, and educational verification purposes.
                  </p>
                </div>

                {/* Institutional Record Verification Box */}
                <div className="mt-4 sm:mt-6 mx-2 sm:mx-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center font-sans">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Institutional Record Verification & Seal
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    This certificate is an official record verified against the school admission register and bears institutional authenticity.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Valid for official admission, governmental, educational, and verification requirements.
                  </p>
                </div>
              </div>
            )}

            {/* Institutional Signatures */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center text-xs font-sans pt-3 sm:pt-4 mt-2 sm:mt-3 border-t border-slate-300">
              <div>
                <div className="h-6 border-b border-dashed border-slate-400 mx-3 sm:mx-6"></div>
                <span className="font-semibold block mt-1 text-slate-700 text-[11px]">Prepared By (Admin)</span>
              </div>
              <div>
                <div className="h-6 border-b border-dashed border-slate-400 mx-3 sm:mx-6"></div>
                <span className="font-semibold block mt-1 text-slate-700 text-[11px]">Checked by Registrar</span>
              </div>
              <div>
                <div className="h-6 border-b border-dashed border-slate-400 mx-3 sm:mx-6 flex items-center justify-center">
                  {sigSrc ? (
                    <img
                      src={sigSrc}
                      alt="Principal Signature"
                      crossOrigin="anonymous"
                      className="max-h-6 max-w-[100px] object-contain"
                    />
                  ) : null}
                </div>
                <span className="font-bold block mt-1 text-slate-950 text-[11px]">{activeSettings.principalName || 'Principal'}</span>
                <span className="text-[9.5px] text-slate-500 block">Principal / Head of Institution</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
