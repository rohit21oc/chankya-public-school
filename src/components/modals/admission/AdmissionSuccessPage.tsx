import React, { useRef, useState, useEffect } from 'react';
import {
  CheckCircle2,
  Printer,
  UserCheck,
  Users,
  Sparkles,
  ArrowRight,
  School,
  Calendar,
  ShieldCheck,
  UserPlus,
  CreditCard,
  FileText,
  Landmark,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Student, StudentFeeProfileData } from '../../../types';
import { getSchoolLogoSrc, handleLogoError } from '../../../constants/schoolLogo';
import { api } from '../../../services/api';
import { getEnrollmentMonthLabel } from '../../../utils/feeDateHelper';
import { fileUploadService } from '../../../services/fileUploadService';
import { PrintableAdmissionLetterModal } from '../PrintableAdmissionLetterModal';
import { NOT_CONFIGURED, affiliationText, letterheadLine, schoolIdentity as savedSchoolIdentity } from '../../../utils/schoolIdentity';

interface AdmissionSuccessPageProps {
  student: Student;
  onViewProfile: () => void;
  onGoToList: () => void;
  onAdmitAnother?: () => void;
  /** What actually happened when portal logins were set up at admission (shown only on this screen). */
  portalSetup?: {
    studentEnabled: boolean;
    parentEnabled: boolean;
    studentPassword?: string;
    parentPassword?: string;
    warnings: string[];
  };
}

