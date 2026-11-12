import { formatDobAsTyped, dobSecretForSubmit } from '../../utils/dobInput';
import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound, Lock, Mail, Phone, User as UserIcon } from 'lucide-react';
import { SchoolSettings, User } from '../../types';
import { authService } from '../../services/authService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { api } from '../../services/api';

interface LoginViewProps {
  settings?: SchoolSettings;
  onLoginSuccess: (user: User) => void;
  onBackToWebsite?: () => void;
  initialForgotMode?: boolean;
  onOpenResetToken?: (token: string) => void;
  initialTab?: 'staff' | 'student' | 'parent';
}

export type LoginTab = 'staff' | 'student' | 'parent';

const FORGOT_SENT = 'If an account matches these details, a reset link has been sent to its registered email. The link works once and expires in 15 minutes.';

const TABS: Array<{ id: LoginTab; label: string }> = [
  { id: 'staff', label: 'Admin / Staff' },
  { id: 'student', label: 'Student' },
  { id: 'parent', label: 'Parent' },
];

/** Labelled input in the mobile login style. */
const Field: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>> = ({ id, label, icon, trailing, className, ...rest }) => (
  <div>
    <label htmlFor={id} className="block text-[13px] font-semibold text-[#344054] mb-1.5">
      {label}
    </label>
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">{icon}</span>
      <input
        id={id}
        {...rest}
        className={`w-full h-12 pl-10 ${trailing ? 'pr-11' : 'pr-3.5'} rounded-xl border border-[#D0D5DD] bg-white text-[15px] text-[#101828] placeholder-[#98A2B3] focus:outline-none focus:border-[#123B8C] focus:ring-4 focus:ring-[#123B8C]/10 disabled:bg-[#F9FAFB] transition ${className || ''}`}
      />
      {trailing}
    </div>
  </div>
);

