import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, Eye, EyeOff, MailCheck } from 'lucide-react';
import { authService } from '../../services/authService';
import { SchoolSettings } from '../../types';
import { getSchoolLogoSrc } from '../../constants/schoolLogo';
import { validateNewPassword } from '../../utils/passwordPolicy';

interface ResetPasswordPageProps {
  token: string;
  settings: SchoolSettings;
  onGoToLogin: () => void;
  onRequestNewLink: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token,
  settings,
  onGoToLogin,
  onRequestNewLink,
}) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetSuccess, setIsResetSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isResetSuccess) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onGoToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isResetSuccess, onGoToLogin]);

  useEffect(() => {
    let isMounted = true;
    async function verify() {
      if (!token) {
        setIsValidating(false);
        setIsTokenValid(false);
        setValidationError('This password reset link is invalid or has expired. Please request a new reset link.');
        return;
      }

      setIsValidating(true);
      const res = await authService.verifyResetToken(token);
      if (!isMounted) return;
      setIsValidating(false);

      if (res.valid) {
        setIsTokenValid(true);
        if (res.userName) setUserName(res.userName);
      } else {
        setIsTokenValid(false);
        setValidationError('This password reset link is invalid or has expired. Please request a new reset link.');
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please fill in both password fields.');
      return;
    }

    const policyError = validateNewPassword(newPassword);
    if (policyError) {
      setErrorMessage(policyError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both passwords are identical.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authService.resetPasswordWithToken(token, newPassword);
      if (res.success) {
        setIsResetSuccess(true);
      } else {
        setErrorMessage('This password reset link is invalid or has expired. Please request a new reset link.');
      }
    } catch {
      setErrorMessage('This password reset link is invalid or has expired. Please request a new reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-6 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* School Branding Card */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-xl mb-3">
            {getSchoolLogoSrc(settings?.schoolLogo) ? (
              <img
                src={getSchoolLogoSrc(settings?.schoolLogo)}
                alt="School Logo"
                className="w-12 h-12 rounded-xl object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-inner">
                PDS
              </div>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
            {settings?.schoolName || 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR'}
          </h1>
          <p className="text-xs font-semibold text-blue-400 tracking-wider uppercase mt-1">
            School Management Portal
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {isValidating ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-slate-300 font-medium">Validating secure reset link...</p>
            </div>
          ) : isResetSuccess ? (
            /* Success State */
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-white">Password Reset Successful</h2>
                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold leading-relaxed">
                  Password updated successfully. You can now log in with your new password.
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-left text-xs text-slate-300">
                  <MailCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    A confirmation email stating <strong>"Your password has been successfully updated"</strong> has been dispatched to your email inbox.
                  </span>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Go to Login</span>
                </button>
                <p className="text-center text-xs text-slate-400">
                  Redirecting to Login in {countdown} second{countdown !== 1 ? 's' : ''}...
                </p>
              </div>
            </div>
          ) : !isTokenValid ? (
            /* Invalid or Expired Token State */
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto text-red-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1.5">Reset Link Expired or Invalid</h2>
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  This password reset link is invalid or has expired. Please request a new reset link.
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={onRequestNewLink}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all"
                >
                  Request New Reset Link
                </button>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            /* Password Reset Form */
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Reset Password</h2>
                  {userName && (
                    <p className="text-xs text-slate-400">Account: <span className="text-slate-200 font-medium">{userName}</span></p>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters, letters and numbers"
                      disabled={isSubmitting}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      disabled={isSubmitting}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <span>Reset Password</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onGoToLogin}
                    disabled={isSubmitting}
                    className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Login
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Clean user notice */}
        <div className="text-center mt-4 text-[11px] text-slate-500">
          <span>Secure link &bull; 15-minute validity</span>
        </div>
      </div>
    </div>
  );
};