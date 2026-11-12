import { unregisterWebPush } from './webPush';
import { clearAllStaffDrafts } from '../utils/staffDraftStorage';
import {
  User,
  UserRole,
  PermissionKey,
  PermissionModuleGroup,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../types';
import { api } from './api';
import { getApiUrl, getAuthToken, getAuthHeaders } from './apiConfig';

const TOKEN_KEY = 'cps_auth_token';
const USER_KEY = 'cps_auth_user';
const STORAGE_TYPE_KEY = 'cps_auth_storage_type';

export interface UserQueryParams {
  search?: string;
  role?: string;
  status?: string;
  classId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  success: boolean;
  users: User[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    totalUsers: number;
    activeCount: number;
    inactiveCount: number;
    suspendedCount: number;
  };
}

export const getCustomPasswords = (): Record<string, string> => {
  return {};
};

export const saveCustomPassword = (_identifier: string, _pass: string) => {
  // Plaintext password storage in localStorage disabled for security hardening
};

class AuthService {
  private getStorage(): Storage {
    const type = localStorage.getItem(STORAGE_TYPE_KEY);
    return type === 'local' ? localStorage : sessionStorage;
  }

  public getToken(): string | null {
    return getAuthToken();
  }

  public getCurrentUser(): User | null {
    return this.getStoredUser();
  }

  public getStoredUser(): User | null {
    // Ensure active token exists and is valid before returning stored user
    if (!this.getToken()) {
      return null;
    }
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const parsed: User = JSON.parse(raw);
      // Ensure student or parent avatar stays current with persistent student record
      try {
        if (parsed.role === 'STUDENT' && parsed.studentId) {
          const student = api.getStudentById(parsed.studentId);
          if (student && (student.photo || student.photoFileKey)) {
            parsed.avatar = student.photo || student.photoFileKey;
          }
        } else if (parsed.role === 'PARENT') {
          const childId = parsed.studentId || parsed.activeStudentId;
          if (childId) {
            const child = api.getStudentById(childId);
            if (child && (child.photo || child.photoFileKey)) {
              parsed.avatar = child.photo || child.photoFileKey;
            }
          }
        } else if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PRINCIPAL', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'TRANSPORT_MANAGER', 'HR_STAFF', 'ACADEMIC_COORDINATOR', 'VICE_PRINCIPAL'].includes(parsed.role) || parsed.employeeId) {
          const staff = api.getStaff().find((s) => (parsed.employeeId && s.employeeId && s.employeeId.toLowerCase() === parsed.employeeId.toLowerCase()) || s.id === parsed.id || (s.email && parsed.email && s.email.toLowerCase() === parsed.email.toLowerCase()));
          if (staff) {
            if (staff.name && !parsed.name) parsed.name = staff.name;
            if (staff.photo || staff.photoFileKey) {
              parsed.avatar = staff.photo || staff.photoFileKey;
            }
          }
        }
      } catch {
        // Suppress avatar sync error during bootstrap so user object is always restored
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public updateStoredUser(updates: Partial<User>): User | null {
    const current = this.getStoredUser();
    if (!current) return null;
    const updated = { ...current, ...updates };
    const storageType = localStorage.getItem(STORAGE_TYPE_KEY);
    const targetStorage = storageType === 'session' ? sessionStorage : localStorage;
    targetStorage.setItem(USER_KEY, JSON.stringify(updated));
    return updated;
  }

  public isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getStoredUser();
  }

  public async login(
    identifier: string,
    passwordOrDob = '',
    rememberMe = false,
    roleOrOptions?:
      | 'student'
      | 'parent'
      | 'staff'
      | 'staff_admin'
      | 'teacher'
      | 'admin'
      | { dob?: string; loginType?: 'STUDENT' | 'PARENT' | 'STAFF' | 'ADMIN' | 'STAFF_ADMIN' },
    dobParam?: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    let roleType: 'STUDENT' | 'PARENT' | 'STAFF' | 'ADMIN' | 'STAFF_ADMIN' | undefined;
    let dob = dobParam;

    if (typeof roleOrOptions === 'string') {
      if (roleOrOptions === 'student') roleType = 'STUDENT';
      else if (roleOrOptions === 'parent') roleType = 'PARENT';
      else if (roleOrOptions === 'staff' || roleOrOptions === 'staff_admin' || roleOrOptions === 'teacher' || roleOrOptions === 'admin') roleType = 'STAFF_ADMIN';
    } else if (roleOrOptions && typeof roleOrOptions === 'object') {
      roleType = roleOrOptions.loginType;
      dob = roleOrOptions.dob || dob;
    }

    if (!dob && (roleType === 'STUDENT' || roleType === 'PARENT')) {
      dob = passwordOrDob;
    }

    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: passwordOrDob,
          dob: dob || passwordOrDob,
          loginType: roleType,
          rememberMe,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          error: 'Authentication server returned an invalid response. Please try again later.',
        };
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Authentication failed. Please verify your credentials.',
        };
      }

      // Reconcile user avatar with persistent student/staff record in case custom photo was updated
      const user: User = { ...data.user };
      if (user.role === 'STUDENT' && user.studentId) {
        const student = api.getStudentById(user.studentId);
        if (student && (student.photo || student.photoFileKey)) {
          user.avatar = student.photo || student.photoFileKey;
        }
      } else if (user.role === 'PARENT') {
        const childId = user.studentId || user.activeStudentId;
        if (childId) {
          const child = api.getStudentById(childId);
          if (child && (child.photo || child.photoFileKey)) {
            user.avatar = child.photo || child.photoFileKey;
          }
        }
      } else if (user.role === 'TEACHER' && user.employeeId) {
        const staff = api.getStaff().find((s) => s.employeeId === user.employeeId);
        if (staff && (staff.photo || staff.photoFileKey)) {
          user.avatar = staff.photo || staff.photoFileKey;
        }
      }

      // Store token & sanitized user based on rememberMe preference
      const targetStorage = rememberMe ? localStorage : sessionStorage;
      // Clean up previous storage to avoid conflicts
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);

      localStorage.setItem(STORAGE_TYPE_KEY, rememberMe ? 'local' : 'session');
      targetStorage.setItem(TOKEN_KEY, data.token);
      targetStorage.setItem(USER_KEY, JSON.stringify(user));

      return { success: true, user };
    } catch (err: any) {
      console.error('[AuthService] Backend request failed:', err);
      return {
        success: false,
        error: 'Could not connect to authentication service. Please check your network and try again.',
      };
    }
  }

  /** `keepDrafts`: the session simply ran out, so a half-filled form is kept for when the person signs in again. */
  public async logout(options?: { keepDrafts?: boolean }): Promise<void> {
    const token = this.getToken();
    // While the session is still valid: this browser stops receiving this person's notifications.
    await unregisterWebPush();
    try {
      if (token) {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.warn('[AuthService] Logout server request error:', err);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(STORAGE_TYPE_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      // A half-filled staff form (it can hold bank details) must not stay on a shared computer.
      if (!options?.keepDrafts) clearAllStaffDrafts();
    }
  }

  public async switchChild(
    studentId: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const token = this.getToken();
      const res = await fetch(getApiUrl('/api/auth/switch-child'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to switch child.' };
      }

      const updatedUser = this.updateStoredUser(data.user);
      return { success: true, user: updatedUser || data.user };
    } catch {
      const user = this.getStoredUser();
      if (user && user.role === 'PARENT' && user.linkedStudentIds?.includes(studentId)) {
        user.activeStudentId = studentId;
        user.studentId = studentId;
        this.updateStoredUser(user);
        return { success: true, user };
      }
      return { success: false, error: 'Failed to switch child.' };
    }
  }

  public async forgotPassword(
    email: string
  ): Promise<{
    success: boolean;
    message: string;
    targetEmail?: string;
    error?: string;
    resetToken?: string;
    resetUrl?: string;
    emailSent?: boolean;
    warning?: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s client timeout for Render cold-starts and SMTP delivery

    try {
      const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const endpoint = getApiUrl('/api/auth/forgot-password');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(email || '').trim(), frontendUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.success) {
        return {
          success: false,
          message: '',
          error: res.status === 429 ? data?.error || 'Too many requests. Please wait and try again.' : 'Unable to send the email right now. Please try again.',
        };
      }
      return {
        success: true,
        message: data.message || 'Password reset link sent to your registered email address.',
        targetEmail: data.targetEmail,
        resetToken: data.resetToken,
        resetUrl: data.resetUrl,
        emailSent: data.emailSent,
        warning: data.warning,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      return {
        success: false,
        message: '',
        error: isTimeout
          ? 'The server is taking longer than usual to dispatch the email. Please check your inbox in a moment, or try again.'
          : 'Unable to connect to the server. Please check your network connection and try again.',
      };
    }
  }

  public async verifyResetToken(
    token: string
  ): Promise<{ valid: boolean; userName?: string; error?: string }> {
    try {
      const cleanToken = String(token || '').trim();
      if (!cleanToken) {
        return {
          valid: false,
          error: 'This password reset link is invalid or has expired. Please request a new reset link.',
        };
      }
      const res = await fetch(getApiUrl(`/api/auth/verify-reset-token?token=${encodeURIComponent(cleanToken)}`));
      const data = await res.json();
      if (!res.ok || !data.valid) {
        return {
          valid: false,
          error: data.error || 'This password reset link is invalid or has expired. Please request a new reset link.',
        };
      }
      return { valid: true, userName: data.userName };
    } catch {
      return {
        valid: false,
        error: 'This password reset link is invalid or has expired. Please request a new reset link.',
      };
    }
  }

  public async resetPasswordWithToken(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const cleanToken = String(token || '').trim();
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, newPassword: String(newPassword || '').trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: '',
          error: data.error || 'This password reset link is invalid or has expired. Please request a new reset link.',
        };
      }
      return {
        success: true,
        message: data.message || 'Password updated successfully. You can now log in with your new password.',
      };
    } catch {
      return {
        success: false,
        message: '',
        error: 'Unable to update password. Please try again later.',
      };
    }
  }

  public async resetPassword(
    identifierOrToken: string,
    resetCodeOrToken: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const token = resetCodeOrToken || identifierOrToken;
    return this.resetPasswordWithToken(token, newPassword);
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to change password.' };
      }
      return { success: true, message: data.message || 'Password changed successfully.' };
    } catch {
      return { success: true, message: 'Password changed successfully.' };
    }
  }

  public async verifyCurrentSession(): Promise<{ success: boolean; user?: User }> {
    const token = this.getToken();
    if (!token) return { success: false };
    try {
      const res = await fetch(getApiUrl('/api/auth/me'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const updated = this.updateStoredUser(data.user);
          return { success: true, user: updated || data.user };
        }
      }
      if (res.status === 401) {
        await this.logout({ keepDrafts: true });
        return { success: false };
      }
    } catch (e) {
      console.warn('[AuthService] verifyCurrentSession notice:', e);
    }
    const current = this.getStoredUser();
    return { success: !!current, user: current || undefined };
  }

  public async getProfile(): Promise<{ success: boolean; user?: User; profile?: any; error?: string }> {
    const token = this.getToken();
    const storedUser = this.getStoredUser();
    try {
      const res = await fetch(getApiUrl('/api/auth/profile'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.user) {
            this.updateStoredUser(data.user);
          }
          return data;
        }
      }
    } catch (e: any) {
      console.warn('[AuthService] Could not fetch server profile, using stored session fallback:', e);
    }

    if (storedUser) {
      let localProfile: any = null;
      const isStaff = ['TEACHER', 'PRINCIPAL', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'TRANSPORT_MANAGER', 'HR_STAFF', 'ACADEMIC_COORDINATOR', 'VICE_PRINCIPAL'].includes(storedUser.role) || !!storedUser.employeeId;
      if (isStaff) {
        localProfile = api.getStaff().find((s) => (storedUser.employeeId && s.employeeId && s.employeeId.toLowerCase() === storedUser.employeeId.toLowerCase()) || s.id === storedUser.id || (s.email && storedUser.email && s.email.toLowerCase() === storedUser.email.toLowerCase()));
      } else if (storedUser.role === 'STUDENT' && storedUser.studentId) {
        localProfile = api.getStudentById(storedUser.studentId);
      } else if (storedUser.role === 'SUPER_ADMIN' || storedUser.role === 'SCHOOL_ADMIN') {
        localProfile = api.getAdminAccounts().find((a) => a.id === storedUser.id || (a.username && storedUser.username && a.username.toLowerCase() === storedUser.username.toLowerCase()));
      }
      return {
        success: true,
        user: storedUser,
        profile: localProfile || storedUser,
      };
    }

    return { success: false, error: 'No active session found' };
  }

  public async updateProfile(updates: any): Promise<{ success: boolean; user?: User; profile?: any; message?: string; error?: string }> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'Authentication required. Please log in again.' };
    }
    try {
      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || `Failed to update profile (HTTP ${res.status})`,
        };
      }
      if (data.user) {
        this.updateStoredUser(data.user);
      }
      return data;
    } catch (e: any) {
      console.error('[AuthService] Network update profile error:', e);
      return {
        success: false,
        error: e?.message || 'Network error connecting to server while updating profile.',
      };
    }
  }

  public async getUsers(params: UserQueryParams = {}): Promise<UserListResponse> {
    const token = this.getToken();
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    if (params.classId) query.set('classId', params.classId);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    try {
      const res = await fetch(getApiUrl(`/api/users?${query.toString()}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return data;
      }
      throw new Error(data.error || 'Failed to fetch users');
    } catch (err: any) {
      console.warn('[AuthService] Error fetching users from server:', err?.message);
      return {
        success: false,
        users: [],
        total: 0,
        page: params.page || 1,
        totalPages: 0,
        stats: {
          totalUsers: 0,
          activeCount: 0,
          inactiveCount: 0,
          suspendedCount: 0,
        },
      };
    }
  }

  public async createUser(userData: {
    name: string;
    username: string;
    email: string;
    phone: string;
    role: UserRole;
    password: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    employeeId?: string;
    studentId?: string;
    avatar?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create user' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public async updateUser(
    id: string,
    updates: Partial<User>
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update user' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public async updateUserStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/users/${id}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update user status' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public async adminResetPassword(
    id: string,
    newPassword: string,
    forcePasswordChange = true
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/users/${id}/reset-password`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword, forcePasswordChange }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to reset password' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public async deleteUser(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete user' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public hasPermission(permission: PermissionKey | string): boolean {
    const user = this.getCurrentUser();
    return hasPermission(user, permission);
  }

  public hasAnyPermission(permissions: (PermissionKey | string)[]): boolean {
    const user = this.getCurrentUser();
    return hasAnyPermission(user, permissions);
  }

  public hasAllPermissions(permissions: (PermissionKey | string)[]): boolean {
    const user = this.getCurrentUser();
    return hasAllPermissions(user, permissions);
  }

  public async getRbacPermissions(): Promise<{
    success: boolean;
    modules: PermissionModuleGroup[];
    allPermissions: PermissionKey[];
    error?: string;
  }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl('/api/rbac/permissions'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, modules: [], allPermissions: [], error: err.message };
    }
  }

  public async getRbacRoles(): Promise<{
    success: boolean;
    roles: Array<{
      role: UserRole;
      label: string;
      rank: number;
      permissions: string[];
      isDefault: boolean;
    }>;
    error?: string;
  }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl('/api/rbac/roles'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, roles: [], error: err.message };
    }
  }

  public async getRbacUsers(params: UserQueryParams = {}): Promise<{
    success: boolean;
    users: any[];
    total: number;
    error?: string;
  }> {
    const token = this.getToken();
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    try {
      const res = await fetch(getApiUrl(`/api/rbac/users?${query.toString()}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, users: [], total: 0, error: err.message };
    }
  }

  public async updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/rbac/users/${encodeURIComponent(userId)}/role`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update user role' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public async updateUserPermissions(
    userId: string,
    permissions: string[],
    deniedPermissions: string[] = []
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/rbac/users/${encodeURIComponent(userId)}/permissions`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions, deniedPermissions }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update user permissions' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }

  public async updateRolePermissions(
    role: UserRole,
    permissions: string[]
  ): Promise<{ success: boolean; permissions?: string[]; error?: string }> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiUrl(`/api/rbac/roles/${encodeURIComponent(role)}/permissions`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update role permissions' };
      }
      return { success: true, permissions: data.permissions };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error' };
    }
  }
}

export const authService = new AuthService();
