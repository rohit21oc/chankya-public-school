import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X, Download, Mail, Loader2, CheckCircle2, AlertCircle, School } from 'lucide-react';
import QRCode from 'qrcode';
import { Student, SchoolSettings } from '../../types';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { api } from '../../services/api';
import { getStoredUser } from '../../services/apiConfig';
import { fileUploadService } from '../../services/fileUploadService';
import {
  AdmissionLetterFeeRow,
  AdmissionLetterPdfImages,
  admissionLetterFileName,
  buildAdmissionLetterModel,
  formatRupees,
  generateAdmissionLetterPdf,
} from '../../utils/admissionLetter';

interface PrintableAdmissionLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  settings?: SchoolSettings;
}

// Roles allowed to email admission letters (same list as the server).
const EMAIL_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT'];

async function urlToDataUrl(url?: string, maxPx = 320): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g|webp)$/i.test(blob.type)) return null;
    return await downscaleImage(blob, maxPx);
  } catch {
    return null;
  }
}

// Shrinks an image so the PDF stays small enough to email (the originals can be several MB).
async function downscaleImage(blob: Blob, maxPx: number): Promise<string | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const maskEmail = (v: string) => v.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');

type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null;

export const PrintableAdmissionLetterModal: React.FC<PrintableAdmissionLetterModalProps> = ({
  isOpen,
  onClose,
  student,
  settings: propSettings,
}) => {
  const settings = propSettings || api.getSettings();
  const [images, setImages] = useState<AdmissionLetterPdfImages>({});
  const [busy, setBusy] = useState<'download' | 'print' | 'email' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmResend, setConfirmResend] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState(student.admissionLetterEmail);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const model = useMemo(() => {
    const cfg = student.feeProfile?.feeHeads?.length
      ? null
      : api.getEffectiveFeeConfig(student.classId, student.section, student.academicSession, student.category);
    return buildAdmissionLetterModel(student, settings, cfg);
  }, [student, settings]);

  const parentEmail = [student.parentEmail, student.fatherEmail, student.motherEmail].map((v) => String(v || '').trim()).find(Boolean) || '';
  const role = String(getStoredUser()?.role || '').toUpperCase();
  const canEmail = EMAIL_ROLES.includes(role);

  // Images for the PDF (logo, principal's signature, UPI QR). All optional.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const pay: any = settings.paymentOptions || {};
      const [logoDataUrl, signatureDataUrl, uploadedQr] = await Promise.all([
        urlToDataUrl(getSchoolLogoSrc(settings.schoolLogo)),
        settings.principalSignature ? urlToDataUrl(getSchoolLogoSrc(settings.principalSignature), 400) : Promise.resolve(null),
        pay.upiQrCode ? urlToDataUrl(fileUploadService.getFileUrl(pay.upiQrCode), 360) : Promise.resolve(null),
      ]);
      let upiQrDataUrl = uploadedQr;
      if (!upiQrDataUrl && pay.upiId) {
        const upiUrl = `upi://pay?pa=${encodeURIComponent(pay.upiId)}&pn=${encodeURIComponent(settings.schoolName || '')}&cu=INR&tn=${encodeURIComponent(`Admission Fee ${student.admissionNumber}`)}`;
        upiQrDataUrl = await QRCode.toDataURL(upiUrl, { width: 240, margin: 1 }).catch(() => null);
      }
      if (!cancelled) setImages({ logoDataUrl, signatureDataUrl, upiQrDataUrl });
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, settings, student.admissionNumber]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  useEffect(() => () => {
    printFrameRef.current?.remove();
  }, []);

  if (!isOpen) return null;

  const buildPdf = () => generateAdmissionLetterPdf(model, images);

  const handleDownload = () => {
    setBusy('download');
    setNotice(null);
    try {
      buildPdf().save(admissionLetterFileName(student));
    } catch (err) {
      console.error('[AdmissionLetter] PDF download failed:', err);
      setNotice({ tone: 'error', text: 'The PDF could not be created. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  // Prints the generated PDF itself, so the printout matches the download exactly (no app screens).
  const handlePrint = () => {
    setBusy('print');
    setNotice(null);
    try {
      const url = URL.createObjectURL(buildPdf().output('blob'));
      const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
      if (isTouch) {
        // Mobile browsers cannot print an embedded PDF; open it so the system viewer can print or share it.
        const win = window.open(url, '_blank');
        if (!win) setNotice({ tone: 'info', text: 'Allow pop-ups to open the letter for printing, or use Download PDF.' });
        setBusy(null);
        return;
      }
      printFrameRef.current?.remove();
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.src = url;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, '_blank');
        }
        setBusy(null);
      };
      document.body.appendChild(frame);
      printFrameRef.current = frame;
    } catch (err) {
      console.error('[AdmissionLetter] Print failed:', err);
      setNotice({ tone: 'error', text: 'The letter could not be prepared for printing. Use Download PDF instead.' });
      setBusy(null);
    }
  };

  const handleEmail = async (resend = false) => {
    setBusy('email');
    setNotice(null);
    setConfirmResend(null);
    try {
      const dataUri = buildPdf().output('datauristring');
      const base64 = dataUri.substring(dataUri.indexOf(',') + 1);
      const result = await api.emailAdmissionLetter(student.id, base64, resend);
      if (result.ok) {
        setLastEmail(result.record);
        setNotice({ tone: 'success', text: result.message });
      } else if (result.code === 'RECENTLY_SENT') {
        setConfirmResend(result.message);
      } else {
        setNotice({ tone: 'error', text: result.message });
      }
    } finally {
      setBusy(null);
    }
  };

  const feeGroup = (title: string, rows: AdmissionLetterFeeRow[]) =>
    rows.length === 0 ? null : (
      <React.Fragment key={title}>
        <tr className="bg-slate-100">
          <td colSpan={3} className="px-2 py-1.5 font-semibold text-slate-800">{title}</td>
        </tr>
        {rows.map((r) => (
          <tr key={`${title}-${r.head}`} className="border-t border-slate-200">
            <td className="px-2 py-1.5">{r.head}</td>
            <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.frequency || '—'}</td>
            <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{formatRupees(r.amount)}</td>
          </tr>
        ))}
      </React.Fragment>
    );

  const st = model.student;
  const detailRows: Array<[string, string]> = [
    ['Admission No.', st.admissionNumber],
    ['Registration No.', st.registrationNumber],
    ['Student Name', st.name],
    ['Class & Section', st.classSection],
    ['Roll No.', st.rollNumber],
    ['Date of Admission', st.admissionDate],
    ['Date of Birth', st.dob],
    ['Gender', st.gender],
    ['Category', st.category],
    ['Blood Group', st.bloodGroup],
    ['Father / Guardian', st.fatherLine],
    ['Mother', st.motherLine],
    ['Registered Mobile', st.mobile],
    ['Academic Session', st.academicSession],
    ['Address', st.addressLine],
    ['Transport', st.transportLine],
    ['Residence', st.hostelLine],
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-stretch sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admission-letter-title"
    >
      <div className="bg-white w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl flex flex-col max-h-full sm:max-h-[94vh] overflow-hidden">
        {/* Actions */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="admission-letter-title" className="text-sm font-bold text-slate-900">Admission Letter</h3>
              <p className="text-xs text-slate-500 truncate">
                {student.name} • Admission No. <span className="font-mono">{student.admissionNumber}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={!!busy}
              aria-label="Close"
              className="sm:hidden p-2 -m-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 rounded-xl bg-[#123B8C] hover:bg-[#0B1F4B] text-white text-xs font-semibold disabled:opacity-60"
            >
              {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold disabled:opacity-60"
            >
              {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Print
            </button>
            {canEmail && (
              <button
                type="button"
                onClick={() => handleEmail(false)}
                disabled={!!busy || !parentEmail}
                title={parentEmail ? `Send to ${maskEmail(parentEmail)}` : 'No parent email address is saved for this student'}
                className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {busy === 'email' ? 'Sending…' : 'Email to Parent'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={!!busy}
              aria-label="Close"
              className="hidden sm:inline-flex p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status */}
        {(notice || confirmResend || (canEmail && !parentEmail) || lastEmail) && (
          <div className="px-4 pt-3 space-y-2 text-xs">
            {canEmail && !parentEmail && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No parent email address is saved for this student. Add it in the student's profile to email the letter, or download it and share it another way.</span>
              </div>
            )}
            {confirmResend && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-900">
                <span className="flex-1">{confirmResend}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEmail(true)} className="px-3 py-1.5 rounded-lg bg-[#123B8C] text-white font-semibold">
                    Send again
                  </button>
                  <button type="button" onClick={() => setConfirmResend(null)} className="px-3 py-1.5 rounded-lg border border-blue-300 font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {notice && (
              <div
                role={notice.tone === 'error' ? 'alert' : 'status'}
                className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                  notice.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : notice.tone === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {notice.tone === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{notice.text}</span>
              </div>
            )}
            {!notice && lastEmail && (
              <p className="text-slate-500">
                Last emailed {new Date(lastEmail.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} to {lastEmail.recipient} —{' '}
                {lastEmail.status === 'ACCEPTED' ? 'accepted by the email service for delivery' : 'not sent'}.
              </p>
            )}
          </div>
        )}

        {/* Letter preview (same content as the PDF) */}
        <div className="overflow-y-auto p-3 sm:p-6 bg-slate-100/60">
          <article className="bg-white max-w-[210mm] mx-auto border border-slate-200 rounded-xl p-4 sm:p-8 text-slate-900 text-[13px] sm:text-xs">
            <header className="flex items-start gap-4 pb-3 border-b-2 border-[#0B1F4B]">
              {getSchoolLogoSrc(settings.schoolLogo) ? (
                <img
                  src={getSchoolLogoSrc(settings.schoolLogo)}
                  alt=""
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
                  onError={handleLogoError}
                />
              ) : (
                <School className="w-12 h-12 text-[#0B1F4B] shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold uppercase text-[#0B1F4B] leading-tight break-words">{model.school.name}</h2>
                {model.school.boardLine && <p className="text-[11px] text-slate-600 mt-0.5">{model.school.boardLine}</p>}
                {model.school.address !== '—' && <p className="text-[11px] text-slate-600">{model.school.address}</p>}
                {model.school.contactLine && <p className="text-[11px] text-slate-600 break-words">{model.school.contactLine}</p>}
              </div>
            </header>

            <div className="text-center mt-4 mb-2">
              <h3 className="text-sm font-bold tracking-wide text-[#0B1F4B]">ADMISSION LETTER</h3>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500 mb-3">
              <span>Ref. No.: {model.referenceNo}</span>
              <span>Date: {model.letterDate}</span>
            </div>
            <p>Dear {model.parentSalutation},</p>
            <p className="mt-2 leading-relaxed">
              We are pleased to confirm the admission of <strong>{st.name}</strong> to <strong>{st.classSection}</strong> for the academic
              session <strong>{st.academicSession}</strong>. The admission details and the applicable fees are given below.
            </p>

            <section className="mt-4">
              <h4 className="bg-[#0B1F4B] text-white font-semibold px-2 py-1.5 rounded-t-md">A. Student Details</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 border border-t-0 border-slate-200 rounded-b-md">
                {detailRows.map(([label, value]) => (
                  <div key={label} className="flex border-t border-slate-200 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
                    <dt className="w-36 shrink-0 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700">{label}</dt>
                    <dd className="px-2 py-1.5 min-w-0 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-4">
              <h4 className="bg-[#0B1F4B] text-white font-semibold px-2 py-1.5 rounded-t-md">B. Fee Details</h4>
              <div className="border border-t-0 border-slate-200 rounded-b-md overflow-x-auto">
                {model.fees.configured ? (
                  <table className="w-full min-w-[320px]">
                    <thead>
                      <tr className="text-left text-slate-600">
                        <th className="px-2 py-1.5 font-semibold">Fee head</th>
                        <th className="px-2 py-1.5 font-semibold">Schedule</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeGroup('One-time charges (payable at admission)', model.fees.oneTime)}
                      {feeGroup('Monthly charges (payable from the 1st to the 10th of each month)', model.fees.monthly)}
                      {feeGroup('Yearly / periodic charges', model.fees.periodic)}
                    </tbody>
                    <tfoot className="font-semibold border-t-2 border-slate-300">
                      <tr>
                        <td className="px-2 py-1.5" colSpan={2}>Total one-time charges</td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{formatRupees(model.fees.totalOneTime)}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5" colSpan={2}>Total monthly charges</td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{formatRupees(model.fees.totalMonthly)} / month</td>
                      </tr>
                      {model.fees.totalPeriodic > 0 && (
                        <tr>
                          <td className="px-2 py-1.5" colSpan={2}>Total yearly / periodic charges</td>
                          <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{formatRupees(model.fees.totalPeriodic)}</td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                ) : (
                  <p className="p-3 text-amber-800 bg-amber-50">The fee structure for this class has not been set up yet. Please contact the accounts office.</p>
                )}
              </div>
            </section>

            {model.payment.configured && (
              <section className="mt-4">
                <h4 className="bg-[#0B1F4B] text-white font-semibold px-2 py-1.5 rounded-t-md">C. Fee Payment Details</h4>
                <div className="border border-t-0 border-slate-200 rounded-b-md p-3 flex flex-col sm:flex-row gap-3">
                  <dl className="flex-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {model.payment.accountNumber !== '—' && (
                      <>
                        <dt className="font-semibold text-slate-700">Account Holder</dt>
                        <dd className="break-words">{model.payment.accountHolderName}</dd>
                        <dt className="font-semibold text-slate-700">Bank</dt>
                        <dd className="break-words">{model.payment.bankName}</dd>
                        <dt className="font-semibold text-slate-700">Account No.</dt>
                        <dd className="font-mono">{model.payment.accountNumber}</dd>
                        <dt className="font-semibold text-slate-700">IFSC</dt>
                        <dd className="font-mono">{model.payment.ifsc}</dd>
                        <dt className="font-semibold text-slate-700">Branch</dt>
                        <dd className="break-words">{model.payment.branch}</dd>
                      </>
                    )}
                    {model.payment.upiId && (
                      <>
                        <dt className="font-semibold text-slate-700">UPI ID</dt>
                        <dd className="font-mono break-all">{model.payment.upiId}</dd>
                      </>
                    )}
                  </dl>
                  {images.upiQrDataUrl && (
                    <img src={images.upiQrDataUrl} alt="UPI payment QR code" className="w-28 h-28 self-center object-contain border border-slate-200 rounded" />
                  )}
                </div>
                {model.payment.instructions && <p className="mt-1 text-[11px] text-slate-600">Note: {model.payment.instructions}</p>}
              </section>
            )}

            <p className="mt-4 text-[11px] text-slate-700">
              <strong>Portal access:</strong> Student login ID {model.portal.studentLoginId} • Parent login ID {model.portal.parentLoginId} •
              Passwords are shared separately by the school office; please change them after the first login.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-3 text-center text-[11px]">
              {['Parent / Guardian', 'Admissions Office', model.principalName ? `Principal (${model.principalName})` : 'Principal'].map((label) => (
                <div key={label} className="border-t border-slate-400 pt-1">{label}</div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};
