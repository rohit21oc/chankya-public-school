import { apiService } from '../services/apiService';
import type { MealKind, NightStatus } from './wardenRules';

/**
 * Hostel warden portal API (server: server/routes/hostelWardenRoutes.ts). Goes through the shared
 * apiService.request, so sign-in, timeouts, retries and session-expiry handling are the app's usual ones.
 * The server decides what this login may see; nothing here filters for security.
 */

export interface WardenHostel {
  id: string;
  name: string;
  type?: string;
  wardenName?: string;
  wardenPhone?: string;
  emergencyPhone?: string;
}

export interface WardenMe {
  role: string;
  hostels: WardenHostel[];
  studentCount: number;
  permissions: { approveLeave: boolean; forwardLeave: boolean; manageMess: boolean; markAttendance: boolean; correctAttendance: boolean };
  today: string;
}

export interface HostelStudent {
  id: string;
  name: string;
  photo?: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  section?: string;
  rollNumber?: string | null;
  hostelId: string;
  hostelName?: string;
  roomNumber?: string;
  floor?: number;
  bedNumber?: string;
  tonightStatus?: NightStatus | null;
}

export interface HostelStudentProfile extends HostelStudent {
  dob?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  guardianName?: string | null;
  parent: { name: string | null; phone: string | null };
  emergency: { name: string | null; relationship: string | null; phone: string | null; secondaryName: string | null; secondaryPhone: string | null };
  allocationDate?: string | null;
  recentNights: Array<{ date: string; status: NightStatus; remarks: string }>;
  leaves: Array<{ id: string; startDate: string; endDate: string; reason: string; status: string; forwardedAt: string | null }>;
}

export interface HostelAlert {
  id: string;
  hostelId: string;
  hostelName?: string;
  type: 'ABSENT_AT_NIGHT' | 'EMERGENCY';
  studentId?: string;
  studentName?: string;
  date?: string;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  createdByName?: string;
  resolvedAt?: string;
  resolvedByName?: string;
  resolution?: string;
}

export interface WardenDashboard {
  date: string;
  hostels: WardenHostel[];
  stats: {
    totalStudents: number;
    present: number;
    absent: number;
    onLeave: number;
    outside: number;
    unmarked: number;
    onApprovedLeave: number;
    emergencyAlerts: number;
    openAlerts: number;
    pendingLeaves: number;
  };
  attendanceTaken: boolean;
  alerts: HostelAlert[];
  activities: Array<{ at: string; kind: string; title: string; detail?: string }>;
}

export interface RollRow extends HostelStudent {
  record: { id: string; status: NightStatus; remarks: string; markedAt: string; markedByName?: string; corrected: boolean } | null;
  suggested: NightStatus | null;
  approvedLeave: { startDate: string; endDate: string } | null;
}

export interface RollSheet {
  date: string;
  rows: RollRow[];
  counts: { total: number; present: number; absent: number; onLeave: number; outside: number; unmarked: number };
  submitted: boolean;
  complete: boolean;
  canCorrect: boolean;
  correctionNote: string | null;
}

export interface NightRecord {
  id: string;
  studentId: string;
  studentName: string;
  roomNumber?: string;
  date: string;
  status: NightStatus;
  remarks?: string;
  markedByName?: string;
  corrected?: boolean;
  history?: Array<{ status: NightStatus; reason?: string; at: string; byName?: string }>;
}

export interface MonthlyReport {
  month: string;
  nightsTaken: number;
  nights: Array<{ date: string; total: number; present: number; absent: number; onLeave: number; outside: number; unmarked: number }>;
  perStudent: Array<{ studentId: string; name: string; roomNumber?: string; nightsTaken: number; present: number; absent: number; onLeave: number; outside: number; unmarked: number }>;
}

export interface MenuBody {
  meals: Array<{ meal: MealKind; time?: string; items: string[] }>;
  notice?: string;
  updatedByName?: string;
  updatedAt?: string;
  date?: string;
  weekday?: number;
}

