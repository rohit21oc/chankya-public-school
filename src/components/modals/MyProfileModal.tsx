import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Key,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  User as UserIcon,
  X,
  Edit2,
  Save,
  Loader2,
  AlertCircle,
  MapPin,
  GraduationCap,
} from 'lucide-react';
import { SchoolSettings, User } from '../../types';
import { authService } from '../../services/authService';
import { fileUploadService } from '../../services/fileUploadService';
import { PASSWORD_RULE_TEXT, validateNewPassword } from '../../utils/passwordPolicy';

interface MyProfileModalProps {
  user: User;
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser?: (user: User) => void;
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({
  user,
  settings,
  isOpen,
  onClose,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'security'>('details');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Dynamic server profile data
  const [profileData, setProfileData] = useState<any>(null);

  // Edit details state
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editEmail, setEditEmail] = useState(user.email || '');
  const [editName, setEditName] = useState(user.name || '');
  const [editAddress, setEditAddress] = useState((user as any).address || '');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isStaffRole = [
    'TEACHER',
    'PRINCIPAL',
    'ACCOUNTANT',
    'HOSTEL_WARDEN',
    'TRANSPORT_MANAGER',
    'HR_STAFF',
    'ACADEMIC_COORDINATOR',
    'VICE_PRINCIPAL',
  ].includes(user.role) || !!user.employeeId;

  const isAdminRole = user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN';

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await authService.getProfile();
        if (isMounted && res.success && res.profile) {
          setProfileData(res.profile);
          setEditName(res.user?.name || res.profile.name || user.name || '');
          setEditEmail(res.user?.email || res.profile.email || user.email || '');
          setEditPhone(res.user?.phone || res.profile.phone || res.profile.mobile || user.phone || '');
          setEditAddress(res.profile.address || (res.user as any)?.address || (user as any).address || '');
        }
      } catch (err) {
        console.warn('Could not fetch server profile in modal:', err);
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    setSaveStatus(null);
    try {
      const payload: any = {
        email: editEmail.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
      };
      if (isAdminRole || user.role === 'PRINCIPAL') {
        payload.name = editName.trim();
      }
      if (isStaffRole) {
        payload.mobile = editPhone.trim();
      }
      const res = await authService.updateProfile(payload);
      if (res.success) {
        setSaveStatus({ type: 'success', message: 'Details updated successfully!' });
        if (res.user && onUpdateUser) {
          onUpdateUser(res.user);
        }
        if (res.profile) {
          setProfileData(res.profile);
        }
        setIsEditing(false);
      } else {
        setSaveStatus({ type: 'error', message: res.error || 'Failed to update details' });
      }
    } catch (e: any) {
      setSaveStatus({ type: 'error', message: e.message || 'Error updating details' });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'All password fields are required.' });
      return;
    }
    const policyError = validateNewPassword(newPassword);
    if (policyError) {
      setPasswordStatus({ type: 'error', message: policyError });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordStatus(null);

    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', message: res.error || 'Failed to update password.' });
      }
    } catch {
      setPasswordStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const roleBadgeColor =
    user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : user.role === 'PRINCIPAL'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : user.role === 'TEACHER'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : user.role === 'STUDENT'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">My Profile</h2>
              <p className="text-xs text-slate-400">Authenticated Account Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Security & Credentials
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'details' ? (
            <>
              {/* User Hero Banner */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                {user.avatar ? (
                  <img
                    src={fileUploadService.getFileUrl(user.avatar)}
                    alt={user.name}
                    className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-sm ring-1 ring-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-blue-900 text-white flex items-center justify-center text-2xl font-bold shadow-sm">
                    {user.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{user.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadgeColor}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {user.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Username: <span className="font-semibold text-slate-700">{user.username}</span> • User ID: <span className="font-mono text-slate-700">{user.id}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    School: <span className="font-semibold text-slate-800">{settings.schoolName}</span>
                  </p>
                </div>
              </div>

              {/* Information Grid or Edit Form */}
              {saveStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    saveStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {saveStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{saveStatus.message}</span>
                </div>
              )}

              {!isEditing ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Information</span>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Details
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Email Address</span>
                      </div>
                      <div className="text-slate-900 font-medium truncate">{profileData?.email || user.email || 'Not configured'}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Contact Mobile</span>
                      </div>
                      <div className="text-slate-900 font-medium">{profileData?.phone || profileData?.mobile || user.phone || 'Not configured'}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Account Role</span>
                      </div>
                      <div className="text-slate-900 font-semibold">{user.role.replace('_', ' ')}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Last Login</span>
                      </div>
                      <div className="text-slate-900 font-medium">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Current Active Session'}
                      </div>
                    </div>

                    {isStaffRole && (
                      <>
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Employee ID</span>
                          </div>
                          <div className="text-slate-900 font-mono font-medium">{profileData?.employeeId || user.employeeId || 'Assigned'}</div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Designation</span>
                          </div>
                          <div className="text-slate-900 font-medium">{profileData?.designation || (user.role === 'PRINCIPAL' ? 'Principal' : 'Staff Member')}</div>
                        </div>

                        {profileData?.qualification && (
                          <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                              <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                              <span className="font-semibold uppercase tracking-wider text-[10px]">Qualification</span>
                            </div>
                            <div className="text-slate-900 font-medium">{profileData.qualification}</div>
                          </div>
                        )}
                      </>
                    )}

                    {user.studentId && (
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span className="font-semibold uppercase tracking-wider text-[10px]">Student Record ID</span>
                        </div>
                        <div className="text-slate-900 font-mono font-medium">{user.studentId}</div>
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white sm:col-span-2">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Residential / Official Address</span>
                      </div>
                      <div className="text-slate-900 font-medium">{profileData?.address || (user as any).address || 'Not configured'}</div>
                    </div>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveDetails} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Edit Personal Information</span>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>

                  {isAdminRole && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="e.g. user@residentialpdspublicschool.edu.in"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Mobile</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                    <textarea
                      rows={2}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Complete address"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingDetails}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Details
                    </button>
                  </div>
                </form>
              )}

              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-slate-700 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900">Protected Single-School Session</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    This account is bound to your authenticated identity. All actions are logged and authenticated via server-side session authorization.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Security Tab - Change Password */
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">Update Account Password</h4>
                <p className="text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
              </div>

              {passwordStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    passwordStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {passwordStatus.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters, letters and numbers"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
