import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Copy,
  ChevronRight,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { AdmissionEnquiry } from '../../types';
import { api } from '../../services/api';
import { getApiUrl } from '../../services/apiConfig';
import { navigate } from '../../services/routerService';
import { schoolIdentity } from '../../utils/schoolIdentity';

/** School identity from saved School Settings (hidden when a value is not saved). */
const pub = () => schoolIdentity(api.getSettings());
const pubContacts = () => [pub().phones.join(' | '), pub().helpline ? `(Helpline: ${pub().helpline})` : ''].filter(Boolean).join(' ');
const pubNameLine = () => pub().name;

export const PublicAdmissionSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'status' | 'criteria'>('form');

  // Form state
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [classApplying, setClassApplying] = useState('Class 1');
  const [currentSchool, setCurrentSchool] = useState('');
  const [message, setMessage] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEnquiry, setSubmittedEnquiry] = useState<AdmissionEnquiry | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Status check state
  const [statusQuery, setStatusQuery] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusResults, setStatusResults] = useState<AdmissionEnquiry[] | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [classesList, setClassesList] = useState<string[]>([]);

  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!parentName.trim() || !studentName.trim() || !mobile.trim()) {
      setFormError('Please fill in all required fields (Parent Name, Student Name, and Mobile Number).');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!consentAgreed) {
      setFormError('Please acknowledge the Privacy Policy consent before submitting your admission enquiry.');
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
        currentSchool: currentSchool.trim() || undefined,
        message: message.trim() || undefined,
      });

      if (res.success && res.enquiry) {
        setSubmittedEnquiry(res.enquiry);
        // Clear form
        setParentName('');
        setStudentName('');
        setMobile('');
        setEmail('');
        setMessage('');
        setCurrentSchool('');
      } else {
        setFormError(res.error || 'Failed to submit admission enquiry. Please try again.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError(null);
    setStatusResults(null);

    const query = statusQuery.trim();
    if (!query) {
      setStatusError('Please enter your Reference Number (e.g. ENQ-6405-XXXX) or 10-digit Mobile Number.');
      return;
    }

    setIsCheckingStatus(true);
    try {
      const isPhone = /^\d{10}$/.test(query.replace(/\D/g, ''));
      const res = await api.checkAdmissionEnquiryStatus({
        referenceNumber: isPhone ? undefined : query,
        mobile: isPhone ? query.replace(/\D/g, '') : undefined,
      });

      if (res.success && res.enquiries && res.enquiries.length > 0) {
        setStatusResults(res.enquiries);
      } else {
        setStatusError(res.error || 'No matching admission enquiry record found.');
      }
    } catch (err: any) {
      setStatusError(err.message || 'Error checking enquiry status. Please verify your reference number.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <section id="admissions" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Session 2026 - 2027</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Admissions & Online Enquiry
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Admissions are open for Nursery to Class 8. Submit an enquiry online or track the status of an existing admission application.
          </p>

          {/* Sub Navigation Tabs */}
          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Online Enquiry Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'status'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Track Enquiry Status
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('criteria')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'criteria'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Procedure & Documents
            </button>
          </div>
        </div>

        {/* Tab 1: Online Enquiry Form */}
        {activeTab === 'form' && (
          <div className="max-w-4xl mx-auto">
            {submittedEnquiry ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-emerald-200 shadow-lg text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Admission Enquiry Successfully Registered!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
                  Thank you for your interest in Residential PDS Public School Sheohar. Your enquiry has been received by our Admissions Desk.
                </p>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 inline-block text-left my-2">
                  <div className="text-xs text-slate-500">Your Unique Application Reference Number:</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg sm:text-xl font-mono font-black text-blue-900">
                      {submittedEnquiry.referenceNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(submittedEnquiry.referenceNumber)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Copy Reference"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {copiedRef && <span className="text-xs text-emerald-600 font-bold">Copied!</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Student: <strong>{submittedEnquiry.studentName}</strong> | Class: <strong>{submittedEnquiry.classApplying}</strong>
                  </div>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>Our admissions counselor will call you on <strong>{submittedEnquiry.mobile}</strong> within 24 working hours.</p>
                  {pubContacts() && <p>For urgent admission queries, contact the school office: <strong>{pubContacts()}</strong></p>}
                </div>

                <div className="pt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSubmittedEnquiry(null)}
                    className="px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    Submit Another Enquiry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusQuery(submittedEnquiry.referenceNumber);
                      setActiveTab('status');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Track Status
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admissions-parent-name" className="block text-xs font-bold text-slate-700 mb-1">
                        Parent / Guardian Full Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="admissions-parent-name"
                        name="parentName"
                        type="text"
                        autoComplete="name"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="admissions-student-name" className="block text-xs font-bold text-slate-700 mb-1">
                        Student Full Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="admissions-student-name"
                        name="studentName"
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. Aarav Kumar"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="admissions-mobile" className="block text-xs font-bold text-slate-700 mb-1">
                        Parent / Guardian Mobile Phone Number <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="admissions-mobile"
                        name="tel"
                        type="tel"
                        autoComplete="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="10-digit number"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="admissions-email" className="block text-xs font-bold text-slate-700 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        id="admissions-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="admissions-class-applying" className="block text-xs font-bold text-slate-700 mb-1">
                        Class Applying For <span className="text-rose-600">*</span>
                      </label>
                      <select
                        id="admissions-class-applying"
                        name="classApplying"
                        value={classApplying}
                        onChange={(e) => setClassApplying(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 bg-white"
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
                    <label htmlFor="admissions-current-school" className="block text-xs font-bold text-slate-700 mb-1">
                      Current / Previous School & City (Optional)
                    </label>
                    <input
                      id="admissions-current-school"
                      name="currentSchool"
                      type="text"
                      value={currentSchool}
                      onChange={(e) => setCurrentSchool(e.target.value)}
                      placeholder="e.g. Previous School, Sheohar / Sitamarhi / Patna"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="admissions-message" className="block text-xs font-bold text-slate-700 mb-1">
                      Your Enquiry or Boarding/Hostel Questions (Optional)
                    </label>
                    <textarea
                      id="admissions-message"
                      name="message"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Mention any queries regarding hostel boarding, transport routes, or fee payment..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 resize-none"
                    />
                  </div>

                  {/* Consent & Privacy Notice */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentAgreed}
                        onChange={(e) => setConsentAgreed(e.target.checked)}
                        required
                        className="mt-0.5 w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-600 shrink-0 cursor-pointer"
                      />
                      <span className="text-xs text-slate-600 leading-snug">
                        I understand that the information submitted through this form may be used by RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR to respond to my enquiry or process my request. I have read and agree to the{' '}
                        <a
                          href="/privacy-policy"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/privacy-policy');
                          }}
                          className="font-bold text-blue-900 underline hover:text-blue-700"
                        >
                          Privacy Policy
                        </a>.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">
                      {pubContacts() ? <>Admissions Desk contacts: <strong>{pubContacts()}</strong></> : null}
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>{isSubmitting ? 'Registering Enquiry...' : 'Submit Admission Enquiry'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Track Enquiry Status */}
        {activeTab === 'status' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <form onSubmit={handleCheckStatus} className="space-y-4">
                <div>
                  <label htmlFor="admissions-status-query" className="block text-xs font-bold text-slate-700 mb-1">
                    Enter Application Reference Number or 10-Digit Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="admissions-status-query"
                      name="statusQuery"
                      type="text"
                      value={statusQuery}
                      onChange={(e) => setStatusQuery(e.target.value)}
                      placeholder="Enquiry number or mobile number"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={isCheckingStatus}
                      className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isCheckingStatus ? 'Checking...' : 'Track Application Status'}</span>
                    </button>
                  </div>
                </div>

                {statusError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{statusError}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Status Results Display */}
            {statusResults && statusResults.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Enquiry Status ({statusResults.length} Record found)
                </h4>
                {statusResults.map((enq) => (
                  <div
                    key={enq.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-900 text-sm">
                        {enq.referenceNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          enq.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : enq.status === 'CONTACTED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {enq.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Student Name</span>
                        <strong className="text-slate-800">{enq.studentName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Parent Name</span>
                        <strong className="text-slate-800">{enq.parentName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Class Applying</span>
                        <strong className="text-slate-800">{enq.classApplying}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Submitted: {new Date(enq.submittedAt).toLocaleDateString()}</span>
                      <span>Helpline: 06222796505</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Procedure & Documents */}
        {activeTab === 'criteria' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <FileText className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold">Admission Step-by-Step Procedure</h3>
              </div>
              <ol className="space-y-3 text-xs text-slate-700 list-decimal list-inside leading-relaxed">
                <li>
                  <strong>Submission of Enquiry:</strong> Complete the online enquiry form or visit the school campus office.
                </li>
                <li>
                  <strong>Counseling & Interaction:</strong> Informal interaction with the student and parents by academic coordinators.
                </li>
                <li>
                  <strong>Form & Document Verification:</strong> Submission of formal admission form along with mandatory certificates.
                </li>
                <li>
                  <strong>Enrollment & Fee Deposit:</strong> Allotment of Admission Number and Section with receipt of student kit and syllabus.
                </li>
              </ol>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold">Mandatory Documents Required</h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Original Birth Certificate (Municipality or Gram Panchayat)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Transfer Certificate (TC) from previous recognized school (Class 1 upwards)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Recent passport-size color photographs (4 copies of student, 2 of parents)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Aadhaar Card copy of student and parents for demographic verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Report card / Mark sheet copy of previous academic session</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
