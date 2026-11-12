import type { Express, Request, Response } from 'express';
import { HostelAlertModel, HostelAttendanceModel, HostelMessMenuModel, HostelWeeklyMenuModel } from '../models/HostelWarden.ts';
import { Store } from '../services/memoryStore.ts';
import { KeyedMutex } from '../services/onlinePayments.ts';
import { indiaToday } from '../services/engagementRules.ts';
import { audience, type PushService } from '../services/pushService.ts';
import {
  WARDEN_ROLE,
  canCorrectNight,
  cleanMessMenu,
  cleanNightEntries,
  countNight,
  isIsoDate,
  isMonth,
  leaveCovers,
  monthlyNightReport,
  NIGHT_STATUSES,
  resolveDayMenu,
  WEEKDAY_NAMES,
  type NightStatus,
} from '../services/hostelWardenRules.ts';

/**
 * Hostel warden portal (mobile app): dashboard, night attendance, alerts, mess menu, the warden's own
 * hostel students and their leave requests.
 *
 * Access (checked here, on the server, for every call):
 *  - HOSTEL_WARDEN: only the hostel(s) assigned to them on their staff record (Hostel assignment) or
 *    hostels that list their mobile number as the warden phone; only students with an ACTIVE bed there.
 *  - Admin tier (Super Admin, School Admin, Principal, Vice Principal): every hostel, read and correct.
 *  - Everybody else: 403.
 *
 * Night attendance is stored apart from school attendance (`hostel_attendance`) and never changes it.
 * Leave requests are the existing parent-submitted student leaves; a warden forwards them to the Principal
 * (PUT /api/student-leaves/:id/forward) because only LEAVE_APPROVAL_ROLES may approve.
 */

type Auth = { user: any; session: any };

export interface HostelWardenDeps {
  getAuthContext: (req: Request) => Auth;
  isStaffAdminTier: (role?: string) => boolean;
  findStaffForUser: (user: any, session: any) => any;
  normalizePhone: (p?: string) => string;
  getStudents: () => any[];
  getHostels: () => any[];
  getHostelAllocations: () => any[];
  /** Rooms, to show the room number for students whose bed is saved only on the student record. */
  getHostelRooms?: () => any[];
  getParentContact: (student: any) => { phone: string; name: string };
  logAudit: (userName: string, role: string, action: string, entity: string, entityId: string, details: string) => void;
  /** Existing parent-submitted student leaves (engagement routes). */
  allStudentLeaves: () => Promise<any[]>;
  leaveApprovalRoles: string[];
  push?: PushService;
}

