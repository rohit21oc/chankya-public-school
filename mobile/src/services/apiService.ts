import {
  LoginResponse,
  User,
  Student,
  Staff,
  SchoolSettings,
  TimetableSlot,
  AttendanceRecord,
  StaffAttendanceRecord,
  Exam,
  ExamMark,
  StaffPayrollRecord,
  ClassItem,
  SubjectItem,
} from '../types';
import { SingleFlightCache } from '../utils/requestCache';
import { authStorage } from './authStorage';
import { setFileBaseUrl } from '../utils/branding';
import type { TeacherDashboardSummary, TeacherAuthorizedAssignments } from '../types/teacher';

export const DEFAULT_PRODUCTION_API_URL = 'https://residentialpdsschool.in';

export interface ApiRequestOptions {
  timeoutMs?: number;
  retries?: number;
  isRetry?: boolean;
  cacheTtlMs?: number;
  skipCache?: boolean;
}

interface CacheItem<T> {
  data: T;
  status: number;
  expiresAt: number;
}

class ApiService {
  private baseUrl: string = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL)
    ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '')
    : DEFAULT_PRODUCTION_API_URL;
  private isColdStarting = false;
  // Authorized class/subject assignments are read by Dashboard, Students, Marks and
  // Attendance. Share one request between them for a short time instead of repeating it.
  private assignmentsCache = new SingleFlightCache<{
    ok: boolean;
    status: number;
    data: TeacherAuthorizedAssignments | null;
    error?: string;
  }>(60_000, (r) => r.ok);
  constructor() {
    setFileBaseUrl(this.baseUrl);
  }
  private coldStartListeners: Set<(isWaking: boolean) => void> = new Set();
  private cache: Map<string, CacheItem<any>> = new Map();
  private inFlight: Map<string, Promise<any>> = new Map();

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
    setFileBaseUrl(this.baseUrl);
  }

  public clearCache(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  private sessionExpiredListeners: Set<() => void> = new Set();

  /** Called when the server rejects the stored session, so the UI can return to login. */
  public onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.add(listener);
    return () => {
      this.sessionExpiredListeners.delete(listener);
    };
  }

  private notifySessionExpired() {
    this.sessionExpiredListeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  public subscribeColdStart(listener: (isWaking: boolean) => void): () => void {
    this.coldStartListeners.add(listener);
    listener(this.isColdStarting);
    return () => {
      this.coldStartListeners.delete(listener);
    };
  }

  private notifyColdStart(isWaking: boolean) {
    this.isColdStarting = isWaking;
    this.coldStartListeners.forEach((l) => l(isWaking));
  }

  /**
   * Universal fetch with cold-start detection, retry, timeout handling,
   * safe in-memory caching and in-flight request deduplication.
   */
  public async request<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any,
    options: ApiRequestOptions = {}
  ): Promise<{ ok: boolean; status: number; data: T; error?: string; fromCache?: boolean }> {
    const { timeoutMs = 25000, retries = 1, cacheTtlMs = 0, skipCache = false } = options;
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const token = authStorage.getToken();

    // Cache lookup for GET requests
    // Scoped to the exact session token: a different user, or the same parent after a
    // child switch (new token), can never be served another session's cached response.
    const cacheKey = `${token || 'anon'}|${method}:${url}`;
    if (method === 'GET' && !skipCache && cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          ok: true,
          status: cached.status,
          data: cached.data,
          fromCache: true,
        };
      }
    }

    // In-flight deduplication for identical concurrent GET requests
    // A retry must not join its own in-flight request (it would wait for itself forever).
    if (method === 'GET' && !options.isRetry && this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const execPromise = (async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      // If request takes longer than 3.5s, trigger cold-start warning state
      const coldStartTimer = setTimeout(() => {
        this.notifyColdStart(true);
      }, 3500);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(coldStartTimer);
      clearTimeout(timeoutId);
      this.notifyColdStart(false);

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }

      // Handle 401 Unauthorized (session expired)
      if (response.status === 401) {
        const hadSession = !!token;
        await authStorage.clearSession();
        this.clearCache();
        if (hadSession) this.notifySessionExpired();
        return {
          ok: false,
          status: 401,
          data,
          error: data?.error || 'Your session has expired. Please sign in again.',
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data,
          error: data?.error || data?.message || `Server responded with status ${response.status}`,
        };
      }

      if (response.ok && method === 'GET' && cacheTtlMs > 0) {
        this.cache.set(cacheKey, {
          data,
          status: response.status,
          expiresAt: Date.now() + cacheTtlMs,
        });
      }

      return {
        ok: true,
        status: response.status,
        data,
      };
    } catch (err: any) {
      clearTimeout(coldStartTimer);
      clearTimeout(timeoutId);
      this.notifyColdStart(false);

      const isAbort = err.name === 'AbortError';

      if (retries > 0) {
        console.warn(`[ApiService] Request to ${endpoint} failed, retrying... (${retries} attempts left)`);
        return this.request<T>(endpoint, method, body, {
          ...options,
          retries: retries - 1,
          timeoutMs: timeoutMs + 10000,
          isRetry: true,
        });
      }

      const errorMessage = isAbort
        ? 'Backend is waking up (cold start) or network timed out. Please try again in a few moments.'
        : 'Cannot reach school server. Please verify internet connection.';

      return {
        ok: false,
        status: 0,
        data: null as any,
        error: errorMessage,
      };
    } finally {
      if (method === 'GET' && !options.isRetry) {
        this.inFlight.delete(cacheKey);
      }
    }
  })();

  if (method === 'GET' && !options.isRetry) {
    this.inFlight.set(cacheKey, execPromise);
  }

  return execPromise;
}

  // ==========================================
  // AUTHENTICATION FLOWS (Real Backend APIs)
  // ==========================================

  /**
   * 1. Admin & Staff Login
   * Authenticates via one common staff/admin flow.
   * Role and permissions are determined strictly by the backend.
   */
  public async loginStaff(
    identifier: string,
    password: string,
    rememberMe = true
  ): Promise<LoginResponse> {
    const cleanId = identifier.trim();
    if (!cleanId) {
      return { success: false, error: 'Please enter your Employee ID, Username, Email, or Phone.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    const res = await this.request<LoginResponse>('/api/auth/login', 'POST', {
      identifier: cleanId,
      password,
      loginType: 'STAFF_ADMIN',
      rememberMe,
    });

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        error: res.data?.error || res.error || 'Invalid credentials. Please verify your ID and password.',
      };
    }

    if (res.data.token && res.data.user) {
      await authStorage.setSession(res.data.token, res.data.user, rememberMe);
    }

    return res.data;
  }

  /**
   * 2. Student Login
   * Authenticates via Admission Number + Date of Birth (DD-MM-YYYY).
   */
  public async loginStudent(
    admissionNumber: string,
    dob: string,
    rememberMe = true
  ): Promise<LoginResponse> {
    const cleanAdmission = admissionNumber.trim();
    const cleanDob = dob.trim();

    if (!cleanAdmission) {
      return { success: false, error: 'Please enter your Roll Number or Admission Number.' };
    }
    if (!cleanDob) {
      return { success: false, error: 'Please enter your Date of Birth in DD-MM-YYYY format (e.g. 14-05-2015).' };
    }

    const res = await this.request<LoginResponse>('/api/auth/login', 'POST', {
      identifier: cleanAdmission,
      dob: cleanDob,
      password: cleanDob,
      loginType: 'STUDENT',
      rememberMe,
    });

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        error: res.data?.error || res.error || 'Student authentication failed. Please verify your Admission Number and DOB.',
      };
    }

    if (res.data.token && res.data.user) {
      await authStorage.setSession(res.data.token, res.data.user, rememberMe);
    }

    return res.data;
  }

  /**
   * 3. Parent Login
   * Authenticates via Registered 10-Digit Mobile + Child's Date of Birth or Password.
   */
  public async loginParent(
    mobileNumber: string,
    childDobOrPassword: string,
    rememberMe = true
  ): Promise<LoginResponse> {
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
    const cleanDob = childDobOrPassword.trim();

    if (cleanMobile.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit registered mobile number.' };
    }
    if (!cleanDob) {
      return { success: false, error: "Please enter your password or child's Date of Birth (DD-MM-YYYY)." };
    }

    const res = await this.request<LoginResponse>('/api/auth/login', 'POST', {
      identifier: cleanMobile,
      dob: cleanDob,
      password: cleanDob,
      loginType: 'PARENT',
      rememberMe,
    });

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        error: res.data?.error || res.error || 'Parent authentication failed. Please check mobile and child DOB.',
      };
    }

    if (res.data.token && res.data.user) {
      await authStorage.setSession(res.data.token, res.data.user, rememberMe);
      if (res.data.user.activeStudentId || res.data.user.studentId) {
        authStorage.setActiveStudentId(res.data.user.activeStudentId || res.data.user.studentId!);
      }
    }

    return res.data;
  }

  /**
   * Parent Multi-Child Switcher
   */
  public async switchChild(childStudentId: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const res = await this.request<{ success: boolean; user: User }>('/api/auth/switch-child', 'POST', {
      studentId: childStudentId,
    });

    if (res.ok && res.data?.success && res.data.user) {
      authStorage.updateUser(res.data.user);
      authStorage.setActiveStudentId(childStudentId);
      return { success: true, user: res.data.user };
    }

    return { success: false, error: res.error || 'Failed to switch child.' };
  }

  /**
   * Session verification
   */
  public async verifyCurrentSession(): Promise<{ valid: boolean; user?: User }> {
    const token = authStorage.getToken();
    if (!token) return { valid: false };

    const res = await this.request<{ success: boolean; user: User }>('/api/auth/me', 'GET');
    if (res.ok && res.data?.success && res.data.user) {
      authStorage.updateUser(res.data.user);
      return { valid: true, user: res.data.user };
    }

    // Only an explicit "not authorised" answer ends the session. A slow connection, no internet or a
    // sleeping server must not sign the user out - keep the saved sign-in and try again later.
    if (res.status === 401 || res.status === 403) {
      await authStorage.clearSession();
      return { valid: false };
    }
    const saved = authStorage.getUser();
    return saved ? { valid: true, user: saved } : { valid: false };
  }

  /**
   * Logout flow
   */
  public async logout(): Promise<void> {
    const token = authStorage.getToken();
    try {
      if (token) {
        await this.request('/api/auth/logout', 'POST', {}, { timeoutMs: 3000, retries: 0 });
      }
    } catch {}
    this.assignmentsCache.clear();
    this.clearCache();
    await authStorage.clearSession();
  }

  // ==========================================
  // AUTHORIZED DATA SERVICES (Read-Only in Phase 1)
  // ==========================================

  public async getStudents(limit = 20): Promise<{ ok: boolean; data: Student[]; error?: string; status: number }> {
    const res = await this.request<any>(`/api/students?limit=${limit}`);
    let list: Student[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data.students)) {
        list = res.data.students;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  /** One page of students, filtered on the server (class, section, status, session, search). */
  public async getStudentsPage(params: {
    classId?: string;
    section?: string;
    status?: string;
    academicSession?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ ok: boolean; status: number; data: Student[]; total: number; totalPages: number; error?: string }> {
    const q = new URLSearchParams();
    (['classId', 'section', 'status', 'academicSession', 'search'] as const).forEach((k) => {
      const v = params[k];
      if (v) q.set(k, String(v));
    });
    q.set('page', String(params.page || 1));
    q.set('limit', String(params.limit || 50));
    const res = await this.request<any>(`/api/students?${q.toString()}`);
    const list: Student[] = res.ok ? this.listFrom(res.data, ['data', 'students']) : [];
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      total: Number(res.data?.pagination?.total ?? list.length) || 0,
      totalPages: Number(res.data?.pagination?.totalPages ?? 1) || 1,
      error: res.error,
    };
  }

  /** Every student matching the filters (pages are fetched until complete, capped for safety). */
  public async getAllStudents(params: {
    classId?: string;
    section?: string;
    status?: string;
    academicSession?: string;
  }): Promise<{ ok: boolean; status: number; data: Student[]; error?: string }> {
    const out: Student[] = [];
    for (let page = 1; page <= 30; page++) {
      const r = await this.getStudentsPage({ ...params, page, limit: 100 });
      if (!r.ok) return { ok: false, status: r.status, data: out, error: r.error };
      out.push(...r.data);
      if (page >= r.totalPages) break;
    }
    return { ok: true, status: 200, data: out };
  }

  public async getStaffList(limit = 20): Promise<{ ok: boolean; data: Staff[]; error?: string; status: number }> {
    const res = await this.request<any>(`/api/staff?limit=${limit}`);
    let list: Staff[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data.staff)) {
        list = res.data.staff;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getSchoolSettings(): Promise<{ ok: boolean; data: SchoolSettings | null; error?: string; status: number }> {
    const res = await this.request<SchoolSettings>('/api/school-settings');
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok && res.data?.schoolName ? res.data : null,
      error: res.error,
    };
  }

  public async getNotices(): Promise<{ ok: boolean; data: any[]; error?: string; status: number }> {
    const res = await this.request<any>('/api/notices?limit=10');
    let list: any[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data.notices)) {
        list = res.data.notices;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getEvents(): Promise<{ ok: boolean; data: any[]; error?: string; status: number }> {
    const res = await this.request<any>('/api/public/events');
    let list: any[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.events)) {
        list = res.data.events;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  // --- Homework (server enforces role, class/section/subject scope and ownership) ---
  public async getHomework(): Promise<{ ok: boolean; data: any[]; error?: string; status: number }> {
    const res = await this.request<any>('/api/homework', 'GET', undefined, { skipCache: true });
    const list = res.ok && Array.isArray(res.data) ? res.data : res.ok && Array.isArray(res.data?.data) ? res.data.data : [];
    return { ok: res.ok, status: res.status, data: list, error: res.data?.error || res.error };
  }

  public async getHomeworkOptions(): Promise<{ ok: boolean; classes: any[]; error?: string }> {
    const res = await this.request<any>('/api/homework/options', 'GET', undefined, { skipCache: true });
    return {
      ok: res.ok,
      classes: res.ok && Array.isArray(res.data?.classes) ? res.data.classes : [],
      error: res.data?.error || res.error,
    };
  }

  public async saveHomework(
    payload: Record<string, any>,
    id?: string
  ): Promise<{ ok: boolean; success: boolean; data?: any; error?: string }> {
    const res = await this.request<any>(id ? `/api/homework/${encodeURIComponent(id)}` : '/api/homework', id ? 'PUT' : 'POST', payload);
    return { ok: res.ok, success: res.ok && res.data?.success !== false, data: res.data, error: res.data?.error || res.error };
  }

  public async deleteHomework(id: string): Promise<{ ok: boolean; success: boolean; error?: string }> {
    const res = await this.request<any>(`/api/homework/${encodeURIComponent(id)}`, 'DELETE');
    return { ok: res.ok, success: res.ok && res.data?.success !== false, error: res.data?.error || res.error };
  }

  public async getAssignments(classId?: string): Promise<{ ok: boolean; data: any[]; error?: string; status: number }> {
    const q = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    const res = await this.request<any>(`/api/homework${q}`);
    let list: any[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getStudyMaterials(category?: string, className?: string): Promise<{ ok: boolean; data: any[]; error?: string; status: number }> {
    const params: string[] = [];
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (className) params.push(`className=${encodeURIComponent(className)}`);
    const q = params.length > 0 ? `?${params.join('&')}` : '';
    const res = await this.request<any>(`/api/study-materials${q}`);
    let list: any[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  // ---- Notices & SMS (staff) -------------------------------------------------
  // The server decides visibility and permissions; these calls return its answer and its error text.

  /** All notices this staff member may see (drafts included for their authors and admins). */
  public async getStaffNotices(o: { fresh?: boolean } = {}): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/notices', 'GET', undefined, { cacheTtlMs: 30000, skipCache: o.fresh });
    const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.notices) ? res.data.notices : [];
    return { ok: res.ok, status: res.status, data: res.ok ? list : [], error: res.ok ? undefined : res.data?.error || res.error || 'Notices could not be loaded.' };
  }

  public async saveNotice(input: Record<string, any>, id?: string): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
    const res = await this.request<any>(id ? `/api/notices/${encodeURIComponent(id)}` : '/api/notices', id ? 'PUT' : 'POST', input);
    if (res.ok) this.clearCache();
    return { ok: res.ok, status: res.status, data: res.ok ? res.data : undefined, error: res.ok ? undefined : res.data?.error || res.error || 'The notice could not be saved.' };
  }

  public async deleteNotice(id: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>(`/api/notices/${encodeURIComponent(id)}`, 'DELETE');
    if (res.ok) this.clearCache();
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : res.data?.error || res.error || 'The notice could not be deleted.' };
  }

  public async getSmsStats(): Promise<{ ok: boolean; status: number; data?: { todaySent: number | null; todayFailed: number | null; totalSent: number | null; configured: boolean }; error?: string }> {
    const res = await this.request<any>('/api/sms/stats');
    if (!res.ok) return { ok: false, status: res.status, error: res.data?.error || res.error || 'SMS figures could not be loaded.' };
    const d = res.data || {};
    const known = d.countsAvailable !== false;
    return { ok: true, status: res.status, data: { todaySent: known ? Number(d.todaySent) || 0 : null, todayFailed: known ? Number(d.todayFailed) || 0 : null, totalSent: known ? Number(d.totalSent) || 0 : null, configured: d.configured === true } };
  }

  public async getSmsHistory(page = 1, limit = 20): Promise<{ ok: boolean; status: number; data: any[]; total: number; totalPages: number; error?: string }> {
    const res = await this.request<any>(`/api/sms/history?page=${page}&limit=${limit}`);
    if (!res.ok) return { ok: false, status: res.status, data: [], total: 0, totalPages: 0, error: res.data?.error || res.error || 'SMS history could not be loaded.' };
    return { ok: true, status: res.status, data: Array.isArray(res.data?.logs) ? res.data.logs : [], total: Number(res.data?.total) || 0, totalPages: Number(res.data?.totalPages) || 1 };
  }

  public async getClasses(): Promise<{ ok: boolean; data: ClassItem[]; error?: string; status: number }> {
    const res = await this.request<any>('/api/classes');
    let list: ClassItem[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data.classes)) {
        list = res.data.classes;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getSubjects(): Promise<{ ok: boolean; data: SubjectItem[]; error?: string; status: number }> {
    const res = await this.request<any>('/api/subjects');
    let list: SubjectItem[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getTimetables(params: {
    classId?: string;
    section?: string;
    teacherId?: string;
    academicSession?: string;
  } = {}): Promise<{ ok: boolean; data: TimetableSlot[]; error?: string; status: number }> {
    const query = new URLSearchParams();
    if (params.classId) query.set('classId', params.classId);
    if (params.section) query.set('section', params.section);
    if (params.teacherId) query.set('teacherId', params.teacherId);
    if (params.academicSession) query.set('academicSession', params.academicSession);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/timetables?${queryString}` : '/api/timetables';
    const res = await this.request<any>(endpoint);
    let list: TimetableSlot[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getAttendance(params: {
    classId?: string;
    section?: string;
    date?: string;
    studentId?: string;
  } = {}): Promise<{ ok: boolean; data: AttendanceRecord[]; error?: string; status: number }> {
    const query = new URLSearchParams();
    if (params.classId) query.set('classId', params.classId);
    if (params.section) query.set('section', params.section);
    if (params.date) query.set('date', params.date);
    if (params.studentId) query.set('studentId', params.studentId);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/attendance?${queryString}` : '/api/attendance';
    const res = await this.request<any>(endpoint);
    let list: AttendanceRecord[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data.attendance)) {
        list = res.data.attendance;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async saveAttendance(payload: {
    records: Array<{ studentId: string; status: string; remarks?: string }>;
    date: string;
    classId?: string;
    section?: string;
  }): Promise<{ ok: boolean; success: boolean; error?: string }> {
    const res = await this.request<any>('/api/attendance', 'POST', payload);
    return {
      ok: res.ok,
      success: res.ok && (res.data?.success !== false),
      error: res.data?.error || res.error,
    };
  }

  public async getStaffAttendance(params: {
    date?: string;
    staffId?: string;
  } = {}): Promise<{ ok: boolean; data: StaffAttendanceRecord[]; error?: string; status: number }> {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.staffId) query.set('staffId', params.staffId);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/staff-attendance?${queryString}` : '/api/staff-attendance';
    const res = await this.request<any>(endpoint);
    let list: StaffAttendanceRecord[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async saveStaffAttendance(payload: {
    date: string;
    records: Array<{
      staffId: string;
      staffName?: string;
      employeeId?: string;
      status: string;
      remarks?: string;
    }>;
  }): Promise<{ ok: boolean; success: boolean; error?: string }> {
    const res = await this.request<any>('/api/staff-attendance', 'POST', payload);
    return {
      ok: res.ok,
      success: res.ok && (res.data?.success !== false),
      error: res.data?.error || res.error,
    };
  }

  public async getExams(params?: {
    academicSession?: string;
    status?: string;
    classId?: string;
  }): Promise<{ ok: boolean; data: Exam[]; error?: string; status: number }> {
    const query = new URLSearchParams();
    if (params?.academicSession) query.set('academicSession', params.academicSession);
    if (params?.status) query.set('status', params.status);
    if (params?.classId) query.set('classId', params.classId);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/exams?${queryString}` : '/api/exams';
    const res = await this.request<any>(endpoint, 'GET', undefined, { cacheTtlMs: 30000 });
    let list: Exam[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data.exams)) {
        list = res.data.exams;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async getMarks(params: {
    examId?: string;
    classId?: string;
    section?: string;
    subjectId?: string;
    studentId?: string;
    academicSession?: string;
  }): Promise<{ ok: boolean; data: ExamMark[]; error?: string; status: number }> {
    const query = new URLSearchParams();
    if (params.examId) query.set('examId', params.examId);
    if (params.classId) query.set('classId', params.classId);
    if (params.section) query.set('section', params.section);
    if (params.subjectId) query.set('subjectId', params.subjectId);
    if (params.studentId) query.set('studentId', params.studentId);
    if (params.academicSession) query.set('academicSession', params.academicSession);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/marks?${queryString}` : '/api/marks';
    const res = await this.request<any>(endpoint);
    let list: ExamMark[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data.data)) {
        list = res.data.data;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data: list,
      error: res.error,
    };
  }

  public async saveMarks(payload: {
    marksList: Array<{
      studentId: string;
      marksObtained: number;
      maxMarks?: number;
      isAbsent?: boolean;
      remarks?: string;
    }>;
    examId: string;
    classId: string;
    section?: string;
    subjectId: string;
    academicSession?: string;
    submissionStatus?: 'DRAFT' | 'SUBMITTED';
  }): Promise<{ ok: boolean; success: boolean; count?: number; error?: string }> {
    const res = await this.request<any>('/api/marks', 'POST', payload);
    return {
      ok: res.ok,

      success: res.ok && (res.data?.success !== false),
      count: res.data?.count,
      error: res.data?.error || res.error,
    };
  }

  /**
   * Payroll of the signed-in staff member. Identity is resolved by the server from the
   * session, so no employee id is sent from the UI.
   */
  public async getMyPayroll(): Promise<{
    ok: boolean;
    data: any[];
    error?: string;
    status: number;
  }> {
    const res = await this.request<any>('/api/staff-payroll/my-salary');
    let list: any[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) list = res.data;
      else if (Array.isArray(res.data.records)) list = res.data.records;
      else if (Array.isArray(res.data.data)) list = res.data.data;
    }
    return { ok: res.ok, status: res.status, data: list, error: res.error };
  }

  /** Short-lived link to the server-generated payslip PDF (PAID salary records only). */
  public async getPayslipDownloadUrl(recordId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
    const res = await this.request<any>(`/api/staff-payroll/${encodeURIComponent(recordId)}/payslip-link`, 'POST', {});
    if (!res.ok || !res.data?.url) return { ok: false, error: res.data?.error || res.error || 'Could not prepare the payslip.' };
    return { ok: true, url: `${this.getBaseUrl()}${res.data.url}` };
  }

  /** Short-lived link to the blank, printable A4 form (the phone's browser downloads it). */
  public async getBlankFormUrl(kind: 'student' | 'staff'): Promise<{ ok: boolean; url?: string; error?: string }> {
    const res = await this.request<any>(`/api/forms/${kind}/link`, 'POST', {});
    if (!res.ok || !res.data?.url) return { ok: false, error: res.data?.error || res.error || 'Could not prepare the form.' };
    return { ok: true, url: `${this.getBaseUrl()}${res.data.url}` };
  }

  public async getStaffIdCard(staffId: string): Promise<{
    ok: boolean;
    staff?: Staff;
    settings?: any;
    qrToken?: string;
    error?: string;
    status: number;
  }> {
    const res = await this.request<any>(`/api/staff/${encodeURIComponent(staffId)}/id-card`);
    return {
      ok: res.ok && res.data?.success !== false,
      status: res.status,
      staff: res.data?.staff,
      settings: res.data?.settings,
      qrToken: typeof res.data?.qrToken === 'string' ? res.data.qrToken : undefined,
      error: res.data?.error || res.error,
    };
  }

  public async getDashboardSummary(): Promise<{ ok: boolean; data: any; error?: string }> {
    const res = await this.request<any>('/api/dashboard/summary');
    return {
      ok: res.ok,
      data: res.ok ? res.data : null,
      error: res.error,
    };
  }

  /**
   * Teacher Portal: live dashboard summary for the authenticated teacher.
   * Endpoint is scoped server-side to the caller's own teacher record.
   * The backend returns the summary object directly (no { success, data } wrapper).
   */
  public async getTeacherDashboardSummary(options: { skipCache?: boolean } = {}): Promise<{
    ok: boolean;
    status: number;
    data: TeacherDashboardSummary | null;
    error?: string;
  }> {
    const res = await this.request<TeacherDashboardSummary>('/api/teacher/dashboard-summary', 'GET', undefined, {
      cacheTtlMs: 30000,
      skipCache: options.skipCache,
    });
    return {
      ok: res.ok && !!res.data && typeof res.data === 'object',
      status: res.status,
      data: res.ok ? (res.data as TeacherDashboardSummary) : null,
      error: res.error,
    };
  }

  /**
   * Teacher-scoped weekly timetable (GET /api/teacher/timetable).
   * Returns only the authenticated teacher's own slots.
   */
  public async getTeacherTimetable(options: { skipCache?: boolean } = {}): Promise<{ ok: boolean; status: number; data: TimetableSlot[]; error?: string }> {
    const res = await this.request<any>('/api/teacher/timetable', 'GET', undefined, {
      cacheTtlMs: 30000,
      skipCache: options.skipCache,
    });
    const raw: any[] = res.ok && res.data && Array.isArray(res.data.weeklySlots) ? res.data.weeklySlots : [];
    const list: TimetableSlot[] = raw.map((s) => ({ ...s, dayOfWeek: s.dayOfWeek || s.day || '' }));
    return { ok: res.ok, status: res.status, data: res.ok ? list : [], error: res.error };
  }

  /** Classes/sections where the signed-in teacher is Class Incharge (the only ones they may mark attendance for). */
  public async getInchargeClasses(): Promise<{ ok: boolean; status: number; classes: { classId: string; className: string; sections: string[] }[]; error?: string }> {
    const res = await this.request<any>('/api/attendance/assigned-classes?scope=incharge', 'GET', undefined, { cacheTtlMs: 15000 });
    const classes = res.ok && res.data && Array.isArray(res.data.classes) ? res.data.classes : [];
    return { ok: res.ok, status: res.status, classes, error: res.error };
  }

  /**
   * Students of one class section (GET /api/students?classId&section).
   * The server returns 403 for any section the teacher is not assigned to.
   */
  public async getStudentsForSection(
    classId: string,
    section: string
  ): Promise<{ ok: boolean; status: number; data: Student[]; error?: string }> {
    const q = new URLSearchParams({ classId, section, limit: '500' });
    const res = await this.request<any>(`/api/students?${q.toString()}`, 'GET', undefined, {
      cacheTtlMs: 30000,
    });
    let list: Student[] = [];
    if (res.ok && res.data) {
      if (Array.isArray(res.data)) list = res.data;
      else if (Array.isArray(res.data.data)) list = res.data.data;
      else if (Array.isArray(res.data.students)) list = res.data.students;
    }
    return { ok: res.ok, status: res.status, data: list, error: res.error };
  }

  /**
   * `force` bypasses the short cache (pull-to-refresh). `fromCache` tells the caller when
   * the data came from the last 60 seconds rather than a fresh request.
   */
  public async getTeacherAuthorizedAssignments(options: { force?: boolean } = {}): Promise<{
    ok: boolean;
    status: number;
    data: TeacherAuthorizedAssignments | null;
    error?: string;
    fromCache?: boolean;
  }> {
    const key = authStorage.getToken() || 'anonymous';
    const { value, fromCache } = await this.assignmentsCache.get(
      key,
      async () => {
        const res = await this.request<TeacherAuthorizedAssignments>('/api/teacher/authorized-assignments');
        return {
          ok: res.ok && !!res.data && typeof res.data === 'object',
          status: res.status,
          data: res.ok ? (res.data as TeacherAuthorizedAssignments) : null,
          error: res.error,
        };
      },
      !!options.force
    );
    return { ...value, fromCache };
  }

  // ==========================================
  // PARENT PORTAL (all child-specific calls are scoped by the server to the
  // parent's linked children; a foreign student id returns 403)
  // ==========================================

  private listFrom(data: any, keys: string[] = ['data', 'records', 'ledgers', 'payments', 'events', 'notices', 'sessions']): any[] {
    if (Array.isArray(data)) return data;
    for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
    return [];
  }

  public async getParentChildren(): Promise<{ ok: boolean; status: number; data: Student[]; error?: string }> {
    const res = await this.request<any>('/api/students?limit=200', 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  public async getChildAttendance(studentId: string, o: { fresh?: boolean } = {}): Promise<{ ok: boolean; status: number; data: AttendanceRecord[]; error?: string }> {
    const res = await this.request<any>(`/api/attendance?studentId=${encodeURIComponent(studentId)}`, 'GET', undefined, { cacheTtlMs: 30000, skipCache: o.fresh });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  public async getChildFeeLedgers(studentId: string, o: { fresh?: boolean } = {}): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>(`/api/fee-ledgers/student/${encodeURIComponent(studentId)}`, 'GET', undefined, { cacheTtlMs: 30000, skipCache: o.fresh });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  public async getChildPayments(studentId: string, o: { fresh?: boolean } = {}): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>(`/api/fees/payments?studentId=${encodeURIComponent(studentId)}`, 'GET', undefined, { cacheTtlMs: 30000, skipCache: o.fresh });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  public async getChildIdCard(studentId: string): Promise<{ ok: boolean; status: number; student?: Student; settings?: any; qrToken?: string; error?: string }> {
    const res = await this.request<any>(`/api/students/${encodeURIComponent(studentId)}/id-card`);
    return {
      ok: res.ok && res.data?.success !== false,
      status: res.status,
      student: res.data?.student,
      settings: res.data?.schoolSettings || res.data?.settings,
      qrToken: typeof res.data?.qrToken === 'string' ? res.data.qrToken : undefined,
      error: res.data?.error || res.error,
    };
  }

  /**
   * Mark today's attendance from a scanned ID card QR. The server checks the
   * signature, the scanner's role and class, holidays and duplicates; this only
   * passes its answer on. Safe to retry: a second scan the same day changes nothing.
   */
  public async scanAttendance(input: {
    code: string;
    expect?: 'STUDENT' | 'STAFF';
    status?: 'PRESENT' | 'LATE';
    override?: boolean;
  }): Promise<AttendanceScanResult> {
    const res = await this.request<any>('/api/attendance/scan', 'POST', input);
    const d = res.data || {};
    if (res.ok && d.success) {
      // Attendance lists cached before this scan are now out of date.
      this.clearCache('attendance');
    }
    return {
      ok: res.ok && d.success === true,
      status: res.status,
      code: d.code,
      error: res.ok ? undefined : d.error || res.error || 'Attendance could not be marked. Please try again.',
      kind: d.kind,
      person: d.person,
      markedStatus: d.status,
      date: d.date,
      time: d.time || d.checkInTime,
      alreadyMarked: d.alreadyMarked === true,
      corrected: d.corrected === true,
      previousStatus: d.previousStatus,
    };
  }

  public async getParentNotices(o: { fresh?: boolean } = {}): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/parent/notices', 'GET', undefined, { cacheTtlMs: 60000, skipCache: o.fresh });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  /** The signed-in student's own notices (the server filters by class, section and audience). */
  public async getMyNotices(o: { fresh?: boolean } = {}): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/notices', 'GET', undefined, { cacheTtlMs: 60000, skipCache: o.fresh });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'notices']) : [], error: res.error };
  }

  /** The school's website hero photo (public), used as the sign-in background. */
  public async getLoginHeroImage(): Promise<string | null> {
    const res = await this.request<any>('/api/public/hero-slides', 'GET', undefined, { timeoutMs: 8000, retries: 0, cacheTtlMs: 600000 });
    const list = res.ok ? this.listFrom(res.data) : [];
    const first = list.find((s: any) => s && s.isActive !== false && (s.mobileImage || s.imageUrl || s.desktopImage));
    const url = first ? String(first.mobileImage || first.imageUrl || first.desktopImage || '') : '';
    return /^https?:\/\//.test(url) ? url : null;
  }

  /** Staff attendance calendar data. The server allows only the staff member themself or an admin-tier role. */
  public async getStaffCalendar(staffId: string): Promise<{ ok: boolean; status: number; records: any[]; leaves: any[]; holidays: any[]; error?: string }> {
    const res = await this.request<any>(`/api/attendance/staff-calendar/${encodeURIComponent(staffId)}`, 'GET', undefined, { cacheTtlMs: 15000 });
    return {
      ok: res.ok,
      status: res.status,
      records: res.ok && Array.isArray(res.data?.records) ? res.data.records : [],
      leaves: res.ok && Array.isArray(res.data?.leaves) ? res.data.leaves : [],
      holidays: res.ok && Array.isArray(res.data?.holidays) ? res.data.holidays : [],
      error: res.error,
    };
  }

  /** Student attendance calendar data (own record, linked child, or an authorised staff member). */
  public async getStudentCalendar(studentId: string): Promise<{ ok: boolean; status: number; records: any[]; leaves: any[]; holidays: any[]; error?: string }> {
    const res = await this.request<any>(`/api/attendance/student-calendar/${encodeURIComponent(studentId)}`, 'GET', undefined, { cacheTtlMs: 15000 });
    return {
      ok: res.ok,
      status: res.status,
      records: res.ok && Array.isArray(res.data?.records) ? res.data.records : [],
      leaves: res.ok && Array.isArray(res.data?.leaves) ? res.data.leaves : [],
      holidays: res.ok && Array.isArray(res.data?.holidays) ? res.data.holidays : [],
      error: res.error,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin: student / staff management (every call is authorised by the server)
  // ---------------------------------------------------------------------------

  public async getStudentById(id: string): Promise<{ ok: boolean; status: number; data?: Student; error?: string }> {
    const res = await this.request<any>(`/api/students/${encodeURIComponent(id)}`, 'GET', undefined, { skipCache: true });
    const rec = res.data?.data && !Array.isArray(res.data.data) ? res.data.data : res.data;
    return { ok: res.ok, status: res.status, data: res.ok ? rec : undefined, error: res.error };
  }

  public async setStudentStatus(id: string, status: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>(`/api/students/${encodeURIComponent(id)}/status`, 'PATCH', { status });
    this.clearCache('/api/students');
    this.clearCache('/api/dashboard');
    return { ok: res.ok, status: res.status, error: res.data?.error || res.error };
  }

  /** Full staff directory (the server shortens it to a directory view for roles without HR access). */
  public async getStaffDirectory(): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/staff', 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'staff']) : [], error: res.error };
  }

  public async getStaffById(id: string): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
    const res = await this.request<any>(`/api/staff/${encodeURIComponent(id)}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? res.data : undefined, error: res.data?.error || res.error };
  }

  /** Activate / deactivate: the server also disables the staff member's login and ends their sessions. */
  public async setStaffStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>(`/api/staff/${encodeURIComponent(id)}`, 'PUT', { status });
    this.clearCache('/api/staff');
    this.clearCache('/api/dashboard');
    return { ok: res.ok, status: res.status, error: res.data?.error || res.error };
  }

  public async getStaffLeaves(): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/staff-leaves', 'GET', undefined, { cacheTtlMs: 15000 });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'leaves']) : [], error: res.error };
  }

  /** Payroll history of one staff member; the server limits it to the person themself or payroll roles. */
  public async getStaffPayrollHistory(staffId: string): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>(`/api/staff-payroll/history/${encodeURIComponent(staffId)}`, 'GET', undefined, { cacheTtlMs: 15000 });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'records', 'history']) : [], error: res.data?.error || res.error };
  }

  public async getHolidays(): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/holidays', 'GET', undefined, { cacheTtlMs: 300000 });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  public async getAcademicSessions(): Promise<{ ok: boolean; status: number; data: Array<{ id?: string; name: string; status?: string }>; error?: string }> {
    const res = await this.request<any>('/api/academic-sessions', 'GET', undefined, { cacheTtlMs: 300000 });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  /**
   * Institutional reports (same endpoint and access rules as the website).
   * The server checks the role, validates the filters and withholds fee / salary data as needed.
   */
  public async getOfficialReports(f: { academicSession?: string; dateFrom?: string; dateTo?: string; classId?: string; section?: string }): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
    const q = Object.entries(f)
      .filter(([, v]) => v)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const res = await this.request<any>(`/api/analytics/official-reports${q ? `?${q}` : ''}`, 'GET', undefined, { timeoutMs: 45000, skipCache: true });
    const error = res.ok ? undefined : res.status === 403 ? 'You do not have access to reports.' : res.data?.error || res.error || 'The report could not be loaded.';
    return { ok: res.ok && !!res.data?.success, status: res.status, data: res.ok ? res.data : null, error };
  }

  /** Exams with published results for one class and session. */
  public async getPublishedExams(classId: string, academicSession?: string): Promise<{ ok: boolean; status: number; data: Exam[]; error?: string }> {
    const q = new URLSearchParams({ classId, resultsStatus: 'PUBLISHED' });
    if (academicSession) q.set('academicSession', academicSession);
    const res = await this.request<any>(`/api/exams?${q.toString()}`);
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'exams']) : [], error: res.error };
  }

  public async getChildMarks(studentId: string, examId: string): Promise<{ ok: boolean; status: number; data: ExamMark[]; error?: string }> {
    const q = new URLSearchParams({ studentId, examId });
    const res = await this.request<any>(`/api/marks?${q.toString()}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'marks']) : [], error: res.error };
  }

  // ---------------------------------------------------------------------------
  // Online fee payment (PhonePe Standard Checkout)
  // The app never decides "paid": it opens PhonePe's PayPage in the phone browser and then asks the school
  // server, which asks PhonePe's Order Status API itself.
  // ---------------------------------------------------------------------------

  public async getOnlinePaymentConfig(): Promise<{ ok: boolean; enabled: boolean; schoolName?: string }> {
    const res = await this.request<any>('/api/payments/phonepe/config', 'GET', undefined, { cacheTtlMs: 60_000 });
    if (!res.ok) return { ok: false, enabled: false };
    return { ok: true, enabled: !!res.data?.enabled, schoolName: res.data?.schoolName };
  }

  private async createOnlineOrder(body: Record<string, unknown>, fallbackError: string): Promise<{
    ok: boolean; orderId?: string; amountPaise?: number; amount?: number; billCount?: number; feeMonth?: string;
    checkoutUrl?: string; pendingOrderId?: string; error?: string;
  }> {
    const res = await this.request<any>('/api/payments/phonepe/create-order', 'POST', { ...body, channel: 'app' });
    if (!res.ok || !res.data?.success || !res.data?.checkoutUrl) {
      return { ok: false, pendingOrderId: res.data?.pendingOrderId, error: res.data?.error || res.error || fallbackError };
    }
    return { ok: true, ...res.data };
  }

  /** One bill. The server works out the amount from its own ledger. */
  public createBillPaymentOrder(ledgerId: string, studentId: string) {
    return this.createOnlineOrder({ ledgerId, studentId }, 'Could not start the payment.');
  }

  /** Everything this child still owes. The server adds up the bills itself; no amount is sent. */
  public createFullPaymentOrder(studentId: string) {
    return this.createOnlineOrder({ studentId, payAll: true }, 'Could not start the payment.');
  }

  /** The SERVER's verdict on an online payment (it re-checks with PhonePe). Only paymentStatus === 'SUCCESS' means paid. */
  public async getOnlinePaymentStatus(orderId: string): Promise<{ ok: boolean; paymentStatus?: string; receiptNumber?: string | null; message?: string; error?: string }> {
    const res = await this.request<any>(`/api/payments/phonepe/orders/${encodeURIComponent(orderId)}`, 'GET', undefined, { skipCache: true });
    if (!res.ok || !res.data) return { ok: false, error: res.data?.error || res.error || 'Could not check the payment.' };
    return { ok: true, paymentStatus: res.data.paymentStatus, receiptNumber: res.data.receiptNumber, message: res.data.message };
  }

  /** This child's unfinished online payments (e.g. the app was closed while paying). */
  public async getOpenOnlinePayments(studentId: string): Promise<{ ok: boolean; open: Array<{ orderId: string; paymentStatus: string; amount: number; message?: string }> }> {
    const res = await this.request<any>(`/api/payments/phonepe/orders?studentId=${encodeURIComponent(studentId)}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, open: res.ok && Array.isArray(res.data?.open) ? res.data.open : [] };
  }

  /** Short-lived link to the server-made receipt PDF (the phone's browser downloads it). */
  public async getReceiptDownloadUrl(receiptNumber: string): Promise<{ ok: boolean; url?: string; error?: string }> {
    const res = await this.request<any>(`/api/fees/receipts/${encodeURIComponent(receiptNumber)}/link`, 'POST', {});
    if (!res.ok || !res.data?.url) return { ok: false, error: res.data?.error || res.error || 'Could not prepare the receipt.' };
    return { ok: true, url: `${this.getBaseUrl()}${res.data.url}` };
  }

  // ---------------------------------------------------------------------------
  // Leave (staff + students), parent chat, fee dues, events
  // ---------------------------------------------------------------------------

  /** Admission enquiries and quick call requests from the public website (office roles only). */
  public async getEnquiries(opts?: { fresh?: boolean }): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>('/api/enquiries', 'GET', undefined, { cacheTtlMs: opts?.fresh ? 0 : 15000 });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data, ['data', 'enquiries']) : [], error: res.error };
  }

  public async updateEnquiry(id: string, patch: { status?: string; notes?: string; followUpDate?: string }): Promise<{ ok: boolean; status: number; enquiry?: any; error?: string }> {
    const res = await this.request<any>(`/api/enquiries/${encodeURIComponent(id)}`, 'PUT', patch);
    this.clearCache('enquir');
    return { ok: res.ok, status: res.status, enquiry: res.ok ? res.data : undefined, error: res.error };
  }

  /** Apply for (or, as an approver, record) staff leave. status 'APPROVED' only works for approvers. */
  public async applyStaffLeave(input: { staffId?: string; employeeId?: string; leaveType: string; startDate: string; endDate: string; reason: string; status?: 'APPROVED' }): Promise<{ ok: boolean; status: number; leave?: any; error?: string }> {
    const res = await this.request<any>('/api/staff-leaves', 'POST', input);
    this.clearCache('leave');
    this.clearCache('calendar');
    return { ok: res.ok && res.data?.success !== false, status: res.status, leave: res.data?.leave, error: res.data?.error || res.error };
  }

  public async decideStaffLeave(id: string, status: 'APPROVED' | 'REJECTED', remarks?: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>(`/api/staff-leaves/${encodeURIComponent(id)}/status`, 'PUT', { status, remarks });
    this.clearCache('leave');
    this.clearCache('calendar');
    return { ok: res.ok && res.data?.success !== false, status: res.status, error: res.data?.error || res.error };
  }

  public async getStudentLeaves(params: { studentId?: string; status?: string } = {}): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const q = new URLSearchParams();
    if (params.studentId) q.set('studentId', params.studentId);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    const res = await this.request<any>(`/api/student-leaves${qs ? `?${qs}` : ''}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.error };
  }

  public async applyStudentLeave(input: { studentId: string; leaveType: string; startDate: string; endDate: string; reason: string; status?: 'APPROVED' }): Promise<{ ok: boolean; status: number; leave?: any; error?: string }> {
    const res = await this.request<any>('/api/student-leaves', 'POST', input);
    this.clearCache('calendar');
    this.clearCache('attendance');
    return { ok: res.ok && res.data?.success !== false, status: res.status, leave: res.data?.leave, error: res.data?.error || res.error };
  }

  public async decideStudentLeave(id: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED', remarks?: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>(`/api/student-leaves/${encodeURIComponent(id)}/status`, 'PUT', { status, remarks });
    this.clearCache('calendar');
    this.clearCache('attendance');
    return { ok: res.ok && res.data?.success !== false, status: res.status, error: res.data?.error || res.error };
  }

  public async getChatThreads(): Promise<{ ok: boolean; status: number; data: any[]; unreadTotal: number; error?: string }> {
    const res = await this.request<any>('/api/parent-chat/threads', 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], unreadTotal: Number(res.data?.unreadTotal) || 0, error: res.data?.error || res.error };
  }

  /** Parent: who they can message about one child (teachers, principal, super admin, chairman). */
  public async getChatContacts(studentId: string): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>(`/api/parent-chat/contacts?studentId=${encodeURIComponent(studentId)}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.data?.error || res.error };
  }

  /** Staff: thread id for a chat with the parents of this student (creates nothing until a message is sent). */
  public async startChatWithParent(studentId: string): Promise<{ ok: boolean; status: number; threadId?: string; error?: string }> {
    const res = await this.request<any>(`/api/parent-chat/start?studentId=${encodeURIComponent(studentId)}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok && !!res.data?.threadId, status: res.status, threadId: res.data?.threadId, error: res.data?.error || res.error };
  }

  /** Messages of one thread. Staff also get `parent` (name, mobile, own photo, all their children here). */
  public async getChatMessages(threadId: string): Promise<{ ok: boolean; status: number; data: any[]; student?: any; parentName?: string; parent?: any; staff?: any; error?: string }> {
    const res = await this.request<any>(`/api/parent-chat/threads/${encodeURIComponent(threadId)}/messages`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], student: res.data?.student, parentName: res.data?.parentName, parent: res.data?.parent, staff: res.data?.staff, error: res.data?.error || res.error };
  }

  /** Principal / admins: one emergency message to all parents, chosen classes or chosen students. */
  public async sendEmergencyMessage(input: { scope: 'ALL' | 'CLASS' | 'STUDENTS'; text: string; classIds?: string[]; studentIds?: string[]; alsoStaff?: boolean }): Promise<{ ok: boolean; status: number; sent: number; error?: string }> {
    const res = await this.request<any>('/api/parent-chat/emergency', 'POST', input, { retries: 0, timeoutMs: 60000 });
    return { ok: res.ok && res.data?.success !== false, status: res.status, sent: Number(res.data?.sent) || 0, error: res.data?.error || res.error };
  }

  /**
   * Uploads a picked photo and saves it as the signed-in user's own profile photo.
   * The bytes go through the school server (same route the website falls back to), then the profile is updated.
   */
  public async uploadOwnProfilePhoto(asset: { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null }): Promise<{ ok: boolean; fileKey?: string; error?: string }> {
    const contentType = asset.mimeType || 'image/jpeg';
    let blob: Blob;
    try {
      blob = await (await fetch(asset.uri)).blob();
    } catch {
      return { ok: false, error: 'The photo could not be read. Please pick it again.' };
    }
    if (blob.size > 5 * 1024 * 1024) return { ok: false, error: 'This photo is larger than 5 MB. Please pick a smaller one.' };
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const presign = await this.request<any>('/api/files/presign-upload', 'POST', { fileName: asset.fileName || `profile-photo.${ext}`, contentType, fileSize: blob.size, folder: 'parents/photos' }, { retries: 0 });
    const fileKey = presign.data?.fileKey;
    if (!presign.ok || !fileKey) return { ok: false, error: presign.data?.error || presign.error || 'The upload could not be started.' };
    const token = authStorage.getToken();
    const upUrl =
      presign.data?.uploadUrl && !String(presign.data.uploadUrl).startsWith('http')
        ? `${this.baseUrl}${presign.data.uploadUrl}`
        : `${this.baseUrl}/api/files/stream-upload/${encodeURIComponent(fileKey)}?contentType=${encodeURIComponent(contentType)}`;
    try {
      const put = await fetch(upUrl, { method: 'PUT', headers: { 'Content-Type': contentType, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: blob });
      if (!put.ok) return { ok: false, error: 'The photo could not be uploaded. Please try again.' };
    } catch {
      return { ok: false, error: 'No connection. Please try again.' };
    }
    const saved = await this.request<any>('/api/auth/profile', 'PUT', { avatar: fileKey, photo: fileKey, photoFileKey: fileKey }, { retries: 0 });
    if (!saved.ok || saved.data?.success === false) return { ok: false, error: saved.data?.error || saved.error || 'The photo was uploaded but could not be saved.' };
    authStorage.updateUser({ avatar: fileKey });
    return { ok: true, fileKey };
  }

  public async sendChatMessage(threadId: string, text: string): Promise<{ ok: boolean; status: number; message?: any; error?: string }> {
    const res = await this.request<any>(`/api/parent-chat/threads/${encodeURIComponent(threadId)}/messages`, 'POST', { text }, { retries: 0 });
    return { ok: res.ok && res.data?.success !== false, status: res.status, message: res.data?.message, error: res.data?.error || res.error };
  }

  public async getFeeDuesSummary(): Promise<{ ok: boolean; status: number; data: any[]; totalPending: number; error?: string }> {
    const res = await this.request<any>('/api/fee-dues/summary', 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], totalPending: Number(res.data?.totalPending) || 0, error: res.data?.error || res.error };
  }

  public async sendFeeDueAlerts(studentIds: string[], options: { sendSms?: boolean; note?: string } = {}): Promise<{ ok: boolean; status: number; sent: number; skipped: number; sms?: { requested: boolean; configured: boolean; sent: number; failed: number }; error?: string }> {
    const res = await this.request<any>('/api/fee-dues/notify', 'POST', { studentIds, ...options }, { retries: 0, timeoutMs: 60000 });
    return { ok: res.ok && res.data?.success !== false, status: res.status, sent: Number(res.data?.sent) || 0, skipped: Number(res.data?.skipped) || 0, sms: res.data?.sms, error: res.data?.error || res.error };
  }

  public async getChildFeeDues(studentId: string): Promise<{ ok: boolean; status: number; totalPending: number; overdue: number; items: any[]; lastAlertAt?: string | null; lastAlertText?: string | null; error?: string }> {
    const res = await this.request<any>(`/api/parent/fee-dues?studentId=${encodeURIComponent(studentId)}`, 'GET', undefined, { skipCache: true });
    const d = res.data || {};
    return { ok: res.ok, status: res.status, totalPending: Number(d.totalPending) || 0, overdue: Number(d.overdue) || 0, items: Array.isArray(d.items) ? d.items : [], lastAlertAt: d.lastAlertAt, lastAlertText: d.lastAlertText, error: d.error || res.error };
  }

  /** Signed-in event list with "interested" counts. */
  public async getEventsForMe(all = false): Promise<{ ok: boolean; status: number; data: any[]; error?: string }> {
    const res = await this.request<any>(`/api/events${all ? '?all=1' : ''}`, 'GET', undefined, { skipCache: true });
    return { ok: res.ok, status: res.status, data: res.ok ? this.listFrom(res.data) : [], error: res.data?.error || res.error };
  }

  public async setEventInterest(id: string, interested: boolean): Promise<{ ok: boolean; status: number; event?: any; error?: string }> {
    const res = await this.request<any>(`/api/events/${encodeURIComponent(id)}/interest`, 'POST', { interested }, { retries: 0 });
    return { ok: res.ok && res.data?.success !== false, status: res.status, event: res.data?.event, error: res.data?.error || res.error };
  }

  public async saveEvent(input: Record<string, any>, id?: string): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
    const res = await this.request<any>(id ? `/api/public/events/${encodeURIComponent(id)}` : '/api/public/events', id ? 'PUT' : 'POST', input, { retries: 0 });
    this.clearCache('events');
    return { ok: res.ok, status: res.status, data: res.data, error: res.data?.error || res.error };
  }

  public async deleteEvent(id: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>(`/api/public/events/${encodeURIComponent(id)}`, 'DELETE', undefined, { retries: 0 });
    this.clearCache('events');
    return { ok: res.ok, status: res.status, error: res.data?.error || res.error };
  }

  // ---------------------------------------------------------------------------
  // Passwords
  // ---------------------------------------------------------------------------

  /** Sends a reset link to the account's registered email. The answer is the same whether or not the account exists. */
  public async forgotPassword(identifier: string): Promise<{ ok: boolean; status: number; message?: string; error?: string }> {
    const res = await this.request<any>('/api/auth/forgot-password', 'POST', { identifier: identifier.trim() }, { retries: 0, timeoutMs: 30000 });
    return { ok: res.ok && res.data?.success !== false, status: res.status, message: res.data?.message, error: res.data?.error || res.error };
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const res = await this.request<any>('/api/auth/change-password', 'POST', { currentPassword, newPassword }, { retries: 0 });
    return { ok: res.ok && res.data?.success !== false, status: res.status, error: res.data?.error || res.error };
  }
}

export const apiService = new ApiService();

export interface AttendanceScanResult {
  ok: boolean;
  status: number;
  /** Server error code, e.g. NOT_YOUR_CLASS, CONFIRM_OVERRIDE, HOLIDAY, INVALID_CODE. */
  code?: string;
  error?: string;
  kind?: 'STUDENT' | 'STAFF';
  person?: {
    id: string;
    name: string;
    photo?: string;
    admissionNumber?: string;
    className?: string;
    section?: string;
    rollNumber?: string;
    employeeId?: string;
    designation?: string;
  };
  markedStatus?: string;
  date?: string;
  time?: string;
  alreadyMarked?: boolean;
  corrected?: boolean;
  previousStatus?: string;
}