export interface MessMenu {
  hostelId: string;
  hostelName?: string;
  date: string;
  weekday: number;
  weekdayName: string;
  /** SPECIAL = saved for this date, WEEKLY = the weekday's weekly menu, EARLIER = older data (no weekly menu yet). */
  source: 'SPECIAL' | 'WEEKLY' | 'EARLIER' | null;
  menu: MenuBody | null;
  carriedFrom: string | null;
  hasSpecial: boolean;
  hasWeekly: boolean;
}

export interface WeeklyMenu {
  hostelId: string;
  hostelName?: string;
  days: Array<{ weekday: number; name: string; menu: MenuBody | null }>;
}

export interface WardenLeave {
  id: string;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  roomNumber?: string;
  bedNumber?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  daysCount?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  appliedAt: string;
  appliedByName?: string;
  parentName?: string | null;
  parentPhone?: string | null;
  approvedBy?: string;
  remarks?: string;
  forwardedAt?: string;
  forwardedByName?: string;
  forwardNote?: string;
  onLeaveNow?: boolean;
}

type Res<T> = { ok: boolean; status: number; data?: T; error?: string };

const errOf = (r: { data?: any; error?: string }, fallback: string) => r.data?.error || r.error || fallback;

async function get<T>(path: string, pick: (d: any) => T, fallback: string): Promise<Res<T>> {
  const r = await apiService.request<any>(path, 'GET', undefined, { skipCache: true });
  if (!r.ok || r.data?.success === false) return { ok: false, status: r.status, error: errOf(r, fallback) };
  return { ok: true, status: r.status, data: pick(r.data) };
}

async function send<T>(path: string, method: 'POST' | 'PUT', body: unknown, pick: (d: any) => T, fallback: string): Promise<Res<T>> {
  // No automatic retry for writes: a retried submit must not become a second roll-call.
  const r = await apiService.request<any>(path, method, body, { retries: 0 });
  if (!r.ok || r.data?.success === false) return { ok: false, status: r.status, data: r.data, error: errOf(r, fallback) };
  return { ok: true, status: r.status, data: pick(r.data) };
}

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const out = s.toString();
  return out ? `?${out}` : '';
};