const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const photoOf = (x: any): string | undefined => x?.photoFileKey || x?.photo || x?.avatar || undefined;
const isActiveStudent = (s: any) => String(s?.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
const sameText = (x?: string, y?: string) => !!x && !!y && String(x).trim().toLowerCase() === String(y).trim().toLowerCase();

/**
 * Roles that see every hostel in the warden portal (and get hostel emergency notifications): the school's
 * leadership only, not every admin-tier role (accounts / HR do not run the hostel).
 */
export const HOSTEL_OVERSIGHT_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

export function registerHostelWardenRoutes(app: Express, d: HostelWardenDeps) {
  const nights = new Store<any>(HostelAttendanceModel, 'date', 'HostelWarden');
  const menus = new Store<any>(HostelMessMenuModel, 'date', 'HostelWarden');
  const weekly = new Store<any>(HostelWeeklyMenuModel, 'weekday', 'HostelWarden');
  const alerts = new Store<any>(HostelAlertModel, 'createdAt', 'HostelWarden');
  const lock = new KeyedMutex();

  const roleOf = (a: Auth) => String(a.session?.role || '').toUpperCase();

  /** Hostel ids this login may see. Admin tier: all. Warden: their assignment. Others: none. */
  const hostelIdsFor = (a: Auth): Set<string> => {
    const role = roleOf(a);
    const all = d.getHostels();
    if (HOSTEL_OVERSIGHT_ROLES.includes(role)) return new Set(all.map((h) => h.id));
    if (role !== WARDEN_ROLE) return new Set();
    const st = d.findStaffForUser(a.user, a.session);
    const ids = new Set<string>();
    // 1. The hostel chosen on the warden's staff record (Add / Edit staff → Hostel Assignment).
    const assigned = st?.hostelAssignment?.hostelId || st?.hostelId;
    if (assigned && all.some((h) => h.id === assigned)) ids.add(String(assigned));
    const assignedName = st?.hostelAssignment?.hostelName || st?.hostelName;
    if (assignedName) for (const h of all) if (sameText(h.name, assignedName)) ids.add(h.id);
    // 2. Hostels whose own record names this person as warden (Hostel module → warden name / mobile).
    const phone = d.normalizePhone(st?.phone || a.user?.phone || '');
    for (const h of all) {
      if (phone && d.normalizePhone(h.wardenPhone) === phone) ids.add(h.id);
      else if (sameText(h.wardenName, st?.name || a.user?.name)) ids.add(h.id);
    }
    return ids;
  };

  /** The students who live (ACTIVE bed) in the given hostels, with their room and bed. */
  const residentsOf = (hostelIds: Set<string>) => {
    const byId = new Map(d.getStudents().map((s) => [s.id, s]));
    const out: Array<{ student: any; alloc: any }> = [];
    const seen = new Set<string>();
    for (const al of d.getHostelAllocations()) {
      if (al?.status !== 'ACTIVE' || !hostelIds.has(al.hostelId) || seen.has(al.studentId)) continue;
      const stu = byId.get(al.studentId);
      if (!stu || !isActiveStudent(stu)) continue;
      seen.add(al.studentId);
      out.push({ student: stu, alloc: al });
    }
    // Students whose hostel bed is saved on the student record but who have no allocation row (older records).
    const rooms = d.getHostelRooms?.() || [];
    const hostelsById = new Map(d.getHostels().map((h) => [h.id, h]));
    for (const stu of d.getStudents()) {
      if (seen.has(stu.id) || !isActiveStudent(stu) || !stu.hostelRequired || String(stu.hostelStatus || '').toUpperCase() === 'VACATED') continue;
      const room = rooms.find((r) => r.id === stu.hostelRoomId);
      const hid = room?.hostelId || stu.hostelId;
      if (!hid || !hostelIds.has(hid)) continue;
      seen.add(stu.id);
      out.push({
        student: stu,
        alloc: {
          hostelId: hid,
          hostelName: hostelsById.get(hid)?.name || stu.hostelName,
          roomNumber: room?.roomNumber || stu.hostelRoomNumber || stu.hostelRoomId || '-',
          floor: room?.floor || stu.hostelFloor,
          bedNumber: stu.hostelBedNumber || '-',
          allocationDate: stu.hostelAllocationDate,
        },
      });
    }
    return out.sort((x, y) => String(x.alloc.roomNumber).localeCompare(String(y.alloc.roomNumber), undefined, { numeric: true }) || String(x.student.name).localeCompare(String(y.student.name)));
  };

  /** Sign-in + role gate. Returns the scope or answers the request itself. */
  const gate = (req: Request, res: Response) => {
    const a = d.getAuthContext(req);
    if (!a?.user || !a?.session) {
      res.status(401).json({ success: false, error: 'Please sign in again.' });
      return null;
    }
    const role = roleOf(a);
    const isAdmin = HOSTEL_OVERSIGHT_ROLES.includes(role);
    if (role !== WARDEN_ROLE && !isAdmin) {
      res.status(403).json({ success: false, error: 'The hostel warden portal is only for hostel wardens.' });
      return null;
    }
    let hostelIds = hostelIdsFor(a);
    // Admins may narrow to one hostel; a warden asking for a hostel that is not theirs is refused.
    const wanted = String((req.query.hostelId as string) || req.body?.hostelId || '').trim();
    if (wanted && wanted !== 'ALL') {
      if (!hostelIds.has(wanted)) {
        res.status(403).json({ success: false, error: 'That hostel is not assigned to you.' });
        return null;
      }
      hostelIds = new Set([wanted]);
    }
    const residents = residentsOf(hostelIds);
    const studentIds = new Set(residents.map((r) => r.student.id));
    return { a, role, isAdmin, hostelIds, residents, studentIds };
  };

  const hostelsView = (ids: Set<string>) =>
    d
      .getHostels()
      .filter((h) => ids.has(h.id))
      .map((h) => ({ id: h.id, name: h.name, type: h.type, wardenName: h.wardenName, wardenPhone: h.wardenPhone, emergencyPhone: h.emergencyPhone }));

  const studentCard = (stu: any, alloc: any, tonight?: any) => ({
    id: stu.id,
    name: stu.name,
    photo: photoOf(stu),
    admissionNumber: stu.admissionNumber,
    classId: stu.classId,
    className: stu.className,
    section: stu.section,
    rollNumber: stu.rollNumber || null,
    gender: stu.gender || null,
    hostelId: alloc.hostelId,
    hostelName: alloc.hostelName,
    roomNumber: alloc.roomNumber,
    floor: alloc.floor,
    bedNumber: alloc.bedNumber,
    tonightStatus: tonight?.status || null,
  });

  const recordsOn = (date: string, ids: Set<string>) => nights.items.filter((r) => r.date === date && ids.has(r.studentId));

  /** Approved leave covering `date` for each student id. */
  const approvedLeaveOn = async (date: string, ids: Set<string>) => {
    const map = new Map<string, any>();
    for (const l of await d.allStudentLeaves()) if (ids.has(l.studentId) && leaveCovers(l, date)) map.set(l.studentId, l);
    return map;
  };

  const notifyAdmins = (title: string, body: string, data: Record<string, string>, excludeUserId?: string) => {
    if (!d.push) return;
    void d.push.notify(audience.withRole((r) => HOSTEL_OVERSIGHT_ROLES.includes(String(r).toUpperCase())), { type: 'HOSTEL', title, body, data, url: '/hostel' }, excludeUserId);
  };

  /** ABSENT at night opens an alert (once per student per night); any other status closes it. */
  const syncAbsentAlert = async (rec: any, a: Auth) => {
    const open = alerts.items.find((x) => x.type === 'ABSENT_AT_NIGHT' && x.studentId === rec.studentId && x.date === rec.date && x.status === 'OPEN');
    if (rec.status === 'ABSENT') {
      if (open) return null;
      const alert = {
        id: newId('hal'),
        hostelId: rec.hostelId,
        hostelName: rec.hostelName,
        type: 'ABSENT_AT_NIGHT',
        studentId: rec.studentId,
        studentName: rec.studentName,
        date: rec.date,
        message: `${rec.studentName} (Room ${rec.roomNumber || '-'}) was absent at night roll-call on ${rec.date}.`,
        status: 'OPEN',
        createdAt: nowIso(),
        createdById: a.user.id,
        createdByName: a.user.name,
      };
      await alerts.upsert(alert);
      return alert;
    }
    if (open) {
      await alerts.upsert({ ...open, status: 'RESOLVED', resolvedAt: nowIso(), resolvedByName: a.user.name, resolution: `Attendance changed to ${rec.status.replace('_', ' ').toLowerCase()}` });
    }
    return null;
  };

  // ---------------------------------------------------------------------------------------------
  // Who am I / what may I do
  // ---------------------------------------------------------------------------------------------

  app.get('/api/hostel-warden/me', (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    res.json({
      success: true,
      role: g.role,
      hostels: hostelsView(g.hostelIds),
      studentCount: g.residents.length,
      permissions: {
        viewDashboard: true,
        viewStudents: true,
        markAttendance: true,
        correctAttendance: true,
        approveLeave: d.leaveApprovalRoles.includes(g.role),
        forwardLeave: !d.leaveApprovalRoles.includes(g.role),
        manageMess: true,
      },
      today: indiaToday(),
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------------------------

  app.get('/api/hostel-warden/dashboard', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await Promise.all([nights.ready(), alerts.ready(), menus.ready()]);
    const today = indiaToday();
    const date = isIsoDate(req.query.date) ? (req.query.date as string) : today;
    const ids = [...g.studentIds];
    const tonight = recordsOn(date, g.studentIds);
    const counts = countNight(tonight, ids);
    const leaveMap = await approvedLeaveOn(date, g.studentIds);
    const allLeaves = (await d.allStudentLeaves()).filter((l) => g.studentIds.has(l.studentId));
    const openAlerts = alerts.items.filter((x) => g.hostelIds.has(x.hostelId) && x.status === 'OPEN');

    // Today's activity, from real records only.
    const activities: Array<{ at: string; kind: string; title: string; detail?: string }> = [];
    const markedBatches = new Map<string, { at: string; by: string; n: number }>();
    for (const r of tonight) {
      const key = `${r.markedByName}|${String(r.markedAt).slice(0, 16)}`;
      const b = markedBatches.get(key) || { at: r.markedAt, by: r.markedByName, n: 0 };
      b.n++;
      markedBatches.set(key, b);
      for (const h of (r.history || []).slice(1)) {
        if (String(h.at).slice(0, 10) === today) activities.push({ at: h.at, kind: 'CORRECTION', title: `Attendance corrected: ${r.studentName}`, detail: `${h.status.replace('_', ' ')} · ${h.reason || ''} · by ${h.byName}`.trim() });
      }
    }
    for (const b of markedBatches.values()) activities.push({ at: b.at, kind: 'ATTENDANCE', title: `Night attendance marked for ${b.n} student(s)`, detail: `by ${b.by}` });
    for (const x of alerts.items.filter((x) => g.hostelIds.has(x.hostelId) && String(x.createdAt).slice(0, 10) === today)) {
      activities.push({ at: x.createdAt, kind: x.type === 'EMERGENCY' ? 'EMERGENCY' : 'ALERT', title: x.type === 'EMERGENCY' ? 'Emergency alert raised' : `Absent at night: ${x.studentName}`, detail: x.message });
    }
    for (const l of allLeaves) {
      if (String(l.appliedAt).slice(0, 10) === today) activities.push({ at: l.appliedAt, kind: 'LEAVE', title: `Leave request: ${l.studentName}`, detail: `${l.startDate} to ${l.endDate} · ${l.reason}` });
      if (l.approvedAt && String(l.approvedAt).slice(0, 10) === today) activities.push({ at: l.approvedAt, kind: 'LEAVE', title: `Leave ${String(l.status).toLowerCase()}: ${l.studentName}`, detail: `by ${l.approvedBy}` });
      if (l.forwardedAt && String(l.forwardedAt).slice(0, 10) === today) activities.push({ at: l.forwardedAt, kind: 'LEAVE', title: `Leave forwarded to Principal: ${l.studentName}`, detail: `by ${l.forwardedByName}` });
    }
    for (const m of menus.items.filter((m) => g.hostelIds.has(m.hostelId) && String(m.updatedAt).slice(0, 10) === today)) {
      activities.push({ at: m.updatedAt, kind: 'MESS', title: `Mess menu updated for ${m.date}`, detail: `by ${m.updatedByName}` });
    }
    activities.sort((x, y) => String(y.at).localeCompare(String(x.at)));

    res.json({
      success: true,
      date,
      hostels: hostelsView(g.hostelIds),
      stats: {
        totalStudents: ids.length,
        present: counts.present,
        absent: counts.absent,
        onLeave: counts.onLeave,
        outside: counts.outside,
        unmarked: counts.unmarked,
        // Approved leaves for tonight, whether or not the roll-call has been taken yet.
        onApprovedLeave: leaveMap.size,
        emergencyAlerts: openAlerts.filter((x) => x.type === 'EMERGENCY').length,
        openAlerts: openAlerts.length,
        pendingLeaves: allLeaves.filter((l) => l.status === 'PENDING').length,
      },
      attendanceTaken: tonight.length > 0,
      alerts: openAlerts.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, 10),
      activities: activities.slice(0, 30),
    });
  });

  // ---------------------------------------------------------------------------------------------
  // My hostel students
  // ---------------------------------------------------------------------------------------------

  app.get('/api/hostel-warden/students', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await nights.ready();
    const q = String(req.query.search || '').trim().toLowerCase();
    const cls = String(req.query.classId || '').trim();
    const tonight = new Map(recordsOn(indiaToday(), g.studentIds).map((r) => [r.studentId, r]));
    const list = g.residents
      .filter(({ student: s }) => !cls || cls === 'ALL' || s.classId === cls || s.className === cls)
      .filter(({ student: s, alloc }) => !q || [s.name, s.admissionNumber, s.rollNumber, alloc.roomNumber].some((v) => String(v || '').toLowerCase().includes(q)))
      .map(({ student, alloc }) => studentCard(student, alloc, tonight.get(student.id)));
    const classes = Array.from(new Map(g.residents.map(({ student: s }) => [s.classId || s.className, { classId: s.classId, className: s.className }])).values()).sort((x, y) =>
      String(x.className).localeCompare(String(y.className), undefined, { numeric: true })
    );
    res.json({ success: true, data: list, total: g.residents.length, classes });
  });

  app.get('/api/hostel-warden/students/:id', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const row = g.residents.find((r) => r.student.id === req.params.id || r.student.admissionNumber === req.params.id);
    // Same answer for "not a resident of your hostel" and "does not exist": nothing leaks about other students.
    if (!row) return res.status(404).json({ success: false, error: 'This student is not in your hostel.' });
    await nights.ready();
    const s = row.student;
    const parent = d.getParentContact(s);
    const recent = nights.items
      .filter((r) => r.studentId === s.id)
      .sort((x, y) => String(y.date).localeCompare(String(x.date)))
      .slice(0, 14)
      .map((r) => ({ date: r.date, status: r.status, remarks: r.remarks || '' }));
    const leaves = (await d.allStudentLeaves())
      .filter((l) => l.studentId === s.id)
      .sort((x, y) => String(y.appliedAt).localeCompare(String(x.appliedAt)))
      .slice(0, 10)
      .map((l) => ({ id: l.id, startDate: l.startDate, endDate: l.endDate, reason: l.reason, status: l.status, forwardedAt: l.forwardedAt || null }));
    res.json({
      success: true,
      data: {
        ...studentCard(s, row.alloc, recent[0]?.date === indiaToday() ? recent[0] : undefined),
        dob: s.dob || null,
        bloodGroup: s.bloodGroup || null,
        address: s.address || s.permanentAddress || null,
        fatherName: s.fatherName || null,
        motherName: s.motherName || null,
        guardianName: s.guardianName || null,
        parent: { name: parent.name || s.parentName || null, phone: parent.phone || null },
        emergency: {
          name: s.emergencyContactName || null,
          relationship: s.emergencyRelationship || null,
          phone: s.emergencyContact || null,
          secondaryName: s.secondaryEmergencyName || null,
          secondaryPhone: s.secondaryEmergencyContact || null,
        },
        allocationDate: row.alloc.allocationDate || null,
        recentNights: recent,
        leaves,
      },
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Night attendance (separate from school attendance)
  // ---------------------------------------------------------------------------------------------

  /** The roll-call sheet for one night: every resident with their saved status (if any). */
  app.get('/api/hostel-warden/attendance', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await nights.ready();
    const today = indiaToday();
    const date = isIsoDate(req.query.date) ? (req.query.date as string) : today;
    if (date > today) return res.status(400).json({ success: false, error: 'A future night cannot be marked.' });
    const saved = new Map(recordsOn(date, g.studentIds).map((r) => [r.studentId, r]));
    const leaveMap = await approvedLeaveOn(date, g.studentIds);
    const rows = g.residents.map(({ student, alloc }) => {
      const rec = saved.get(student.id);
      return {
        ...studentCard(student, alloc, rec),
        record: rec ? { id: rec.id, status: rec.status, remarks: rec.remarks || '', markedAt: rec.markedAt, markedByName: rec.markedByName, corrected: !!rec.corrected } : null,
        // A suggestion only; the warden still chooses.
        suggested: rec ? null : leaveMap.has(student.id) ? 'ON_LEAVE' : null,
        approvedLeave: leaveMap.has(student.id) ? { startDate: leaveMap.get(student.id).startDate, endDate: leaveMap.get(student.id).endDate } : null,
      };
    });
    const correction = canCorrectNight(g.role, g.isAdmin, date, today);
    res.json({ success: true, date, rows, counts: countNight([...saved.values()], [...g.studentIds]), submitted: saved.size > 0, complete: saved.size >= g.studentIds.size && g.studentIds.size > 0, canCorrect: correction.ok, correctionNote: correction.reason || null });
  });

  /**
   * Submits night attendance. Students already marked for that night are refused (409) so a double tap or a
   * second phone cannot create a duplicate; changes to a saved record go through the correction endpoint.
   */
  app.post('/api/hostel-warden/attendance', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const today = indiaToday();
    const date = isIsoDate(req.body?.date) ? String(req.body.date) : today;
    const check = canCorrectNight(g.role, g.isAdmin, date, today); // same window applies to a late first submission
    if (!check.ok) return res.status(403).json({ success: false, error: check.reason });
    const clean = cleanNightEntries(req.body?.entries, g.studentIds);
    if ('error' in clean) return res.status(400).json({ success: false, error: clean.error });
    const hostelKey = [...g.hostelIds].sort().join(',');
    try {
      const out: { conflict?: string[]; recs?: any[]; newAlerts?: any[] } = await lock.run(`night:${hostelKey}:${date}`, async () => {
        await nights.ready();
        const already = clean.entries.filter((e) => nights.items.some((r) => r.studentId === e.studentId && r.date === date));
        if (already.length) return { conflict: already.map((e) => e.studentId) };
        const residents = new Map(g.residents.map((r) => [r.student.id, r]));
        const stamp = nowIso();
        const recs = clean.entries.map((e) => {
          const { student: s, alloc } = residents.get(e.studentId)!;
          return {
            id: newId('hna'),
            hostelId: alloc.hostelId,
            hostelName: alloc.hostelName,
            studentId: s.id,
            studentName: s.name,
            admissionNumber: s.admissionNumber,
            className: s.className,
            section: s.section,
            roomNumber: alloc.roomNumber,
            bedNumber: alloc.bedNumber,
            date,
            session: 'NIGHT',
            status: e.status,
            remarks: e.remarks || '',
            markedAt: stamp,
            markedById: g.a.user.id,
            markedByName: g.a.user.name,
            corrected: false,
            history: [{ status: e.status, remarks: e.remarks || '', at: stamp, byId: g.a.user.id, byName: g.a.user.name, byRole: g.role }],
          };
        });
        await nights.upsertMany(recs);
        const newAlerts: any[] = [];
        for (const r of recs) {
          const al = await syncAbsentAlert(r, g.a);
          if (al) newAlerts.push(al);
        }
        return { recs, newAlerts };
      });
      if ('conflict' in out) {
        return res.status(409).json({ success: false, code: 'ALREADY_MARKED', error: `Night attendance is already saved for ${out.conflict!.length} of these students. Use "Correct" to change it.`, studentIds: out.conflict });
      }
      const c = countNight(out.recs!, out.recs!.map((r) => r.studentId));
      d.logAudit(g.a.user.name, g.role, 'HOSTEL_NIGHT_ATTENDANCE_MARKED', 'HostelAttendance', `${hostelKey}:${date}`, `Night ${date}: ${c.present} present, ${c.absent} absent, ${c.onLeave} on leave, ${c.outside} outside`);
      if (out.newAlerts!.length) {
        const names = out.newAlerts!.map((x) => x.studentName).slice(0, 5).join(', ');
        notifyAdmins(`Hostel: ${out.newAlerts!.length} absent at night`, `${names}${out.newAlerts!.length > 5 ? ' and others' : ''} not present at roll-call on ${date}.`, { kind: 'HOSTEL_ABSENT', date }, g.a.user.id);
      }
      res.status(201).json({ success: true, date, saved: out.recs!.length, counts: c, alertsRaised: out.newAlerts!.length });
    } catch (err: any) {
      if (err?.code === 11000) return res.status(409).json({ success: false, code: 'ALREADY_MARKED', error: 'Night attendance was just saved from another device. Refresh to see it.' });
      res.status(500).json({ success: false, error: 'Night attendance could not be saved. Please try again.' });
    }
  });

  /** Corrects one saved night record. Needs a reason; keeps the full history and writes an audit log entry. */
  app.put('/api/hostel-warden/attendance/:id', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await nights.ready();
    const rec = nights.items.find((r) => r.id === req.params.id);
    if (!rec || !g.studentIds.has(rec.studentId)) return res.status(404).json({ success: false, error: 'Attendance record not found in your hostel.' });
    const check = canCorrectNight(g.role, g.isAdmin, rec.date, indiaToday());
    if (!check.ok) return res.status(403).json({ success: false, error: check.reason });
    const status = String(req.body?.status || '').toUpperCase() as NightStatus;
    if (!NIGHT_STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'Status must be Present, Absent, On Leave or Outside.' });
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (reason.length < 3) return res.status(400).json({ success: false, error: 'Write why the attendance is being corrected.' });
    const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim().slice(0, 200) : rec.remarks || '';
    if (status === rec.status && remarks === (rec.remarks || '')) return res.status(400).json({ success: false, error: 'Nothing changed.' });
    const stamp = nowIso();
    const prev = rec.status;
    const updated = {
      ...rec,
      status,
      remarks,
      corrected: true,
      history: [...(rec.history || []), { status, remarks, reason, at: stamp, byId: g.a.user.id, byName: g.a.user.name, byRole: g.role }],
    };
    try {
      await nights.upsert(updated);
      await syncAbsentAlert(updated, g.a);
    } catch {
      return res.status(500).json({ success: false, error: 'The correction could not be saved. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, 'HOSTEL_NIGHT_ATTENDANCE_CORRECTED', 'HostelAttendance', rec.id, `${rec.studentName} night ${rec.date}: ${prev} → ${status}. Reason: ${reason}`);
    res.json({ success: true, record: updated });
  });

  /** Saved night records (newest first), optionally for one student or a date range. */
  app.get('/api/hostel-warden/attendance/history', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await nights.ready();
    const from = isIsoDate(req.query.from) ? (req.query.from as string) : '';
    const to = isIsoDate(req.query.to) ? (req.query.to as string) : '';
    const sid = String(req.query.studentId || '');
    if (sid && !g.studentIds.has(sid)) return res.status(404).json({ success: false, error: 'This student is not in your hostel.' });
    const list = nights.items
      .filter((r) => g.studentIds.has(r.studentId) && (!sid || r.studentId === sid) && (!from || r.date >= from) && (!to || r.date <= to))
      .sort((x, y) => String(y.date).localeCompare(String(x.date)) || String(x.roomNumber).localeCompare(String(y.roomNumber), undefined, { numeric: true }))
      .slice(0, 2000);
    res.json({ success: true, data: list });
  });

  /** Daily (one night) or monthly report. */
  app.get('/api/hostel-warden/attendance/report', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await nights.ready();
    const today = indiaToday();
    const type = String(req.query.type || 'daily').toLowerCase();
    if (type === 'monthly') {
      const month = isMonth(req.query.month) ? (req.query.month as string) : today.slice(0, 7);
      const students = g.residents.map(({ student, alloc }) => ({ id: student.id, name: student.name, roomNumber: alloc.roomNumber }));
      return res.json({ success: true, type: 'monthly', ...monthlyNightReport(nights.items.filter((r) => g.studentIds.has(r.studentId)), students, month, today) });
    }
    const date = isIsoDate(req.query.date) ? (req.query.date as string) : today;
    const recs = recordsOn(date, g.studentIds);
    const byStatus = (st: string) => recs.filter((r) => r.status === st).map((r) => ({ studentId: r.studentId, name: r.studentName, roomNumber: r.roomNumber, remarks: r.remarks || '' }));
    const marked = new Set(recs.map((r) => r.studentId));
    res.json({
      success: true,
      type: 'daily',
      date,
      counts: countNight(recs, [...g.studentIds]),
      absent: byStatus('ABSENT'),
      outside: byStatus('OUTSIDE'),
      onLeave: byStatus('ON_LEAVE'),
      unmarked: g.residents.filter((r) => !marked.has(r.student.id)).map((r) => ({ studentId: r.student.id, name: r.student.name, roomNumber: r.alloc.roomNumber })),
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------------------------

  app.get('/api/hostel-warden/alerts', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await alerts.ready();
    const status = String(req.query.status || '').toUpperCase();
    const list = alerts.items
      .filter((x) => g.hostelIds.has(x.hostelId) && (!status || status === 'ALL' || x.status === status))
      .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))
      .slice(0, 200);
    res.json({ success: true, data: list });
  });

  /** The warden raises an emergency (sick student, missing student, building issue). The office is notified. */
  app.post('/api/hostel-warden/alerts', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await alerts.ready();
    const message = String(req.body?.message || '').trim().slice(0, 500);
    if (message.length < 5) return res.status(400).json({ success: false, error: 'Describe the emergency.' });
    const sid = String(req.body?.studentId || '');
    const row = sid ? g.residents.find((r) => r.student.id === sid) : null;
    if (sid && !row) return res.status(404).json({ success: false, error: 'This student is not in your hostel.' });
    const hostelId = row?.alloc.hostelId || (g.hostelIds.size === 1 ? [...g.hostelIds][0] : String(req.body?.hostelId || ''));
    if (!g.hostelIds.has(hostelId)) return res.status(400).json({ success: false, error: 'Choose the hostel.' });
    const hostel = d.getHostels().find((h) => h.id === hostelId);
    const alert = {
      id: newId('hal'),
      hostelId,
      hostelName: hostel?.name,
      type: 'EMERGENCY',
      studentId: row?.student.id,
      studentName: row?.student.name,
      date: indiaToday(),
      message,
      status: 'OPEN',
      createdAt: nowIso(),
      createdById: g.a.user.id,
      createdByName: g.a.user.name,
    };
    try {
      await alerts.upsert(alert);
    } catch {
      return res.status(500).json({ success: false, error: 'The alert could not be saved. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, 'HOSTEL_EMERGENCY_RAISED', 'HostelAlert', alert.id, `${hostel?.name || hostelId}: ${message}`);
    notifyAdmins(`🚨 Hostel emergency · ${hostel?.name || 'Hostel'}`, `${row ? `${row.student.name}: ` : ''}${message}`, { kind: 'HOSTEL_EMERGENCY', alertId: alert.id }, g.a.user.id);
    res.status(201).json({ success: true, alert });
  });

  app.put('/api/hostel-warden/alerts/:id/resolve', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await alerts.ready();
    const al = alerts.items.find((x) => x.id === req.params.id);
    if (!al || !g.hostelIds.has(al.hostelId)) return res.status(404).json({ success: false, error: 'Alert not found.' });
    if (al.status === 'RESOLVED') return res.status(400).json({ success: false, error: 'This alert is already resolved.' });
    const resolution = String(req.body?.resolution || '').trim().slice(0, 300);
    if (resolution.length < 3) return res.status(400).json({ success: false, error: 'Write how it was resolved.' });
    const updated = { ...al, status: 'RESOLVED', resolvedAt: nowIso(), resolvedByName: g.a.user.name, resolution };
    try {
      await alerts.upsert(updated);
    } catch {
      return res.status(500).json({ success: false, error: 'Could not save. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, 'HOSTEL_ALERT_RESOLVED', 'HostelAlert', al.id, resolution);
    res.json({ success: true, alert: updated });
  });

  // ---------------------------------------------------------------------------------------------
  // Mess menu (no billing)
  // ---------------------------------------------------------------------------------------------

  app.get('/api/hostel-warden/mess', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await Promise.all([menus.ready(), weekly.ready()]);
    const date = isIsoDate(req.query.date) ? (req.query.date as string) : indiaToday();
    const data = [...g.hostelIds].map((hid) => {
      // Special menu for that date → weekly menu of that weekday → (no weekly menu yet) latest earlier menu.
      const r = resolveDayMenu(hid, date, menus.items, weekly.items);
      const hostel = d.getHostels().find((h) => h.id === hid);
      return {
        hostelId: hid,
        hostelName: hostel?.name,
        date,
        weekday: r.weekday,
        weekdayName: WEEKDAY_NAMES[r.weekday - 1],
        source: r.source,
        menu: r.menu,
        carriedFrom: r.carriedFrom,
        hasSpecial: r.source === 'SPECIAL',
        hasWeekly: weekly.items.some((w) => w.hostelId === hid),
      };
    });
    res.json({ success: true, date, data });
  });

  app.put('/api/hostel-warden/mess', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const date = isIsoDate(req.body?.date) ? String(req.body.date) : '';
    if (!date) return res.status(400).json({ success: false, error: 'Choose the date.' });
    const hostelId = String(req.body?.hostelId || (g.hostelIds.size === 1 ? [...g.hostelIds][0] : ''));
    if (!g.hostelIds.has(hostelId)) return res.status(403).json({ success: false, error: 'That hostel is not assigned to you.' });
    const clean = cleanMessMenu(req.body?.meals);
    if ('error' in clean) return res.status(400).json({ success: false, error: clean.error });
    await menus.ready();
    const existing = menus.items.find((m) => m.hostelId === hostelId && m.date === date);
    const menu = {
      id: existing?.id || newId('hmm'),
      hostelId,
      date,
      meals: clean.meals,
      notice: String(req.body?.notice || '').trim().slice(0, 300),
      updatedById: g.a.user.id,
      updatedByName: g.a.user.name,
      updatedAt: nowIso(),
    };
    try {
      await menus.upsert(menu);
    } catch {
      return res.status(500).json({ success: false, error: 'The menu could not be saved. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, existing ? 'HOSTEL_MESS_MENU_UPDATED' : 'HOSTEL_MESS_MENU_CREATED', 'HostelMessMenu', menu.id, `Mess menu for ${date}`);
    res.json({ success: true, menu });
  });

  /** The weekly menu (Monday … Sunday) of each of the login's hostels. */
  app.get('/api/hostel-warden/mess/weekly', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    await weekly.ready();
    const data = [...g.hostelIds].map((hid) => ({
      hostelId: hid,
      hostelName: d.getHostels().find((h) => h.id === hid)?.name,
      days: WEEKDAY_NAMES.map((name, i) => ({ weekday: i + 1, name, menu: weekly.items.find((w) => w.hostelId === hid && w.weekday === i + 1) || null })),
    }));
    res.json({ success: true, data });
  });

  /** Saves one weekday of the weekly menu. It repeats every week until changed. */
  app.put('/api/hostel-warden/mess/weekly', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const weekday = Number(req.body?.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return res.status(400).json({ success: false, error: 'Choose the day of the week.' });
    const hostelId = String(req.body?.hostelId || (g.hostelIds.size === 1 ? [...g.hostelIds][0] : ''));
    if (!g.hostelIds.has(hostelId)) return res.status(403).json({ success: false, error: 'That hostel is not assigned to you.' });
    const clean = cleanMessMenu(req.body?.meals);
    if ('error' in clean) return res.status(400).json({ success: false, error: clean.error });
    await weekly.ready();
    const existing = weekly.items.find((w) => w.hostelId === hostelId && w.weekday === weekday);
    const rec = {
      id: existing?.id || newId('hwm'),
      hostelId,
      weekday,
      meals: clean.meals,
      notice: String(req.body?.notice || '').trim().slice(0, 300),
      updatedById: g.a.user.id,
      updatedByName: g.a.user.name,
      updatedAt: nowIso(),
    };
    try {
      await weekly.upsert(rec);
    } catch {
      return res.status(500).json({ success: false, error: 'The weekly menu could not be saved. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, 'HOSTEL_WEEKLY_MENU_SAVED', 'HostelWeeklyMenu', rec.id, `Weekly mess menu for ${WEEKDAY_NAMES[weekday - 1]}`);
    res.json({ success: true, menu: rec });
  });

  app.delete('/api/hostel-warden/mess/weekly', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const weekday = Number(req.query.weekday);
    const hostelId = String(req.query.hostelId || (g.hostelIds.size === 1 ? [...g.hostelIds][0] : ''));
    if (!g.hostelIds.has(hostelId)) return res.status(403).json({ success: false, error: 'That hostel is not assigned to you.' });
    await weekly.ready();
    const existing = weekly.items.find((w) => w.hostelId === hostelId && w.weekday === weekday);
    if (!existing) return res.status(404).json({ success: false, error: 'No weekly menu is saved for this day.' });
    try {
      await weekly.remove(existing.id);
    } catch {
      return res.status(500).json({ success: false, error: 'Could not delete. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, 'HOSTEL_WEEKLY_MENU_DELETED', 'HostelWeeklyMenu', existing.id, `Weekly mess menu for ${WEEKDAY_NAMES[weekday - 1]} cleared`);
    res.json({ success: true });
  });

  /** Removes the menu saved for one day (the day then shows the latest earlier menu, labelled). */
  app.delete('/api/hostel-warden/mess', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const date = isIsoDate(req.query.date) ? String(req.query.date) : '';
    const hostelId = String(req.query.hostelId || (g.hostelIds.size === 1 ? [...g.hostelIds][0] : ''));
    if (!date) return res.status(400).json({ success: false, error: 'Choose the date.' });
    if (!g.hostelIds.has(hostelId)) return res.status(403).json({ success: false, error: 'That hostel is not assigned to you.' });
    await menus.ready();
    const existing = menus.items.find((m) => m.hostelId === hostelId && m.date === date);
    if (!existing) return res.status(404).json({ success: false, error: 'No menu is saved for this day.' });
    try {
      await menus.remove(existing.id);
    } catch {
      return res.status(500).json({ success: false, error: 'The menu could not be deleted. Please try again.' });
    }
    d.logAudit(g.a.user.name, g.role, 'HOSTEL_MESS_MENU_DELETED', 'HostelMessMenu', existing.id, `Mess menu for ${date} deleted`);
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------------------------------
  // Leave requests of the warden's students (the existing student-leave records)
  // ---------------------------------------------------------------------------------------------

  app.get('/api/hostel-warden/leaves', async (req, res) => {
    const g = gate(req, res);
    if (!g) return;
    const status = String(req.query.status || '').toUpperCase();
    const today = indiaToday();
    const residents = new Map(g.residents.map((r) => [r.student.id, r]));
    const all = (await d.allStudentLeaves()).filter((l) => g.studentIds.has(l.studentId));
    const view = (l: any) => {
      const r = residents.get(l.studentId)!;
      const parent = d.getParentContact(r.student);
      return {
        ...l,
        studentPhoto: photoOf(r.student),
        className: r.student.className,
        section: r.student.section,
        roomNumber: r.alloc.roomNumber,
        bedNumber: r.alloc.bedNumber,
        parentName: parent.name || r.student.parentName || null,
        parentPhone: parent.phone || null,
        onLeaveNow: leaveCovers(l, today),
      };
    };
    const list = all
      .filter((l) => !status || status === 'ALL' || (status === 'CURRENT' ? leaveCovers(l, today) : l.status === status))
      .sort((x, y) => String(y.appliedAt).localeCompare(String(x.appliedAt)))
      .map(view);
    res.json({
      success: true,
      canApprove: d.leaveApprovalRoles.includes(g.role),
      data: list,
      currentlyOnLeave: all.filter((l) => leaveCovers(l, today)).map(view),
      pending: all.filter((l) => l.status === 'PENDING').length,
    });
  });

  return {
    /** For the engagement routes: which students a warden login may access (leave, chat). */
    hostelStudentIdsFor: (a: Auth) => new Set(residentsOf(hostelIdsFor(a)).map((r) => r.student.id)),
  };
}
