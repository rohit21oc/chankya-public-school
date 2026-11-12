import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  Globe,
  HardDrive,
  Loader2,
  Mail,
  Phone,
  Save,
  Server,
  ShieldCheck,
  CreditCard,
  QrCode,
  Landmark,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { FileUploadComponent } from '../common/FileUploadComponent';
import { fileUploadService, UploadResult } from '../../services/fileUploadService';
import { BackendStatusModal } from '../common/BackendStatusModal';
import { getBackendBaseUrl } from '../../services/apiConfig';
import { navigate } from '../../services/routerService';

interface SettingsViewProps {
  settings: SchoolSettings;
  onUpdateSettings: (newSettings: SchoolSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [formData, setFormData] = useState<SchoolSettings>({ ...settings });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [storageStatus, setStorageStatus] = useState<any>(null);
  const [showBackendModal, setShowBackendModal] = useState(false);

  // Settings can arrive (or change on another screen / device) after this page opened. Keep the uploaded
  // images in step with them, so an uploaded signature or logo is always shown in its box.
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      schoolLogo: settings.schoolLogo,
      logoFileKey: settings.logoFileKey,
      principalSignature: settings.principalSignature,
      principalSignatureFileKey: settings.principalSignatureFileKey,
      examControllerSignature: settings.examControllerSignature,
      examControllerSignatureFileKey: settings.examControllerSignatureFileKey,
    }));
  }, [
    settings.schoolLogo,
    settings.logoFileKey,
    settings.principalSignature,
    settings.principalSignatureFileKey,
    settings.examControllerSignature,
    settings.examControllerSignatureFileKey,
  ]);

  // After a new file is saved, the one it replaced is deleted from storage
  const deleteReplacedFile = (oldKey?: string, newKey?: string) => {
    if (oldKey && oldKey !== newKey && !oldKey.startsWith('http') && !oldKey.startsWith('blob:') && !oldKey.startsWith('data:')) {
      fileUploadService.deleteFile(oldKey).catch((e) => console.warn('[SettingsView] Old file not deleted:', e));
    }
  };

  useEffect(() => {
    fileUploadService.getStorageStatus().then((status) => {
      setStorageStatus(status);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = await api.updateSettingsAsync(formData);
      onUpdateSettings(updated);
      setSuccessMsg('Central school profile settings updated and persisted successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('[SettingsView] Failed to save settings:', err);
      setErrorMsg(err.message || 'Failed to update settings. Please check your admin login session.');
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUploaded = async (res: UploadResult) => {
    const oldLogoKey = formData.logoFileKey || formData.schoolLogo;
    const fileKey = res.fileKey || res.previewUrl;
    const updatedData = {
      ...formData,
      schoolLogo: fileKey,
      logoFileKey: res.fileKey,
    };
    setFormData(updatedData);
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'SCHOOL_LOGO',
      id: 'school-main',
    });
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      deleteReplacedFile(oldLogoKey, res.fileKey);
      setSuccessMsg('School logo uploaded and saved.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Logo uploaded but failed to update settings.');
    }
  };

  const handleLogoRemoved = async () => {
    if (formData.logoFileKey) {
      await fileUploadService.deleteFile(formData.logoFileKey);
    }
    const updatedData = {
      ...formData,
      schoolLogo: '',
      logoFileKey: undefined,
    };
    setFormData(updatedData);
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings after removing logo.');
    }
  };

  const handleSignatureUploaded = async (res: UploadResult) => {
    const oldSignatureKey = formData.principalSignatureFileKey || formData.principalSignature;
    const fileKey = res.fileKey || res.previewUrl;
    const updatedData = {
      ...formData,
      principalSignature: fileKey,
      principalSignatureFileKey: res.fileKey,
    };
    setFormData(updatedData);
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'PRINCIPAL_SIGNATURE',
      id: 'school-main',
    });
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      deleteReplacedFile(oldSignatureKey, res.fileKey);
      setSuccessMsg('Principal signature saved. It is used on ID cards, report cards, certificates, admit cards and admission letters.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Signature uploaded but failed to update settings.');
    }
  };

  const handleControllerSignatureUploaded = async (res: UploadResult) => {
    const oldControllerKey = formData.examControllerSignatureFileKey || formData.examControllerSignature;
    const fileKey = res.fileKey || res.previewUrl;
    const updatedData = { ...formData, examControllerSignature: fileKey, examControllerSignatureFileKey: res.fileKey };
    setFormData(updatedData);
    await fileUploadService.confirmFileAssociation(res.fileKey, { type: 'EXAM_CONTROLLER_SIGNATURE', id: 'school-main' });
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      deleteReplacedFile(oldControllerKey, res.fileKey);
      setSuccessMsg('Exam controller signature saved. Staff-issued marksheets will use it.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Signature uploaded but failed to update settings.');
    }
  };

  const handleControllerSignatureRemoved = async () => {
    if (formData.examControllerSignatureFileKey) {
      await fileUploadService.deleteFile(formData.examControllerSignatureFileKey);
    }
    const updatedData = { ...formData, examControllerSignature: '', examControllerSignatureFileKey: undefined };
    setFormData(updatedData);
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      setSuccessMsg('Exam controller signature removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings after removing signature.');
    }
  };

  const handleSignatureRemoved = async () => {
    if (formData.principalSignatureFileKey) {
      await fileUploadService.deleteFile(formData.principalSignatureFileKey);
    }
    const updatedData = {
      ...formData,
      principalSignature: '',
      principalSignatureFileKey: undefined,
    };
    setFormData(updatedData);
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      setSuccessMsg('Principal signature removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings after removing signature.');
    }
  };

  const handleUpiQrUploaded = async (res: UploadResult) => {
    const fileKey = res.fileKey || res.previewUrl;
    const currentPayment = formData.paymentOptions || {
      accountHolderName: 'RESIDENTIAL PDS PUBLIC SCHOOL',
      bankName: 'State Bank of India (SBI)',
      accountNumber: '',
      ifsc: '',
      branch: '',
      upiId: '',
    };
    const updatedPayment = {
      ...currentPayment,
      upiQrCode: fileKey,
      upiQrCodeFileKey: res.fileKey,
    };
    const updatedData = {
      ...formData,
      paymentOptions: updatedPayment,
      bankDetails: updatedPayment,
    };
    setFormData(updatedData);
    await fileUploadService.confirmFileAssociation(res.fileKey, {
      type: 'UPI_QR_CODE' as any,
      id: 'school-payment',
    });
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      setSuccessMsg('Official UPI QR Code uploaded to storage and persisted successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'QR code uploaded but failed to save settings.');
    }
  };

  const handleUpiQrRemoved = async () => {
    if (formData.paymentOptions?.upiQrCodeFileKey) {
      await fileUploadService.deleteFile(formData.paymentOptions.upiQrCodeFileKey);
    }
    const currentPayment = formData.paymentOptions || {
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      branch: '',
      upiId: '',
    };
    const updatedPayment = {
      ...currentPayment,
      upiQrCode: '',
      upiQrCodeFileKey: undefined,
    };
    const updatedData = {
      ...formData,
      paymentOptions: updatedPayment,
      bankDetails: updatedPayment,
    };
    setFormData(updatedData);
    try {
      const updated = await api.updateSettingsAsync(updatedData);
      onUpdateSettings(updated);
      setSuccessMsg('UPI QR code removed successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings after removing QR code.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Institutional School Configuration</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Single-School Deployment
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure central school metadata, CBSE affiliation, principal credentials, and operating hours.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/permissions')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold shadow-2xs transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>User Roles & Permissions (RBAC)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBackendModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>Backend Connectivity</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
            1. Institutional Profile & Board Affiliation
          </h3>

          {/* Official School Logo */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div>
              <label className="block font-bold text-slate-800 text-xs">
                Official School Emblem / Logo
              </label>
              <p className="text-[11px] text-slate-500">
                Rendered on public website, printed ID cards, report cards, fee receipts, and official school certificates.
              </p>
            </div>

            <FileUploadComponent
              uploadType="school-logo"
              currentValue={formData.schoolLogo}
              currentFileKey={formData.logoFileKey}
              onUploadComplete={handleLogoUploaded}
              onRemove={handleLogoRemoved}
              hint="PNG, JPG, or SVG up to 5MB."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">School Full Name</label>
              <input
                type="text"
                required
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">School Code</label>
              <input
                type="text"
                required
                value={formData.schoolCode}
                onChange={(e) => setFormData({ ...formData, schoolCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold text-blue-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Affiliated Board</label>
              <input
                type="text"
                value={formData.affiliatedBoard}
                onChange={(e) => setFormData({ ...formData, affiliatedBoard: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Affiliation Number</label>
              <input
                type="text"
                value={formData.affiliationNumber}
                onChange={(e) => setFormData({ ...formData, affiliationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Active Academic Session</label>
              <input
                type="text"
                value={formData.currentAcademicSession}
                onChange={(e) =>
                  setFormData({ ...formData, currentAcademicSession: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-bold text-emerald-700"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Official Address</label>
              <input
                type="text"
                value={formData.schoolAddress}
                onChange={(e) => setFormData({ ...formData, schoolAddress: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
            2. Leadership, Contact & Operations
          </h3>

          {/* Official Principal Signature Upload */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div>
              <label className="block font-bold text-slate-800 text-xs">
                Official Principal / Authorized Signatory Signature
              </label>
              <p className="text-[11px] text-slate-500">
                Uploaded signature is dynamically rendered across Teacher/Staff ID cards, Student ID cards, report cards, and certificates.
              </p>
            </div>

            <FileUploadComponent
              uploadType="principal-signature"
              currentValue={formData.principalSignature}
              currentFileKey={formData.principalSignatureFileKey}
              onUploadComplete={handleSignatureUploaded}
              onRemove={handleSignatureRemoved}
              hint="PNG with transparent background (or JPG/WEBP) up to 5MB."
            />
          </div>

          {/* Controller of Examinations signature */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div>
              <label className="block font-bold text-slate-800 text-xs">Controller of Examinations Signature</label>
              <p className="text-[11px] text-slate-500">Printed on marksheets issued by the school. It is not shown on the public result page.</p>
            </div>
            <FileUploadComponent
              uploadType="exam-controller-signature"
              currentValue={formData.examControllerSignature}
              currentFileKey={formData.examControllerSignatureFileKey}
              onUploadComplete={handleControllerSignatureUploaded}
              onRemove={handleControllerSignatureRemoved}
              hint="PNG with transparent background (or JPG/WEBP) up to 5MB."
            />
            <div className="max-w-xs">
              <label className="block font-semibold text-slate-700 mb-1 text-xs">Controller of Examinations name</label>
              <input
                type="text"
                value={formData.examControllerName || ''}
                onChange={(e) => setFormData({ ...formData, examControllerName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Principal / Head of Institution</label>
              <input
                type="text"
                value={formData.principalName}
                onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Telephone</label>
              <input
                type="text"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Administrative Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Website</label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">School Assembly Start</label>
              <input
                type="text"
                value={formData.schoolTiming.startTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    schoolTiming: { ...formData.schoolTiming, startTime: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dispersal / End Time</label>
              <input
                type="text"
                value={formData.schoolTiming.endTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    schoolTiming: { ...formData.schoolTiming, endTime: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
              />
            </div>
          </div>
        </div>

        {/* Mobile app update popup */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Mobile App Update</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              After you publish a new app on the Play Store, enter its version code (Android build number, e.g. 6) and save.
              Every phone with an older app then sees a "New update available" popup each time the app opens, until it is updated.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {([
              ['latestVersionCode', 'Latest version code', 'number', 'e.g. 6'],
              ['latestVersionName', 'Latest version name', 'text', 'e.g. 1.0.6'],
              ['minVersionCode', 'Required version code (cannot skip)', 'number', 'Leave empty to allow "Later"'],
            ] as const).map(([key, label, type, ph]) => (
              <div key={key}>
                <label className="block font-semibold text-slate-700 mb-1" htmlFor={`mau-${key}`}>{label}</label>
                <input
                  id={`mau-${key}`}
                  type={type}
                  min={type === 'number' ? 1 : undefined}
                  placeholder={ph}
                  value={(formData.mobileAppUpdate as any)?.[key] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = type === 'number' ? (raw === '' ? undefined : Math.max(0, Math.floor(Number(raw)))) : raw;
                    setFormData({ ...formData, mobileAppUpdate: { ...(formData.mobileAppUpdate || {}), [key]: v } });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1" htmlFor="mau-message">Message in the popup (optional)</label>
              <input
                id="mau-message"
                type="text"
                maxLength={300}
                placeholder="A new version of the school app is available with improvements and fixes."
                value={formData.mobileAppUpdate?.message ?? ''}
                onChange={(e) => setFormData({ ...formData, mobileAppUpdate: { ...(formData.mobileAppUpdate || {}), message: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Payment Options & Institutional Banking (Bank Details + UPI Details) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>3. Payment Options: Bank Details & UPI Details</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Official institutional banking coordinates automatically embedded into Student Admission Letters, Fee Receipts, and Invoices.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md self-start sm:self-auto">
              Dynamic Admission Letter Integration
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Core Bank Account Details */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Landmark className="w-4 h-4 text-blue-700" />
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  Bank Account Information (NEFT / RTGS / IMPS)
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account Holder Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RESIDENTIAL PDS PUBLIC SCHOOL"
                    value={formData.paymentOptions?.accountHolderName ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const current = formData.paymentOptions || {
                        accountHolderName: '',
                        bankName: '',
                        accountNumber: '',
                        ifsc: '',
                        branch: '',
                        upiId: '',
                      };
                      const updated = { ...current, accountHolderName: val };
                      setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-bold uppercase text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bank Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. State Bank of India (SBI)"
                    value={formData.paymentOptions?.bankName ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const current = formData.paymentOptions || {
                        accountHolderName: '',
                        bankName: '',
                        accountNumber: '',
                        ifsc: '',
                        branch: '',
                        upiId: '',
                      };
                      const updated = { ...current, bankName: val };
                      setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-medium text-slate-900 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Account Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 38947291054"
                      value={formData.paymentOptions?.accountNumber ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s+/g, '');
                        const current = formData.paymentOptions || {
                          accountHolderName: '',
                          bankName: '',
                          accountNumber: '',
                          ifsc: '',
                          branch: '',
                          upiId: '',
                        };
                        const updated = { ...current, accountNumber: val };
                        setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold text-blue-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      IFSC Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SBIN0002124"
                      value={formData.paymentOptions?.ifsc ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/\s+/g, '');
                        const current = formData.paymentOptions || {
                          accountHolderName: '',
                          bankName: '',
                          accountNumber: '',
                          ifsc: '',
                          branch: '',
                          upiId: '',
                        };
                        const updated = { ...current, ifsc: val };
                        setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold uppercase text-slate-900 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sheohar Main Branch, Collectorate Road, Sheohar"
                    value={formData.paymentOptions?.branch ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const current = formData.paymentOptions || {
                        accountHolderName: '',
                        bankName: '',
                        accountNumber: '',
                        ifsc: '',
                        branch: '',
                        upiId: '',
                      };
                      const updated = { ...current, branch: val };
                      setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Right Card: UPI Details & QR Code Upload */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <QrCode className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  UPI Coordinates & QR Code
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Official UPI ID / VPA <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. residentialpdspublicschool@sbi"
                    value={formData.paymentOptions?.upiId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().trim();
                      const current = formData.paymentOptions || {
                        accountHolderName: '',
                        bankName: '',
                        accountNumber: '',
                        ifsc: '',
                        branch: '',
                        upiId: '',
                      };
                      const updated = { ...current, upiId: val };
                      setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold text-emerald-800 bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Google Pay, PhonePe, Paytm, BHIM and all bank UPI apps accept this Virtual Payment Address.
                  </p>
                </div>

                {/* UPI QR Code Upload */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">UPI QR Code Image</span>
                      <span className="text-[11px] text-slate-500">
                        Upload official BharatQR / UPI QR code image or let admission letters generate one dynamically.
                      </span>
                    </div>
                  </div>

                  <FileUploadComponent
                    uploadType="upi-qr-code"
                    currentValue={formData.paymentOptions?.upiQrCode}
                    currentFileKey={formData.paymentOptions?.upiQrCodeFileKey}
                    onUploadComplete={handleUpiQrUploaded}
                    onRemove={handleUpiQrRemoved}
                    hint="PNG, JPG, or WEBP up to 5MB."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fee Payment Narration / Instructions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Please mention Student Admission Number in remarks. Send receipt screenshot on WhatsApp."
                    value={formData.paymentOptions?.instructions ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const current = formData.paymentOptions || {
                        accountHolderName: '',
                        bankName: '',
                        accountNumber: '',
                        ifsc: '',
                        branch: '',
                        upiId: '',
                      };
                      const updated = { ...current, instructions: val };
                      setFormData({ ...formData, paymentOptions: updated, bankDetails: updated });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-hidden text-slate-900 bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      <BackendStatusModal
        isOpen={showBackendModal}
        onClose={() => setShowBackendModal(false)}
      />
    </div>
  );
};