export const wardenApi = {
  me: () => get<WardenMe>('/api/hostel-warden/me', (d) => d as WardenMe, 'Could not load your hostel.'),
  dashboard: () => get<WardenDashboard>('/api/hostel-warden/dashboard', (d) => d as WardenDashboard, 'The dashboard could not be loaded.'),
  students: (p: { search?: string; classId?: string } = {}) =>
    get<{ list: HostelStudent[]; total: number; classes: Array<{ classId: string; className: string }> }>(
      `/api/hostel-warden/students${q(p)}`,
      (d) => ({ list: d.data || [], total: Number(d.total) || 0, classes: d.classes || [] }),
      'Students could not be loaded.'
    ),
  student: (id: string) => get<HostelStudentProfile>(`/api/hostel-warden/students/${encodeURIComponent(id)}`, (d) => d.data, 'This student could not be opened.'),
  rollSheet: (date?: string) => get<RollSheet>(`/api/hostel-warden/attendance${q({ date })}`, (d) => d as RollSheet, 'The attendance sheet could not be loaded.'),
  submitNight: (date: string, entries: Array<{ studentId: string; status: NightStatus; remarks?: string }>) =>
    send<{ saved: number; alertsRaised: number }>('/api/hostel-warden/attendance', 'POST', { date, entries }, (d) => ({ saved: d.saved, alertsRaised: d.alertsRaised }), 'Night attendance could not be saved.'),
  correctNight: (recordId: string, status: NightStatus, reason: string, remarks?: string) =>
    send<NightRecord>(`/api/hostel-warden/attendance/${encodeURIComponent(recordId)}`, 'PUT', { status, reason, remarks }, (d) => d.record, 'The correction could not be saved.'),
  history: (p: { studentId?: string; from?: string; to?: string } = {}) =>
    get<NightRecord[]>(`/api/hostel-warden/attendance/history${q(p)}`, (d) => d.data || [], 'History could not be loaded.'),
  monthly: (month: string) => get<MonthlyReport>(`/api/hostel-warden/attendance/report${q({ type: 'monthly', month })}`, (d) => d as MonthlyReport, 'The report could not be loaded.'),
  alerts: (status: 'OPEN' | 'RESOLVED' | 'ALL' = 'OPEN') => get<HostelAlert[]>(`/api/hostel-warden/alerts${q({ status })}`, (d) => d.data || [], 'Alerts could not be loaded.'),
  raiseEmergency: (message: string, studentId?: string) =>
    send<HostelAlert>('/api/hostel-warden/alerts', 'POST', { message, studentId }, (d) => d.alert, 'The alert could not be sent.'),
  resolveAlert: (id: string, resolution: string) =>
    send<HostelAlert>(`/api/hostel-warden/alerts/${encodeURIComponent(id)}/resolve`, 'PUT', { resolution }, (d) => d.alert, 'Could not save.'),
  mess: (date: string) => get<MessMenu[]>(`/api/hostel-warden/mess${q({ date })}`, (d) => d.data || [], 'The mess menu could not be loaded.'),
  saveMess: (input: { hostelId: string; date: string; meals: Array<{ meal: MealKind; time?: string; items: string[] }>; notice?: string }) =>
    send<any>('/api/hostel-warden/mess', 'PUT', input, (d) => d.menu, 'The menu could not be saved.'),
  weeklyMess: () => get<WeeklyMenu[]>('/api/hostel-warden/mess/weekly', (d) => d.data || [], 'The weekly menu could not be loaded.'),
  saveWeeklyMess: (input: { hostelId: string; weekday: number; meals: Array<{ meal: MealKind; time?: string; items: string[] }>; notice?: string }) =>
    send<any>('/api/hostel-warden/mess/weekly', 'PUT', input, (d) => d.menu, 'The weekly menu could not be saved.'),
  clearWeeklyMess: async (hostelId: string, weekday: number): Promise<Res<true>> => {
    const r = await apiService.request<any>(`/api/hostel-warden/mess/weekly${q({ hostelId, weekday: String(weekday) })}`, 'DELETE', undefined, { retries: 0 });
    if (!r.ok || r.data?.success === false) return { ok: false, status: r.status, error: errOf(r, 'Could not clear.') };
    return { ok: true, status: r.status, data: true };
  },
  deleteMess: async (hostelId: string, date: string): Promise<Res<true>> => {
    const r = await apiService.request<any>(`/api/hostel-warden/mess${q({ hostelId, date })}`, 'DELETE', undefined, { retries: 0 });
    if (!r.ok || r.data?.success === false) return { ok: false, status: r.status, error: errOf(r, 'The menu could not be deleted.') };
    return { ok: true, status: r.status, data: true };
  },
  leaves: (status?: string) =>
    get<{ list: WardenLeave[]; current: WardenLeave[]; canApprove: boolean; pending: number }>(
      `/api/hostel-warden/leaves${q({ status })}`,
      (d) => ({ list: d.data || [], current: d.currentlyOnLeave || [], canApprove: !!d.canApprove, pending: Number(d.pending) || 0 }),
      'Leave requests could not be loaded.'
    ),
  forwardLeave: (id: string, note: string) =>
    send<WardenLeave>(`/api/student-leaves/${encodeURIComponent(id)}/forward`, 'PUT', { note }, (d) => d.leave, 'The leave could not be forwarded.'),
  /** Only used when the server says this login may approve (canApprove). */
  decideLeave: (id: string, status: 'APPROVED' | 'REJECTED', remarks?: string) =>
    send<WardenLeave>(`/api/student-leaves/${encodeURIComponent(id)}/status`, 'PUT', { status, remarks }, (d) => d.leave, 'The decision could not be saved.'),
};
