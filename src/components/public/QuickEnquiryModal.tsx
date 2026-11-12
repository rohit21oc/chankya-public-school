import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle, Copy, Phone, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { getApiUrl } from '../../services/apiConfig';
import { AdmissionEnquiry } from '../../types';
import { navigate } from '../../services/routerService';

interface QuickEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickEnquiryModal: React.FC<QuickEnquiryModalProps> = ({ isOpen, onClose }) => {
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [classApplying, setClassApplying] = useState('');
  const [message, setMessage] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [enquiryResult, setEnquiryResult] = useState<AdmissionEnquiry | null>(null);
  const [copied, setCopied] = useState(false);
  const [classesList, setClassesList] = useState<string[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    const active = api.getActiveClasses();
    if (active && active.length > 0) {
      setClassesList(active.map((c) => c.name));
      if (!classApplying) setClassApplying(active[0]?.name || '');
    } else {
      fetch(getApiUrl('/api/classes'))
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && Array.isArray(data)) {
            const act = data
              .filter((c: any) => (c.status ?? 'ACTIVE') === 'ACTIVE')
              .sort((a: any, b: any) => (a.numericOrder || 0) - (b.numericOrder || 0))
              .map((c: any) => c.name);
            setClassesList(act);
            if (!classApplying && act.length > 0) setClassApplying(act[0]);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!parentName.trim() || !studentName.trim() || !mobile.trim()) {
      setFormError('Please fill in Parent Name, Student Name, and 10-digit Mobile Number.');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!consentAgreed) {
      setFormError('Please accept the Privacy Policy acknowledgement before submitting your enquiry.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitAdmissionEnquiry({
        parentName: parentName.trim(),
        studentName: studentName.trim(),
        mobile: cleanMobile,
        email: email.trim() || undefined,
        classApplying,
        message: message.trim() || undefined,
      });

      if (res.success && res.enquiry) {
        setEnquiryResult(res.enquiry);
        setParentName('');
        setStudentName('');
        setMobile('');
        setEmail('');
        setMessage('');
      } else {
        setFormError(res.error || 'Failed to submit admission enquiry. Please try again.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Online Admission Enquiry (2026-27)</h3>
              <p className="text-[11px] text-slate-500">CHANAKYA PUBLIC SCHOOL & COACHING CENTRE</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {enquiryResult ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Enquiry Successfully Registered!</h4>
            <p className="text-xs text-slate-600">
              Your application has been logged with our admissions desk.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 inline-block text-left my-1">
              <div className="text-[11px] text-slate-500">Reference Number:</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono font-bold text-blue-900 text-base">
                  {enquiryResult.referenceNumber}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(enquiryResult.referenceNumber)}
                  className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copied && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Our coordinator will contact you at <strong>{enquiryResult.mobile}</strong>.
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-3.5 text-xs">
            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label htmlFor="quick-parent-name" className="block font-bold text-slate-700 mb-1">
                Parent / Guardian Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="quick-parent-name"
                name="parentName"
                type="text"
                autoComplete="name"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div>
              <label htmlFor="quick-student-name" className="block font-bold text-slate-700 mb-1">
                Student Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="quick-student-name"
                name="studentName"
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Aryan Kumar"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quick-parent-mobile" className="block font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-600">*</span>
                </label>
                <input
                  id="quick-parent-mobile"
                  name="tel"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label htmlFor="quick-class-applying" className="block font-bold text-slate-700 mb-1">
                  Class Applying For <span className="text-rose-600">*</span>
                </label>
                <select
                  id="quick-class-applying"
                  name="classApplying"
                  value={classApplying}
                  onChange={(e) => setClassApplying(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 bg-white"
                >
                  {classesList.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="quick-parent-email" className="block font-bold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                id="quick-parent-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div>
              <label htmlFor="quick-enquiry-message" className="block font-bold text-slate-700 mb-1">
                Your Enquiry or Boarding Needs (Optional)
              </label>
              <textarea
                id="quick-enquiry-message"
                name="message"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="State any specific questions about hostel, transport, or syllabus..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 resize-none"
              />
            </div>

            {/* Consent & Privacy Notice */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-600 shrink-0 cursor-pointer"
                />
                <span className="text-[11px] text-slate-600 leading-snug">
                  I understand that the information submitted through this form may be used by CHANAKYA PUBLIC SCHOOL & COACHING CENTRE to respond to my enquiry or process my request. I have read and agree to the{' '}
                  <a
                    href="/privacy-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      onClose();
                      navigate('/privacy-policy');
                    }}
                    className="font-bold text-blue-900 underline hover:text-blue-700"
                  >
                    Privacy Policy
                  </a>.
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? 'Registering Enquiry...' : 'Submit Admission Enquiry'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