export const AdmissionSuccessPage: React.FC<AdmissionSuccessPageProps> = ({
  student,
  onViewProfile,
  onGoToList,
  onAdmitAnother,
  portalSetup,
}) => {
  const settings = api.getSettings();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [showAdmissionLetterModal, setShowAdmissionLetterModal] = useState<boolean>(false);
  const [generatedUpiQr, setGeneratedUpiQr] = useState<string>('');

  // Bank / UPI details only from School Settings → Payment options. Never a built-in account.
  const payment: any = settings.paymentOptions || {};

  useEffect(() => {
    if (payment.upiQrCode) {
      setGeneratedUpiQr(fileUploadService.getFileUrl(payment.upiQrCode));
    } else if (payment.upiId) {
      const schoolName = settings.schoolName || 'Chanakya Public School & Coaching Centre';
      const upiUrl = `upi://pay?pa=${payment.upiId}&pn=${encodeURIComponent(schoolName)}&cu=INR&tn=Admission%20Fee%20${student.admissionNumber}`;
      QRCode.toDataURL(upiUrl, { width: 140, margin: 1 })
        .then((url) => setGeneratedUpiQr(url))
        .catch(() => setGeneratedUpiQr(''));
    }
  }, [payment.upiId, payment.upiQrCode, settings.schoolName, student.admissionNumber]);

  // Retrieve fee profile
  const feeProfile: StudentFeeProfileData = student.feeProfile || (() => {
    const cfg = api.getEffectiveFeeConfig(student.classId, student.section, student.academicSession, student.category);
    const admFee = Number(cfg?.admissionFee ?? 5000);
    const monthlySchool = Number(cfg?.monthlySchoolFee ?? 1800);
    const tuition = Number(cfg?.monthlyTuitionFee ?? 0);
    const exam = Number(cfg?.examFee ?? 1000);
    const comp = Number(cfg?.computerFee ?? 250);
    const sports = Number(cfg?.sportsFee ?? 150);
    const uniform = Number(cfg?.dressCodeFee ?? 2200);
    const books = Number(cfg?.booksFee ?? 1500);
    const idCard = Number(cfg?.idCardFee ?? 200);
    const medical = Number(cfg?.medicalFee ?? 100);
    const transport = student.transportRequired ? Number(student.transportMonthlyFee || 800) : 0;
    const hostel = student.hostelRequired ? Number(student.hostelMonthlyFee || cfg?.hostelFee || 5500) : 0;
    const mess = student.hostelRequired ? Number(student.messMonthlyFee || cfg?.messFee || 3000) : 0;

    const heads = [
      { head: 'Admission Fee', category: 'ONE_TIME' as const, frequency: 'One Time' as const, amount: admFee, selected: true },
      { head: 'School Fee', category: 'MONTHLY' as const, frequency: 'Monthly' as const, amount: monthlySchool, selected: true },
      ...(tuition > 0 ? [{ head: 'Tuition Fee', category: 'MONTHLY' as const, frequency: 'Monthly' as const, amount: tuition, selected: true }] : []),
      { head: 'Exam Fee', category: 'EXAMINATION' as const, frequency: 'Yearly' as const, amount: exam, selected: true },
      { head: 'Computer / Smart Class', category: 'MONTHLY' as const, frequency: 'Monthly' as const, amount: comp, selected: true },
      { head: 'Sports Fee', category: 'YEARLY' as const, frequency: 'Yearly' as const, amount: sports, selected: true },
      { head: 'Uniform / Dress Code', category: 'ONE_TIME' as const, frequency: 'One Time' as const, amount: uniform, selected: true },
      { head: 'Books & Stationery', category: 'ONE_TIME' as const, frequency: 'One Time' as const, amount: books, selected: true },
      { head: 'ID Card Fee', category: 'ONE_TIME' as const, frequency: 'One Time' as const, amount: idCard, selected: true },
      { head: 'Medical / Health Care', category: 'YEARLY' as const, frequency: 'Yearly' as const, amount: medical, selected: true },
      ...(student.transportRequired ? [{ head: 'Transport Fee', category: 'FACILITY' as const, frequency: 'Monthly' as const, amount: transport, selected: true }] : []),
      ...(student.hostelRequired ? [
        { head: 'Hostel Residency Fee', category: 'FACILITY' as const, frequency: 'Monthly' as const, amount: hostel, selected: true },
        { head: 'Hostel Mess Fee', category: 'FACILITY' as const, frequency: 'Monthly' as const, amount: mess, selected: true },
      ] : []),
    ];

    const oneTime = admFee + uniform + books + idCard;
    const monthly = monthlySchool + tuition + comp + transport + hostel + mess;
    const yearly = exam + sports + medical;

    return {
      className: student.className,
      section: student.section,
      academicSession: student.academicSession,
      feeHeads: heads,
      totalOneTimeFee: oneTime,
      totalMonthlyFee: monthly,
      totalYearlyFee: yearly,
      monthlyPayableAmount: monthly,
      totalApplicableFee: oneTime + monthly * 12 + yearly,
    };
  })();

  // The enrollment month's fee is paid at admission along with the one-time charges
  const enrollmentMonthLabel =
    getEnrollmentMonthLabel(student.feeStartDate || student.enrollmentDate || student.admissionDate) || 'First month';
  const payableAtAdmission = Number(feeProfile.totalOneTimeFee || 0) + Number(feeProfile.monthlyPayableAmount || 0);

  const activeHeads = feeProfile.feeHeads.filter((h) => h.selected);
  const oneTimeHeads = activeHeads.filter((h) => h.category === 'ONE_TIME' || (h.frequency as string) === 'One Time');
  const monthlyHeads = activeHeads.filter(
    (h) => h.category === 'MONTHLY' || (h.frequency as string) === 'Monthly' || h.category === 'FACILITY'
  );
  const yearlyHeads = activeHeads.filter(
    (h) => !oneTimeHeads.includes(h) && !monthlyHeads.includes(h)
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn py-2">
      {/* On-screen celebratory success view (hidden during print) */}
      <div className="print:hidden space-y-6 text-center max-w-xl mx-auto">
        <div className="inline-flex p-3.5 bg-emerald-100 text-emerald-600 rounded-2xl shadow-inner mx-auto ring-8 ring-emerald-50">
          <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block mb-2">
            Institutional Enrollment Verified
          </span>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            Admission Successfully Completed
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            The candidate has been officially admitted into {settings.schoolName || 'Chanakya Public School & Coaching Centre'}.
            Student fee profile and admission letter credentials have been persisted.
          </p>
        </div>

        {/* Detailed Credential Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs text-left space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              {(student.photo || student.photoFileKey) && (
                <div className="w-12 h-14 rounded-lg overflow-hidden border border-slate-200 shadow-2xs bg-white shrink-0">
                  <img
                    src={fileUploadService.getFileUrl(student.photo || student.photoFileKey)}
                    alt={student.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate Name</span>
                <h4 className="text-base font-black text-slate-900">{student.name}</h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Session</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                {student.academicSession}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Admission No.</span>
              <strong className="text-blue-700 font-mono text-sm font-black">{student.admissionNumber}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Class Roll No.</span>
              <strong className="text-emerald-700 text-sm font-black">#{student.rollNumber}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Class Enrolled</span>
              <strong className="text-slate-900 font-bold">{student.className}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Section</span>
              <strong className="text-slate-900 font-bold">Section {student.section}</strong>
            </div>
          </div>

          {/* Applicable Fee Summary Box */}
          <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Configured Student Fee Structure
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                PERSISTED
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-left pt-1">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Payable at Admission</span>
                <strong className="text-xs font-mono font-black text-blue-900">
                  ₹{payableAtAdmission.toLocaleString('en-IN')}
                </strong>
                <span className="text-[9px] text-slate-500 block">One-time + {enrollmentMonthLabel}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Monthly Payable</span>
                <strong className="text-xs font-mono font-black text-emerald-800">
                  ₹{feeProfile.monthlyPayableAmount.toLocaleString('en-IN')}/mo
                </strong>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Annual Fee</span>
                <strong className="text-xs font-mono font-black text-slate-900">
                  ₹{feeProfile.totalApplicableFee.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>

          {/* Portal Access Handover Box */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/80 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active Portal Login Credentials
              </span>
              {portalSetup && portalSetup.warnings.length === 0 && (portalSetup.studentEnabled || portalSetup.parentEnabled) && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  ACTIVATED
                </span>
              )}
            </div>
            {portalSetup && portalSetup.warnings.length > 0 && (
              <div role="alert" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-0.5">
                {portalSetup.warnings.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              <div className="bg-white/80 p-2.5 rounded-lg border border-blue-100">
                <span className="text-[10px] font-bold text-blue-900 block">Student Portal Login:</span>
                <div className="font-mono text-xs text-slate-800 mt-0.5">
                  ID: <strong className="text-blue-700 font-black">{student.admissionNumber}</strong> / {student.registrationNumber}
                </div>
                <div className="font-mono text-[11px] text-slate-600">
                  {portalSetup && !portalSetup.studentEnabled
                    ? 'Portal login not enabled'
                    : <>Password: <strong className="text-slate-800">{portalSetup?.studentPassword || 'set at admission'}</strong></>}
                </div>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-purple-100">
                <span className="text-[10px] font-bold text-purple-900 block">Parent Portal Login:</span>
                <div className="font-mono text-xs text-slate-800 mt-0.5">
                  ID: <strong className="text-purple-700 font-black">{student.parentPhone || student.fatherMobile || student.mobile || 'Registered Mobile'}</strong>
                </div>
                <div className="font-mono text-[11px] text-slate-600">
                  {portalSetup && !portalSetup.parentEnabled
                    ? 'Portal login not enabled'
                    : <>Password: <strong className="text-purple-800">{portalSetup?.parentPassword || 'set at admission'}</strong></>}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-1 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Father / Guardian: <strong className="text-slate-700">{student.parentName || student.fatherName || '—'}</strong></span>
            <span>Registration Code: <strong className="font-mono text-slate-700">{student.registrationNumber}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAdmissionLetterModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-700/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Open Admission Letter</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Admission Letter</span>
          </button>

          <button
            type="button"
            onClick={onViewProfile}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>View Student Profile</span>
          </button>

          {onAdmitAnother && (
            <button
              type="button"
              onClick={onAdmitAnother}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Admit Another Student</span>
            </button>
          )}

          <button
            type="button"
            onClick={onGoToList}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Students List</span>
          </button>
        </div>
      </div>

      {/* Printable Official Admission Letter (Active during window.print()) */}
      <div
        ref={printAreaRef}
        className="hidden print:block font-sans text-slate-900 p-8 max-w-3xl mx-auto border border-slate-300 rounded-xl bg-white"
      >
        {/* School Header */}
        <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-800">
          {getSchoolLogoSrc(settings.schoolLogo) ? (
            <img
              src={getSchoolLogoSrc(settings.schoolLogo)}
              alt="School Logo"
              className="w-16 h-16 object-contain shrink-0"
              onError={handleLogoError}
            />
          ) : (
            <div className="w-16 h-16 rounded bg-blue-900 text-amber-300 flex items-center justify-center shrink-0">
              <School className="w-8 h-8 text-amber-400" />
            </div>
          )}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
              {settings.schoolName || 'Chanakya Public School & Coaching Centre'}
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              {settings.schoolAddress || NOT_CONFIGURED}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {letterheadLine(savedSchoolIdentity(settings), { phone: true }) || 'School details not configured'}
            </p>
          </div>
        </div>

        {/* Title Badge */}
        <div className="text-center py-2.5 bg-slate-900 text-white my-3 rounded-lg">
          <h2 className="text-sm font-black uppercase tracking-widest text-amber-300">
            OFFICIAL STUDENT ADMISSION LETTER & FEE DOSSIER
          </h2>
          <span className="text-[10px] text-slate-300 font-bold">
            Academic Session: {student.academicSession} • Ref No: CPS/ADM/{student.admissionNumber}
          </span>
        </div>

        {/* Key Identifiers */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs mb-3">
          <div>
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">Admission Number</span>
            <strong className="text-sm font-mono text-slate-950">{student.admissionNumber}</strong>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">Registration Code</span>
            <strong className="font-mono text-slate-900">{student.registrationNumber}</strong>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">Class Roll No.</span>
            <strong className="text-sm font-bold text-slate-950">#{student.rollNumber}</strong>
          </div>
        </div>

        {/* Student & Academic Particulars Table */}
        <div className="mb-4">
          <div className="bg-slate-100 px-3 py-1 border-t border-x border-slate-300 font-bold text-[10px] uppercase text-slate-800">
            1. Candidate Enrolment Details
          </div>
          <table className="w-full text-xs border-collapse border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 font-bold bg-slate-50 w-1/4 border-r border-slate-300">Candidate Full Name</td>
                <td className="p-1.5 font-bold text-slate-950 uppercase">{student.name}</td>
                <td className="p-1.5 font-bold bg-slate-50 w-1/4 border-r border-slate-300 border-l">Class & Section</td>
                <td className="p-1.5 font-bold">{student.className} (Section {student.section})</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300">Date of Birth & Gender</td>
                <td className="p-1.5">{student.dob} • {student.gender}</td>
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300 border-l">Category & Religion</td>
                <td className="p-1.5">{student.category || 'GENERAL'} • {student.religion || 'Hindu'}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300">Father's Name & Occupation</td>
                <td className="p-1.5">{student.fatherName || student.parentName} ({student.fatherOccupation || 'N/A'})</td>
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300 border-l">Mother's Name</td>
                <td className="p-1.5">{student.motherName || 'N/A'}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300">Contact Mobile</td>
                <td className="p-1.5 font-mono font-bold">{student.parentPhone || student.fatherMobile || student.mobile}</td>
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300 border-l">Admission Date</td>
                <td className="p-1.5">{student.admissionDate}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-300">Residential Address</td>
                <td colSpan={3} className="p-1.5">{student.address}, {student.city}, {student.state} - {student.pincode}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section B: Fee Structure Table */}
        <div className="mb-4">
          <div className="bg-slate-100 px-3 py-1 border-t border-x border-slate-300 font-bold text-[10px] uppercase text-slate-800 flex justify-between">
            <span>2. Applicable Fee Structure & Schedule</span>
            <span>Session {student.academicSession}</span>
          </div>
          <table className="w-full text-xs border-collapse border border-slate-300">
            <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-700">
              <tr className="border-b border-slate-300">
                <th className="p-1.5 text-left border-r border-slate-300">Fee Head</th>
                <th className="p-1.5 text-left border-r border-slate-300">Category</th>
                <th className="p-1.5 text-left border-r border-slate-300">Frequency</th>
                <th className="p-1.5 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {activeHeads.map((h) => (
                <tr key={h.head}>
                  <td className="p-1.5 font-medium border-r border-slate-300">{h.head}</td>
                  <td className="p-1.5 text-slate-600 border-r border-slate-300">{h.category}</td>
                  <td className="p-1.5 text-slate-600 border-r border-slate-300">{h.frequency}</td>
                  <td className="p-1.5 text-right font-mono font-bold">₹{h.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-800 text-xs">
              <tr className="border-b border-slate-300">
                <td colSpan={3} className="p-1.5 text-right border-r border-slate-300 uppercase">
                  Payable at Admission (One-Time + {enrollmentMonthLabel}):
                </td>
                <td className="p-1.5 text-right font-mono font-black text-blue-900">
                  ₹{payableAtAdmission.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr className="border-b border-slate-300 bg-emerald-50">
                <td colSpan={3} className="p-1.5 text-right border-r border-slate-300 uppercase text-emerald-900">
                  Monthly Regular Payable Amount:
                </td>
                <td className="p-1.5 text-right font-mono font-black text-emerald-800">
                  ₹{feeProfile.monthlyPayableAmount.toLocaleString('en-IN')} / mo
                </td>
              </tr>
              <tr className="bg-slate-200">
                <td colSpan={3} className="p-1.5 text-right border-r border-slate-300 uppercase font-black">
                  Total Applicable Annual Commitment:
                </td>
                <td className="p-1.5 text-right font-mono font-black">
                  ₹{feeProfile.totalApplicableFee.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Section C: School Payment Details */}
        <div className="mb-4 border border-slate-300 rounded-lg p-3 bg-slate-50">
          <div className="font-bold text-[10px] uppercase text-slate-900 pb-1.5 border-b border-slate-200 mb-2 flex items-center justify-between">
            <span>3. School Banking & UPI Fee Remittance Channels</span>
            <span className="text-slate-500 font-mono text-[9px]">Verified Institution Details</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div className="col-span-2 space-y-1">
              <div>
                <span className="text-slate-500">Account Holder:</span>{' '}
                <strong className="text-slate-950 font-bold">{payment.accountHolderName || NOT_CONFIGURED}</strong>
              </div>
              <div>
                <span className="text-slate-500">Bank Name:</span>{' '}
                <strong className="text-slate-950 font-bold">{payment.bankName || NOT_CONFIGURED}</strong>
              </div>
              <div>
                <span className="text-slate-500">Account No:</span>{' '}
                <strong className="font-mono text-sm text-blue-900 font-black">{payment.accountNumber || NOT_CONFIGURED}</strong>
              </div>
              <div>
                <span className="text-slate-500">IFSC Code:</span>{' '}
                <strong className="font-mono text-slate-900 font-bold">{payment.ifsc || NOT_CONFIGURED}</strong> • Branch: {payment.branch || NOT_CONFIGURED}
              </div>
              <div>
                <span className="text-slate-500">Official UPI ID:</span>{' '}
                <strong className="font-mono text-emerald-800 font-bold">{payment.upiId || NOT_CONFIGURED}</strong>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center border-l border-slate-200 pl-2">
              {generatedUpiQr ? (
                <img
                  src={generatedUpiQr}
                  alt="UPI QR"
                  className="w-20 h-20 object-contain border border-slate-300 rounded p-0.5 bg-white"
                />
              ) : (
                <div className="w-20 h-20 border border-dashed border-slate-300 rounded flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <span className="text-[9px] text-slate-600 font-bold mt-1">Scan & Pay via UPI</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Parent / Guardian Signature
            </div>
          </div>
          <div>
            {settings.principalSignature && (
              <img
                src={getSchoolLogoSrc(settings.principalSignature)}
                alt="Principal Signature"
                className="h-8 object-contain mx-auto mb-1"
              />
            )}
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Principal / Admission Incharge
            </div>
            <span className="text-[10px] text-slate-500">Chanakya Public School & Coaching Centre, Sheohar</span>
          </div>
        </div>
      </div>

      {/* Modal View for Admission Letter */}
      {showAdmissionLetterModal && (
        <PrintableAdmissionLetterModal
          isOpen={showAdmissionLetterModal}
          onClose={() => setShowAdmissionLetterModal(false)}
          student={student}
          settings={settings}
        />
      )}
    </div>
  );
};