const RevealButton: React.FC<{ shown: boolean; onToggle: () => void }> = ({ shown, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={shown ? 'Hide password' : 'Show password'}
    aria-pressed={shown}
    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[#667085] hover:text-[#101828] rounded-r-xl"
  >
    {shown ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
  </button>
);

export const LoginView: React.FC<LoginViewProps> = ({
  settings: initialSettingsProp,
  onLoginSuccess,
  onBackToWebsite,
  initialForgotMode = false,
  onOpenResetToken,
  initialTab = 'staff',
}) => {
  // Exactly THREE login experiences: Staff/Admin, Student, Parent
  const [activeTab, setActiveTab] = useState<LoginTab>(initialTab);

  // Dynamic School Settings state loaded from the existing School Settings API/database source of truth
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(() => {
    if (initialSettingsProp?.schoolName) {
      return initialSettingsProp;
    }
    try {
      const cached = api.getSettings();
      if (cached?.schoolName) {
        return cached;
      }
    } catch {}
    return null;
  });
  const [isSettingsLoading, setIsSettingsLoading] = useState<boolean>(() => {
    return !initialSettingsProp?.schoolName && !api?.getSettings()?.schoolName;
  });

  // Form states
  // 1. Staff / Admin (Unified common login for all 10 staff/admin roles)
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // 2. Student (Admission Number + Date of Birth)
  const [studentId, setStudentId] = useState('');
  const [studentDob, setStudentDob] = useState('');

  // 3. Parent (Registered Mobile + Child's Date of Birth or Password)
  const [parentMobile, setParentMobile] = useState('');
  const [parentChildDob, setParentChildDob] = useState('');

  // Common form states
  const [rememberMe, setRememberMe] = useState(true);
  const [showParentSecret, setShowParentSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password workflow state (Email reset link - single use secure token)
  const [isForgotMode, setIsForgotMode] = useState(initialForgotMode);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<{
    message: string;
  } | null>(null);


  useEffect(() => {
    let isMounted = true;

    // Dynamically load the authoritative school settings from the existing API/database source of truth
    const loadDynamicSettings = async () => {
      try {
        const synced = await api.syncSettings();
        if (isMounted && synced && synced.schoolName) {
          setSchoolSettings(synced);
          setIsSettingsLoading(false);
        }
      } catch {
        // Fallback cleanly to cached settings or initial prop without crashing
        if (isMounted) {
          const fallback = initialSettingsProp || api.getSettings();
          if (fallback && fallback.schoolName) {
            setSchoolSettings(fallback);
          }
          setIsSettingsLoading(false);
        }
      }
    };

    loadDynamicSettings();

    // Dynamically update when School Settings is modified in the system
    const handleSettingsUpdated = () => {
      if (isMounted) {
        const latest = api.getSettings();
        if (latest && latest.schoolName) {
          setSchoolSettings(latest);
          setIsSettingsLoading(false);
        }
      }
    };

    window.addEventListener('pradnya_entity_settings', handleSettingsUpdated);
    window.addEventListener('academic-session-changed', handleSettingsUpdated);
    window.addEventListener('pradnya_data_updated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('pradnya_entity_settings', handleSettingsUpdated);
      window.removeEventListener('academic-session-changed', handleSettingsUpdated);
      window.removeEventListener('pradnya_data_updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
    };
  }, []);

  // Synchronize when parent passes updated settings prop
  useEffect(() => {
    if (initialSettingsProp && initialSettingsProp.schoolName) {
      setSchoolSettings(initialSettingsProp);
      setIsSettingsLoading(false);
    }
  }, [initialSettingsProp]);

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setErrorMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let identifierParam = '';
    let passwordParam = '';
    let dobParam = '';

    if (activeTab === 'staff') {
      const cleanId = staffIdentifier.trim();
      if (!cleanId) {
        setErrorMessage('Please enter your login ID.');
        return;
      }
      if (!staffPassword) {
        setErrorMessage('Please enter your password.');
        return;
      }

      identifierParam = cleanId;
      passwordParam = staffPassword;
    } else if (activeTab === 'student') {
      const cleanStudentId = studentId.trim();
      const cleanDob = studentDob.trim();

      if (!cleanStudentId) {
        setErrorMessage('Please enter your Admission Number or Registration Number.');
        return;
      }
      if (!cleanDob) {
        setErrorMessage('Please enter your Date of Birth in DD-MM-YYYY format (e.g. 20-04-2015).');
        return;
      }

      // Accept DOB (DD-MM-YYYY / YYYY-MM-DD) OR custom portal password
      const dobRegex = /^(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})$/;
      if (!dobRegex.test(cleanDob) && cleanDob.length < 3) {
        setErrorMessage('Please enter your Date of Birth (DD-MM-YYYY) or your portal password.');
        return;
      }

      identifierParam = cleanStudentId;
      dobParam = cleanDob;
    } else if (activeTab === 'parent') {
      const cleanMobile = parentMobile.trim();
      const cleanDob = parentChildDob.trim();

      if (!cleanMobile) {
        setErrorMessage('Please enter your registered 10-digit mobile number.');
        return;
      }
      const digitsOnly = cleanMobile.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (!cleanDob) {
        setErrorMessage("Please enter your password or your child's Date of Birth (DD-MM-YYYY).");
        return;
      }

      const dobRegex = /^(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})$/;
      if (!dobRegex.test(cleanDob) && cleanDob.length < 3) {
        setErrorMessage("Invalid format. Please enter password or child's Date of Birth as DD-MM-YYYY.");
        return;
      }

      identifierParam = cleanMobile;
      dobParam = cleanDob;
    }

    // A half-typed date that is really a numeric password is sent without the display dashes.
    let dobAlternate: string | undefined;
    if (activeTab === 'student' || activeTab === 'parent') {
      const secret = dobSecretForSubmit(dobParam);
      dobParam = secret.primary;
      dobAlternate = secret.alternate;
    }

    setIsLoading(true);

    try {
      // Role is determined securely by the backend after authentication.
      // Frontend passes activeTab ('staff' maps to 'STAFF_ADMIN', 'student', 'parent')
      let result = await authService.login(
        identifierParam,
        passwordParam,
        rememberMe,
        activeTab,
        dobParam
      );
      // An 8-digit numeric password looks like a date once the dashes are added; try it as typed.
      if (!(result.success && result.user) && dobAlternate) {
        const retry = await authService.login(identifierParam, passwordParam, rememberMe, activeTab, dobAlternate);
        if (retry.success && retry.user) result = retry;
      }

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        const rawErr = (result.error || '').toLowerCase();
        const isTechnicalOrNetwork =
          !rawErr ||
          rawErr.includes('connect') ||
          rawErr.includes('network') ||
          rawErr.includes('server') ||
          rawErr.includes('service') ||
          rawErr.includes('database') ||
          rawErr.includes('mongo') ||
          rawErr.includes('internal') ||
          rawErr.includes('jwt') ||
          rawErr.includes('token') ||
          rawErr.includes('bcrypt') ||
          rawErr.includes('500') ||
          rawErr.includes('503') ||
          rawErr.includes('timeout') ||
          rawErr.includes('response') ||
          rawErr.includes('fetch');

        if (isTechnicalOrNetwork) {
          setErrorMessage('Unable to sign in right now. Please try again.');
        } else {
          setErrorMessage(result.error || 'Unable to sign in right now. Please try again.');
        }
      }
    } catch {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;

    const cleanInput = forgotEmail.trim();
    if (!cleanInput) {
      setForgotError('Please enter your registered email or login ID.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await authService.forgotPassword(cleanInput);
      if (res.success) {
        // Same answer whether or not an account exists (the server never says which).
        setForgotSuccess({ message: FORGOT_SENT });
      } else {
        const rawErr = (res.error || '').toLowerCase();
        const errorMsg =
          rawErr.includes('server') ||
          rawErr.includes('smtp') ||
          rawErr.includes('connect') ||
          rawErr.includes('database')
            ? 'Unable to send the email right now. Please try again.'
            : res.error || 'Unable to send the email right now. Please try again.';
        setForgotError(errorMsg);
      }
    } catch {
      setForgotError('Unable to send the email right now. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const activeSettings = schoolSettings || initialSettingsProp || api.getSettings();
  const schoolFullName = (activeSettings?.schoolName || '').trim();
  const schoolLogoSrc = getSchoolLogoSrc(activeSettings);
  const canReset = activeTab !== 'student';

  const openForgot = () => {
    setIsForgotMode(true);
    setForgotEmail(activeTab === 'staff' && staffIdentifier.includes('@') ? staffIdentifier : '');
    setForgotError(null);
    setForgotSuccess(null);
  };

  return (
    <div className="min-h-screen bg-[#0B1F4B] flex flex-col items-center justify-start sm:justify-center sm:py-10">
      <div className="w-full sm:max-w-[440px] flex flex-col min-h-screen sm:min-h-0">
        {/* Crest and school name, as on the mobile app */}
        <div className="flex flex-col items-center text-center px-6 pt-10 pb-8 sm:pt-0">
          <div className="w-[108px] h-[108px] rounded-full bg-white border-[3px] border-[#D9A441] flex items-center justify-center shadow-lg shadow-black/20">
            <img src={schoolLogoSrc} alt="" onError={handleLogoError} className="w-[84px] h-[84px] object-contain" />
          </div>
          {isSettingsLoading && !schoolFullName ? (
            <div className="mt-4 h-5 w-56 rounded bg-white/15 animate-pulse" />
          ) : (
            <h1 className="mt-4 text-white text-[17px] sm:text-lg font-extrabold leading-snug tracking-tight max-w-[320px]">{schoolFullName}</h1>
          )}
        </div>

        {/* Card */}
        <div className="flex-1 sm:flex-none bg-white rounded-t-[28px] sm:rounded-[28px] px-5 sm:px-8 pt-6 pb-8 shadow-2xl shadow-black/30">
          {!isForgotMode ? (
            <>
              <div role="tablist" aria-label="Sign in as" className="grid grid-cols-3 gap-1 p-1 rounded-[14px] bg-[#EEF2F6] mb-5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}-login`}
                    aria-selected={activeTab === t.id}
                    onClick={() => handleTabChange(t.id)}
                    className={`h-10 rounded-[11px] text-[13px] sm:text-sm font-bold transition ${activeTab === t.id ? 'bg-white text-[#0B1F4B] shadow-sm' : 'text-[#667085] hover:text-[#0B1F4B]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {errorMessage && (
                <div id="auth-error-banner" role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] p-3 text-[13px] font-medium text-[#B42318]">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                {activeTab === 'staff' && (
                  <>
                    <Field id="staff-id-input" label="Login ID" icon={<UserIcon className="w-[18px] h-[18px]" />} value={staffIdentifier} onChange={(e) => setStaffIdentifier(e.target.value)} placeholder="Employee ID, username or email" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={isLoading} />
                    <Field
                      id="staff-password-input"
                      label="Password"
                      icon={<Lock className="w-[18px] h-[18px]" />}
                      type={showStaffPassword ? 'text' : 'password'}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      trailing={<RevealButton shown={showStaffPassword} onToggle={() => setShowStaffPassword((v) => !v)} />}
                    />
                  </>
                )}

                {activeTab === 'student' && (
                  <>
                    <Field id="student-id-input" label="Admission Number" icon={<GraduationCap className="w-[18px] h-[18px]" />} value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Admission Number" autoComplete="username" autoCapitalize="characters" spellCheck={false} disabled={isLoading} />
                    <Field id="student-dob-input" label="Password (Date of Birth)" icon={<Calendar className="w-[18px] h-[18px]" />} value={studentDob} onChange={(e) => setStudentDob((prev) => formatDobAsTyped(e.target.value, prev))} placeholder="DD-MM-YYYY" inputMode="numeric" autoComplete="off" maxLength={40} disabled={isLoading} />
                  </>
                )}

                {activeTab === 'parent' && (
                  <>
                    <Field id="parent-mobile-input" label="Mobile Number" icon={<Phone className="w-[18px] h-[18px]" />} type="tel" inputMode="numeric" value={parentMobile} onChange={(e) => setParentMobile(e.target.value.replace(/[^\d+\s-]/g, ''))} placeholder="10-digit mobile number" autoComplete="tel" maxLength={14} disabled={isLoading} />
                    <Field
                      id="parent-dob-input"
                      label="Password (Child's Date of Birth)"
                      icon={<Calendar className="w-[18px] h-[18px]" />}
                      type={showParentSecret ? 'text' : 'password'}
                      value={parentChildDob}
                      onChange={(e) => setParentChildDob((prev) => formatDobAsTyped(e.target.value, prev))}
                      placeholder="DD-MM-YYYY or your password"
                      autoComplete="current-password"
                      maxLength={40}
                      disabled={isLoading}
                      trailing={<RevealButton shown={showParentSecret} onToggle={() => setShowParentSecret((v) => !v)} />}
                    />
                  </>
                )}

                <label className="flex items-center gap-2 text-[13px] text-[#475467] select-none cursor-pointer">
                  <input id="remember-me-checkbox" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-[#D0D5DD] text-[#123B8C] focus:ring-[#123B8C]" />
                  Keep me signed in
                </label>

                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-[15px] font-bold flex items-center justify-center gap-2 transition disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-[#123B8C]/25"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {canReset && (
                <button id="staff-forgot-password-btn" type="button" onClick={openForgot} className="mt-2 w-full min-h-[44px] text-sm font-bold text-[#123B8C] hover:underline">
                  Forgot password?
                </button>
              )}

              {onBackToWebsite && (
                <button type="button" onClick={onBackToWebsite} className="mt-1 w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 text-[13px] text-[#667085] hover:text-[#0B1F4B]">
                  <ArrowLeft className="w-4 h-4" /> School website
                </button>
              )}
            </>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(false);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#475467] hover:text-[#0B1F4B] min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <h2 className="mt-2 text-xl font-extrabold text-[#0B1F4B] flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#D9A441]" /> Reset password
              </h2>

              {forgotSuccess ? (
                <div className="mt-4 space-y-4" role="status">
                  <div className="rounded-2xl border border-[#ABEFC6] bg-[#ECFDF3] p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#067647] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#085D3A] leading-relaxed">{forgotSuccess.message}</p>
                  </div>
                  <p className="text-[13px] text-[#667085]">Check your inbox and spam folder. If nothing arrives, contact the school office.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setForgotSuccess(null);
                      setForgotEmail('');
                    }}
                    className="w-full h-12 rounded-xl bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-[15px] font-bold"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendResetLink} className="mt-3 space-y-4" noValidate>
                  <p className="text-[13px] text-[#475467] leading-relaxed">
                    {activeTab === 'parent' ? 'Enter the email saved on your parent account.' : 'Enter your registered email or login ID.'} We will email you a link to set a new password.
                  </p>
                  {forgotError && (
                    <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] p-3 text-[13px] font-medium text-[#B42318]">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}
                  <Field id="forgot-identifier-input" label="Email or login ID" icon={<Mail className="w-[18px] h-[18px]" />} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={forgotLoading} autoFocus />
                  <button type="submit" disabled={forgotLoading} className="w-full h-12 rounded-xl bg-[#0B1F4B] hover:bg-[#123B8C] text-white text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                    {forgotLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
