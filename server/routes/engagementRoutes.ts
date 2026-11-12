import type { Express, Request, Response } from 'express';
import { StudentLeaveModel } from '../models/StudentLeave.ts';
import { ParentMessageModel } from '../models/ParentMessage.ts';
import {
  EMERGENCY_MESSAGE_ROLES,
  FEE_ALERT_ROLES,
  LEAVE_APPROVAL_ROLES,
  PARENT_CHAT_STAFF_ROLES,
  STUDENT_LEAVE_TYPES,
  buildFeeDueSms,
  buildFeeDueText,
  cleanMessageText,
  indiaToday,
  leaveWorkingDates,
  summarizeFeeDues,
  validateLeaveInput,
} from '../services/engagementRules.ts';
import { audience, type PushService } from '../services/pushService.ts';
import { Store } from '../services/memoryStore.ts';

/**
 * Student leave, school ↔ parent chat, fee-due alerts and event interest.
 *
 * MongoDB is the source of truth. Records are also kept in memory so reads are fast;
 * without a MONGODB_URI (local preview) they live in memory only, as the rest of the
 * server does. Nothing is written to the /data JSON files.
 */

type Auth = { user: any; session: any };

export interface EngagementDeps {
  getAuthContext: (req: Request) => Auth;
  isStaffAdminTier: (role?: string) => boolean;
  findStaffForUser: (user: any, session: any) => any;
  isClassAndSectionAssignedToTeacher: (teacher: any, classId: string, section?: string) => boolean;
  normalizePhone: (p?: string) => string;
  getStudents: () => any[];
  getFeeLedgers: () => any[];
  getHolidays: () => any[];
  getAttendance: () => any[];
  setAttendance: (records: any[]) => void;
  saveAttendance: (records: any[]) => Promise<void>;
  getEvents: () => any[];
  saveEvents: (events: any[]) => Promise<void>;
  getSchoolName: () => string;
  /** The school office number from School Settings (shown to parents as "School office" phone). */
  getSchoolPhone?: () => string;
  getAcademicSession: () => string;
  logAudit: (userName: string, role: string, action: string, entity: string, entityId: string, details: string) => void;
  sms: {
    isConfigured: () => boolean;
    isValidIndianMobile: (p: string) => boolean;
    sendBatchSms: (opts: any[]) => Promise<{ sent: number; failed: number }>;
  };
  getParentContact: (student: any) => { phone: string; name: string };
  /** Profile photo the parent set on their own account (file key or URL), if any. */
  getParentPhoto?: (phone: string) => string | undefined;
  /** All staff records (for chat recipients). */
  getStaff: () => any[];
  /** Teachers who teach this student's class & section, with class-teacher flag. */
  teachersForStudent: (student: any) => Array<{ staff: any; isClassTeacher: boolean }>;
  /** Phone / browser notifications. Optional so tests can run without it. */
  push?: PushService;
  /** Hostel warden: ids of the students living in the hostel(s) assigned to this login. */
  hostelStudentIdsFor?: (a: Auth) => Set<string>;
}

const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

export function registerEngagementRoutes(app: Express, d: EngagementDeps) {
  const studentLeaves = new Store<any>(StudentLeaveModel, 'appliedAt');
  const messages = new Store<any>(ParentMessageModel, 'createdAt');

  const auth = (req: Request, res: Response): Auth | null => {
    const a = d.getAuthContext(req);
    if (!a.user || !a.session) {
      res.status(401).json({ success: false, error: 'Please sign in again.' });
      return null;
    }
    return a;
  };
  const roleOf = (a: Auth) => String(a.session.role || '').toUpperCase();
  const findStudent = (id: string) => d.getStudents().find((s) => s.id === id || s.admissionNumber === id);

  /** Students linked to a parent login: by linked ids or by the parent's phone on the student record. */
  const parentStudents = (a: Auth): any[] => {
    const linked = new Set<string>(
      [
        ...(Array.isArray(a.session.linkedStudentIds) ? a.session.linkedStudentIds : []),
        ...(Array.isArray(a.user?.linkedStudentIds) ? a.user.linkedStudentIds : []),
        a.session.studentId,
        a.session.activeStudentId,
      ].filter(Boolean)
    );
    const phone = d.normalizePhone(a.user?.phone || a.user?.username || '');
    return d.getStudents().filter(
      (s) =>
        linked.has(s.id) ||
        linked.has(s.admissionNumber) ||
        (!!phone && [s.parentPhone, s.fatherMobile, s.motherMobile, s.guardianMobile, s.mobile].some((p) => d.normalizePhone(p) === phone))
    );
  };

  /** Can this login see / act for this student? */
  const canAccessStudent = (a: Auth, stu: any): boolean => {
    if (!stu) return false;
    const role = roleOf(a);
    if (role === 'STUDENT') return a.session.studentId === stu.id || a.session.studentId === stu.admissionNumber || a.user?.id === stu.id;
    if (role === 'PARENT') return parentStudents(a).some((s) => s.id === stu.id);
    if (d.isStaffAdminTier(role)) return true;
    if (role === 'TEACHER') {
      const t = d.findStaffForUser(a.user, a.session);
      return !!t && d.isClassAndSectionAssignedToTeacher(t, stu.classId, stu.section || 'A');
    }
    // A warden sees only the students who live in their own hostel.
    if (role === 'HOSTEL_WARDEN') return !!d.hostelStudentIdsFor?.(a).has(stu.id);
    return false;
  };

  const visibleStudents = (a: Auth): any[] => {
    const role = roleOf(a);
    if (role === 'PARENT') return parentStudents(a);
    if (d.isStaffAdminTier(role)) return d.getStudents();
    return d.getStudents().filter((s) => canAccessStudent(a, s));
  };

  const photoOf = (x: any): string | undefined => x?.photoFileKey || x?.photo || x?.avatar || undefined;
  /** The parent of a student as shown to staff in chat: name, mobile, own photo and all their children here. */
  const parentCardFor = (stu: any) => {
    const c = d.getParentContact(stu);
    const phone = d.normalizePhone(c.phone);
    const children = phone
      ? d
          .getStudents()
          .filter((s) => String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
          .filter((s) => [s.parentPhone, s.fatherMobile, s.motherMobile, s.guardianMobile, s.mobile].some((p) => d.normalizePhone(p) === phone))
      : [stu];
    if (!children.some((s) => s.id === stu.id)) children.unshift(stu);
    return {
      name: c.name,
      phone: c.phone || '',
      photo: phone ? d.getParentPhoto?.(phone) : undefined,
      children: children.map((s) => ({ id: s.id, name: s.name, className: s.className, section: s.section, admissionNumber: s.admissionNumber, photo: photoOf(s) })),
    };
  };

  // =====================================================================
  // Student leave
  // =====================================================================

  app.get('/api/student-leaves', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await studentLeaves.ready();
    const { studentId, status } = req.query as Record<string, string>;
    let list = studentLeaves.items;
    if (!d.isStaffAdminTier(roleOf(a))) {
      const allowed = new Set(visibleStudents(a).map((s) => s.id));
      list = list.filter((l) => allowed.has(l.studentId));
    }
    if (studentId) {
      const stu = findStudent(studentId);
      list = list.filter((l) => l.studentId === (stu?.id || studentId));
    }
    if (status) list = list.filter((l) => l.status === String(status).toUpperCase());
    res.json([...list].sort((x, y) => String(y.appliedAt).localeCompare(String(x.appliedAt))));
  });

  app.post('/api/student-leaves', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const role = roleOf(a);
    const body = req.body || {};
    const stu = findStudent(String(body.studentId || (role === 'STUDENT' ? a.session.studentId : '')));
    if (!stu) return res.status(404).json({ success: false, error: 'Student not found.' });
    const isApprover = LEAVE_APPROVAL_ROLES.includes(role);
    // Students (self), parents (linked child) and approvers (anyone) may record student leave.
    if (!(isApprover || ((role === 'STUDENT' || role === 'PARENT') && canAccessStudent(a, stu)))) {
      return res.status(403).json({ success: false, error: 'You can only apply leave for yourself or your own child.' });
    }
    const dates = leaveWorkingDates(body.startDate, body.endDate, d.getHolidays());
    const invalid = validateLeaveInput(body, dates.length);
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    await studentLeaves.ready();
    const overlap = studentLeaves.items.find(
      (l) => l.studentId === stu.id && ['PENDING', 'APPROVED'].includes(l.status) && !(l.endDate < body.startDate || l.startDate > body.endDate)
    );
    if (overlap) return res.status(409).json({ success: false, error: `A ${overlap.status.toLowerCase()} leave already covers ${overlap.startDate} – ${overlap.endDate}.` });

    const leave: any = {
      id: newId('stl'),
      studentId: stu.id,
      studentName: stu.name,
      admissionNumber: stu.admissionNumber,
      classId: stu.classId,
      className: stu.className,
      section: stu.section,
      leaveType: STUDENT_LEAVE_TYPES.includes(String(body.leaveType).toUpperCase() as any) ? String(body.leaveType).toUpperCase() : 'CASUAL',
      startDate: body.startDate,
      endDate: body.endDate,
      daysCount: dates.length,
      reason: String(body.reason).trim(),
      status: 'PENDING',
      appliedAt: nowIso(),
      appliedById: a.user.id,
      appliedByName: a.user.name,
      appliedByRole: role,
      remarks: '',
    };
    try {
      await studentLeaves.upsert(leave);
      if (isApprover && String(body.status).toUpperCase() === 'APPROVED') await approveStudentLeave(leave, a, String(body.remarks || 'Added by administration'));
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'The leave could not be saved. Please try again.' });
    }
    d.logAudit(a.user.name, role, 'STUDENT_LEAVE_APPLIED', 'StudentLeave', leave.id, `${leave.studentName}: ${leave.leaveType} leave ${leave.startDate} to ${leave.endDate} (${leave.daysCount} day(s))`);
    res.status(201).json({ success: true, leave });
  });

  async function approveStudentLeave(leave: any, a: Auth, remarks?: string) {
    leave.status = 'APPROVED';
    leave.approvedBy = a.user.name;
    leave.approvedAt = nowIso();
    if (remarks !== undefined) leave.remarks = remarks;
    // Mark the working days as LEAVE. A day already marked PRESENT/LATE is left as it is.
    const att = d.getAttendance();
    const changed: any[] = [];
    for (const date of leaveWorkingDates(leave.startDate, leave.endDate, d.getHolidays())) {
      const idx = att.findIndex((r) => r.studentId === leave.studentId && String(r.date).slice(0, 10) === date);
      if (idx !== -1 && ['PRESENT', 'LATE', 'HALF_DAY'].includes(att[idx].status)) continue;
      const rec = {
        ...(idx !== -1 ? att[idx] : { id: `att-${leave.studentId}-${date}-${Math.random().toString(36).slice(2, 6)}` }),
        studentId: leave.studentId,
        studentName: leave.studentName,
        admissionNumber: leave.admissionNumber,
        classId: leave.classId,
        className: leave.className,
        section: leave.section,
        date,
        status: 'LEAVE',
        remarks: `Approved leave (${leave.leaveType})`,
        markedBy: a.user.name,
        academicSession: d.getAcademicSession(),
      };
      if (idx !== -1) att[idx] = rec;
      else att.push(rec);
      changed.push(rec);
    }
    d.setAttendance(att);
    if (changed.length) await d.saveAttendance(changed);
    await studentLeaves.upsert(leave);
  }

  app.put('/api/student-leaves/:id/status', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const role = roleOf(a);
    await studentLeaves.ready();
    const leave = studentLeaves.items.find((l) => l.id === req.params.id);
    if (!leave) return res.status(404).json({ success: false, error: 'Leave not found.' });
    const next = String(req.body?.status || '').toUpperCase();
    const remarks = req.body?.remarks !== undefined ? String(req.body.remarks).slice(0, 300) : undefined;

    if (next === 'CANCELLED') {
      // The person who applied (or the student / parent of the child) may withdraw a pending request.
      const own = leave.appliedById === a.user.id || ((role === 'STUDENT' || role === 'PARENT') && canAccessStudent(a, findStudent(leave.studentId)));
      if (!own) return res.status(403).json({ success: false, error: 'Only the applicant can withdraw this leave.' });
      if (leave.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Only a pending leave can be withdrawn.' });
      leave.status = 'CANCELLED';
      await studentLeaves.upsert(leave);
      return res.json({ success: true, leave });
    }
    if (!LEAVE_APPROVAL_ROLES.includes(role)) return res.status(403).json({ success: false, error: 'Only the principal or administration can approve leave.' });
    if (!['APPROVED', 'REJECTED'].includes(next)) return res.status(400).json({ success: false, error: 'Status must be APPROVED or REJECTED.' });
    if (leave.status !== 'PENDING') return res.status(400).json({ success: false, error: `This leave is already ${leave.status.toLowerCase()}.` });
    try {
      if (next === 'APPROVED') await approveStudentLeave(leave, a, remarks);
      else {
        leave.status = 'REJECTED';
        leave.approvedBy = a.user.name;
        leave.approvedAt = nowIso();
        if (remarks !== undefined) leave.remarks = remarks;
        await studentLeaves.upsert(leave);
      }
    } catch {
      return res.status(500).json({ success: false, error: 'The change could not be saved. Please try again.' });
    }
    d.logAudit(a.user.name, role, 'STUDENT_LEAVE_STATUS_UPDATED', 'StudentLeave', leave.id, `${leave.studentName}'s leave ${leave.status}`);
    res.json({ success: true, leave });
  });

  /**
   * Staff who cannot approve (e.g. the hostel warden) pass a pending request to the Principal with a note.
   * The leave stays PENDING; only LEAVE_APPROVAL_ROLES can approve or reject it.
   */
  app.put('/api/student-leaves/:id/forward', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const role = roleOf(a);
    await studentLeaves.ready();
    const leave = studentLeaves.items.find((l) => l.id === req.params.id);
    if (!leave) return res.status(404).json({ success: false, error: 'Leave not found.' });
    if (LEAVE_APPROVAL_ROLES.includes(role)) return res.status(400).json({ success: false, error: 'You can approve or reject this leave yourself.' });
    if (role === 'PARENT' || role === 'STUDENT' || !canAccessStudent(a, findStudent(leave.studentId))) {
      return res.status(403).json({ success: false, error: 'You can forward leave only for your own students.' });
    }
    if (leave.status !== 'PENDING') return res.status(400).json({ success: false, error: `This leave is already ${String(leave.status).toLowerCase()}.` });
    if (leave.forwardedAt) return res.status(409).json({ success: false, error: 'This leave was already forwarded to the Principal.', leave });
    const note = String(req.body?.note || '').trim().slice(0, 300);
    leave.forwardedAt = nowIso();
    leave.forwardedById = a.user.id;
    leave.forwardedByName = a.user.name;
    leave.forwardedByRole = role;
    leave.forwardNote = note;
    try {
      await studentLeaves.upsert(leave);
    } catch {
      return res.status(500).json({ success: false, error: 'The leave could not be forwarded. Please try again.' });
    }
    d.logAudit(a.user.name, role, 'STUDENT_LEAVE_FORWARDED', 'StudentLeave', leave.id, `${leave.studentName}'s leave ${leave.startDate} to ${leave.endDate} forwarded to the Principal${note ? `: ${note}` : ''}`);
    res.json({ success: true, leave });
    if (d.push) {
      void d.push.notify(audience.withRole((r) => LEAVE_APPROVAL_ROLES.includes(String(r).toUpperCase())), {
        type: 'HOSTEL',
        title: `Leave forwarded · ${leave.studentName}`,
        body: `${a.user.name || 'Hostel warden'} forwarded a leave request (${leave.startDate} to ${leave.endDate}) for your approval.`,
        data: { leaveId: leave.id, studentId: leave.studentId },
      }, a.user.id);
    }
  });

  /** All student leaves (hostel warden portal filters them to its own students). */
  const allStudentLeaves = async () => {
    await studentLeaves.ready();
    return studentLeaves.items;
  };

  /** Approved student leaves, for the attendance calendar. */
  const leavesForStudent = async (studentId: string) => {
    await studentLeaves.ready();
    return studentLeaves.items.filter((l) => l.studentId === studentId);
  };

  // =====================================================================
  // Fee dues
  // =====================================================================

  const duesFor = (studentId: string) => summarizeFeeDues(d.getFeeLedgers().filter((l) => l.studentId === studentId), indiaToday());

  app.get('/api/fee-dues/summary', (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    if (!FEE_ALERT_ROLES.includes(roleOf(a))) return res.status(403).json({ success: false, error: 'Your role cannot view fee dues.' });
    const { classId, section } = req.query as Record<string, string>;
    const byStudent = new Map<string, any[]>();
    for (const l of d.getFeeLedgers()) {
      if (!l?.studentId) continue;
      if (!byStudent.has(l.studentId)) byStudent.set(l.studentId, []);
      byStudent.get(l.studentId)!.push(l);
    }
    const today = indiaToday();
    const rows = d
      .getStudents()
      .filter((s) => String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
      .filter((s) => !classId || classId === 'ALL' || s.classId === classId || s.className === classId)
      .filter((s) => !section || section === 'ALL' || String(s.section || '').toUpperCase() === section.toUpperCase())
      .map((s) => {
        const sum = summarizeFeeDues(byStudent.get(s.id) || [], today);
        const last = [...messages.items].reverse().find((m) => m.studentId === s.id && m.kind === 'FEE_DUE');
        return {
          studentId: s.id,
          studentName: s.name,
          studentPhoto: photoOf(s),
          fatherName: s.fatherName || d.getParentContact(s).name,
          admissionNumber: s.admissionNumber,
          className: s.className,
          section: s.section,
          totalPending: sum.totalPending,
          overdue: sum.overdue,
          lastAlertAt: last?.createdAt || null,
        };
      })
      .filter((r) => r.totalPending > 0)
      .sort((x, y) => y.overdue - x.overdue || y.totalPending - x.totalPending);
    res.json({ success: true, data: rows, totalPending: rows.reduce((s, r) => s + r.totalPending, 0) });
  });

  app.post('/api/fee-dues/notify', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const role = roleOf(a);
    if (!FEE_ALERT_ROLES.includes(role)) return res.status(403).json({ success: false, error: 'Your role cannot send fee alerts.' });
    await messages.ready();
    const ids: string[] = Array.isArray(req.body?.studentIds) ? req.body.studentIds.map(String).slice(0, 2000) : [];
    if (ids.length === 0) return res.status(400).json({ success: false, error: 'Choose at least one student.' });
    const note = String(req.body?.note || '');
    const school = d.getSchoolName();
    const created: any[] = [];
    const smsBatch: any[] = [];
    let skipped = 0;
    for (const id of ids) {
      const stu = findStudent(id);
      if (!stu) { skipped++; continue; }
      const sum = duesFor(stu.id);
      if (sum.totalPending <= 0) { skipped++; continue; }
      const sender = staffIdentity(a);
      const msg = {
        id: newId('pm'),
        threadId: threadKey(stu.id, sender.id),
        staffId: sender.id,
        staffName: sender.name,
        staffTitle: sender.title,
        studentId: stu.id,
        studentName: stu.name,
        className: stu.className,
        section: stu.section,
        senderSide: 'SCHOOL',
        senderId: a.user.id,
        senderName: a.user.name,
        senderRole: role,
        kind: 'FEE_DUE',
        text: buildFeeDueText(school, stu.name, sum, note),
        feeDue: { totalPending: sum.totalPending, overdue: sum.overdue, items: sum.items.slice(0, 12).map(({ label, amount, dueDate }) => ({ label, amount, dueDate })) },
        createdAt: nowIso(),
      };
      created.push(msg);
      if (req.body?.sendSms) {
        const c = d.getParentContact(stu);
        if (c.phone && d.sms.isValidIndianMobile(c.phone)) {
          smsBatch.push({
            recipientPhone: c.phone,
            recipientName: c.name,
            recipientRole: 'PARENT',
            studentId: stu.id,
            studentName: stu.name,
            admissionNumber: stu.admissionNumber,
            className: stu.className,
            section: stu.section,
            message: buildFeeDueSms(school, stu.name, sum),
            triggerType: 'FEE_REMINDER',
            idempotencyKey: `fee-due-${stu.id}-${indiaToday()}`,
            sentBy: a.user.name,
            sentByUserId: a.user.id,
          });
        }
      }
    }
    try {
      await messages.upsertMany(created);
    } catch {
      return res.status(500).json({ success: false, error: 'The alerts could not be saved. Please try again.' });
    }
    let sms = { requested: !!req.body?.sendSms, configured: d.sms.isConfigured(), sent: 0, failed: 0 };
    if (smsBatch.length && sms.configured) {
      try {
        const r = await d.sms.sendBatchSms(smsBatch);
        sms = { ...sms, sent: r.sent, failed: r.failed };
      } catch {
        sms.failed = smsBatch.length;
      }
    }
    d.logAudit(a.user.name, role, 'FEE_DUE_ALERT_SENT', 'ParentMessage', created.map((m) => m.studentId).join(',').slice(0, 200), `Fee due alert sent for ${created.length} student(s)`);
    res.json({ success: true, sent: created.length, skipped, sms });
    if (d.push) {
      for (const m of created) {
        const total = Number(m.feeDue?.totalPending || 0);
        const overdue = Number(m.feeDue?.overdue || 0);
        const amount = `₹${total.toLocaleString('en-IN')}`;
        void d.push.notify(audience.familyOf(m.studentId), {
          type: 'FEE_DUE',
          title: `💳 Fee payment due · ${m.studentName || 'your child'}`,
          body: overdue > 0
            ? `${amount} pending, ${`₹${overdue.toLocaleString('en-IN')}`} is overdue. Tap Pay now to pay securely.`
            : `${amount} fee pending. Tap Pay now to pay securely in the app.`,
          data: { studentId: m.studentId },
          category: 'fee_due',
          url: '/messages',
        }, a.user.id);
      }
    }
  });

  /** Parent app: pending dues of one linked child, for the "fee pending" popup. */
  app.get('/api/parent/fee-dues', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const stu = findStudent(String(req.query.studentId || ''));
    if (!stu || !canAccessStudent(a, stu) || !['PARENT', 'STUDENT'].includes(roleOf(a))) {
      return res.status(403).json({ success: false, error: 'That student is not linked to your account.' });
    }
    await messages.ready();
    const sum = duesFor(stu.id);
    const lastAlert = [...messages.items].reverse().find((m) => m.studentId === stu.id && m.kind === 'FEE_DUE');
    res.json({ success: true, studentId: stu.id, studentName: stu.name, ...sum, lastAlertAt: lastAlert?.createdAt || null, lastAlertText: lastAlert?.text || null });
  });

  // =====================================================================
  // Parent ↔ staff chat
  // One thread per (student, staff member): threadId = "<studentId>::<staffId>".
  // A parent can write to their child's teachers, the Principal, the Super Admin
  // and the Chairman. Staff see only threads addressed to them; teachers can start
  // a thread with parents of students they teach; admin-tier staff with any parent.
  // Messages from before per-staff threads (threadId = studentId) form a
  // "School office" thread (staffId SCHOOL) that admin-tier staff can answer.
  // =====================================================================

  const SCHOOL = 'SCHOOL';
  const threadKey = (studentId: string, staffId: string) => `${studentId}::${staffId}`;
  const parseThread = (threadId: string) => {
    const [studentId, staffId] = String(threadId || '').split('::');
    return { studentId, staffId: staffId || SCHOOL };
  };
  const msgStaffId = (m: any) => m.staffId || (String(m.threadId).includes('::') ? parseThread(m.threadId).staffId : SCHOOL);
  const msgThread = (m: any) => (String(m.threadId).includes('::') ? m.threadId : threadKey(m.studentId || m.threadId, SCHOOL));

  const titleOf = (st: any): string => {
    const role = String(st?.role || '').toUpperCase();
    const des = String(st?.designation || '');
    if (/chairman|chairperson|founder|managing director|director/i.test(des)) return des || 'Chairman';
    if (role === 'PRINCIPAL' || /^principal/i.test(des)) return 'Principal';
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    return des || role.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) || 'Staff';
  };
  const isActiveStaff = (st: any) => !['INACTIVE', 'LEFT_SCHOOL', 'TERMINATED', 'RESIGNED', 'SUSPENDED'].includes(String(st?.status || 'ACTIVE').toUpperCase());

  /** The signed-in staff member as a chat party. Admin accounts without a staff record use their user id. */
  const staffIdentity = (a: Auth): { id: string; name: string; title: string } => {
    const st = d.findStaffForUser(a.user, a.session);
    if (st) return { id: st.id, name: st.name, title: titleOf(st) };
    return { id: `user-${a.user.id}`, name: a.user.name || 'School office', title: titleOf({ role: a.session.role }) };
  };

  /** Who a parent may write to about this child. */
  /** The staff member's own mobile number from the staff record, so a linked parent can call as well as chat. */
  const staffPhoneOf = (st: any): string | undefined => {
    const raw = String(st?.phone || st?.mobile || st?.contactNumber || '').trim();
    return /\d{6,}/.test(raw.replace(/\D/g, '')) ? raw : undefined;
  };

  const contactsForStudent = (stu: any) => {
    const out: Array<{ staffId: string; name: string; title: string; group: 'TEACHER' | 'LEADERSHIP'; photo?: string; phone?: string }> = [];
    const seen = new Set<string>();
    const add = (st: any, title: string, group: 'TEACHER' | 'LEADERSHIP') => {
      if (!st?.id || seen.has(st.id) || !isActiveStaff(st)) return;
      seen.add(st.id);
      out.push({ staffId: st.id, name: st.name, title, group, photo: st.photoFileKey || st.photo, phone: staffPhoneOf(st) });
    };
    const teachers = d.teachersForStudent(stu).sort((x, y) => Number(y.isClassTeacher) - Number(x.isClassTeacher));
    for (const t of teachers) add(t.staff, t.isClassTeacher ? 'Class teacher' : `${t.staff.designation || 'Teacher'}`, 'TEACHER');
    const staff = d.getStaff();
    staff.filter((st) => /chairman|chairperson|founder|managing director|^director/i.test(String(st.designation || ''))).forEach((st) => add(st, titleOf(st), 'LEADERSHIP'));
    staff.filter((st) => String(st.role || '').toUpperCase() === 'PRINCIPAL').forEach((st) => add(st, 'Principal', 'LEADERSHIP'));
    staff.filter((st) => String(st.role || '').toUpperCase() === 'SUPER_ADMIN').forEach((st) => add(st, titleOf(st) === 'Super Admin' ? 'Super Admin' : titleOf(st), 'LEADERSHIP'));
    return out;
  };

  /** Can this login read / write in this thread? */
  const threadAccess = (a: Auth, threadId: string): { ok: boolean; side?: 'PARENT' | 'SCHOOL'; stu?: any; staffId?: string; reason?: string } => {
    const { studentId, staffId } = parseThread(threadId);
    const stu = findStudent(studentId);
    if (!stu) return { ok: false, reason: 'Student not found.' };
    const role = roleOf(a);
    if (role === 'PARENT') {
      if (!canAccessStudent(a, stu)) return { ok: false, reason: 'That student is not linked to your account.' };
      const existing = messages.items.some((m) => msgThread(m) === threadId);
      const allowed = staffId === SCHOOL || contactsForStudent(stu).some((c) => c.staffId === staffId);
      if (!existing && !allowed) return { ok: false, reason: 'You cannot message this staff member.' };
      return { ok: true, side: 'PARENT', stu, staffId };
    }
    if (!PARENT_CHAT_STAFF_ROLES.includes(role)) return { ok: false, reason: 'Chat is not available for your role.' };
    const me = staffIdentity(a);
    if (staffId === me.id) {
      // Teachers only with parents of students they teach; admin tier with anyone.
      if (!d.isStaffAdminTier(role) && !canAccessStudent(a, stu) && !messages.items.some((m) => msgThread(m) === threadId)) {
        return { ok: false, reason: 'You can message parents of your own students only.' };
      }
      return { ok: true, side: 'SCHOOL', stu, staffId };
    }
    if (staffId === SCHOOL && d.isStaffAdminTier(role)) return { ok: true, side: 'SCHOOL', stu, staffId };
    return { ok: false, reason: 'This conversation belongs to another staff member.' };
  };

  const staffNameFor = (staffId: string) => {
    if (staffId === SCHOOL) return { name: 'School office', title: 'Office', phone: (d.getSchoolPhone?.() || '').trim() || undefined };
    const st = d.getStaff().find((x) => x.id === staffId);
    return st ? { name: st.name, title: titleOf(st), photo: st.photoFileKey || st.photo, phone: staffPhoneOf(st) } : { name: 'School', title: 'Staff' };
  };

  /** Parent: the people they can write to about one child, with unread counts and last message. */
  app.get('/api/parent-chat/contacts', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const stu = findStudent(String(req.query.studentId || ''));
    if (!stu || roleOf(a) !== 'PARENT' || !canAccessStudent(a, stu)) return res.status(403).json({ success: false, error: 'That student is not linked to your account.' });
    await messages.ready();
    const contacts: any[] = contactsForStudent(stu);
    // Threads that already exist (e.g. fee alerts from the accountant, old school-office chat) are listed too.
    for (const m of messages.items) {
      if (m.studentId !== stu.id) continue;
      const sid = msgStaffId(m);
      if (!contacts.some((c) => c.staffId === sid)) {
        const n = staffNameFor(sid);
        contacts.push({ staffId: sid, name: n.name, title: n.title, group: 'OTHER', photo: (n as any).photo, phone: (n as any).phone });
      }
    }
    const withStats = contacts.map((c) => {
      const tid = threadKey(stu.id, c.staffId);
      const list = messages.items.filter((m) => msgThread(m) === tid);
      const last = list[list.length - 1];
      return {
        ...c,
        threadId: tid,
        unread: list.filter((m) => m.senderSide === 'SCHOOL' && !m.readByParentAt).length,
        lastText: last ? (last.kind === 'FEE_DUE' ? 'Fee due reminder' : last.text) : null,
        lastAt: last?.createdAt || null,
      };
    });
    res.json({ success: true, student: { id: stu.id, name: stu.name, className: stu.className, section: stu.section }, data: withStats });
  });

  /** Thread list. Parent: all threads of linked children. Staff: threads addressed to them (+ school office for admin tier). */
  app.get('/api/parent-chat/threads', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const role = roleOf(a);
    await messages.ready();
    const isParent = role === 'PARENT';
    if (!isParent && !PARENT_CHAT_STAFF_ROLES.includes(role)) return res.status(403).json({ success: false, error: 'Chat is not available for your role.' });
    const me = isParent ? null : staffIdentity(a);
    const myStudents = isParent ? new Map(parentStudents(a).map((s) => [s.id, s])) : null;
    const threads = new Map<string, any>();
    for (const m of messages.items) {
      const tid = msgThread(m);
      const sid = msgStaffId(m);
      if (isParent) {
        if (!myStudents!.has(m.studentId)) continue;
      } else if (!(sid === me!.id || (sid === SCHOOL && d.isStaffAdminTier(role)))) continue;
      const t = threads.get(tid) || { threadId: tid, studentId: m.studentId, staffId: sid, unread: 0 };
      t.lastText = m.text;
      t.lastKind = m.kind;
      t.lastAt = m.createdAt;
      t.lastSide = m.senderSide;
      const unreadForMe = isParent ? m.senderSide === 'SCHOOL' && !m.readByParentAt : m.senderSide === 'PARENT' && !m.readBySchoolAt;
      if (unreadForMe) t.unread++;
      threads.set(tid, t);
    }
    const out = [...threads.values()].map((t) => {
      const s = findStudent(t.studentId);
      const who = staffNameFor(t.staffId);
      const parentPhone = s ? d.normalizePhone(d.getParentContact(s).phone) : '';
      return {
        ...t,
        studentName: s?.name,
        studentPhoto: photoOf(s),
        className: s?.className,
        section: s?.section,
        admissionNumber: s?.admissionNumber,
        parentName: s ? d.getParentContact(s).name : undefined,
        parentPhoto: parentPhone ? d.getParentPhoto?.(parentPhone) : undefined,
        staffName: who.name,
        staffTitle: who.title,
        staffPhoto: (who as any).photo,
      };
    });
    out.sort((x, y) => String(y.lastAt).localeCompare(String(x.lastAt)));
    res.json({ success: true, me: me ? { staffId: me.id, name: me.name } : undefined, data: out, unreadTotal: out.reduce((n, t) => n + t.unread, 0) });
  });

  /** Staff: open (or start) the thread with the parents of a student. */
  app.get('/api/parent-chat/start', (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const stu = findStudent(String(req.query.studentId || ''));
    if (!stu) return res.status(404).json({ success: false, error: 'Student not found.' });
    if (roleOf(a) === 'PARENT') return res.status(400).json({ success: false, error: 'Use the contacts list.' });
    const tid = threadKey(stu.id, staffIdentity(a).id);
    const acc = threadAccess(a, tid);
    if (!acc.ok) return res.status(403).json({ success: false, error: acc.reason });
    res.json({ success: true, threadId: tid });
  });

  app.get('/api/parent-chat/threads/:threadId/messages', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await messages.ready();
    const tid = req.params.threadId;
    const acc = threadAccess(a, tid);
    if (!acc.ok) return res.status(403).json({ success: false, error: acc.reason || 'You cannot open this conversation.' });
    const isParent = acc.side === 'PARENT';
    const list = messages.items.filter((m) => msgThread(m) === tid);
    const stamp = nowIso();
    const toMark = list.filter((m) => (isParent ? m.senderSide === 'SCHOOL' && !m.readByParentAt : m.senderSide === 'PARENT' && !m.readBySchoolAt));
    toMark.forEach((m) => (isParent ? (m.readByParentAt = stamp) : (m.readBySchoolAt = stamp)));
    if (toMark.length) messages.upsertMany(toMark).catch(() => {});
    const stu = acc.stu;
    res.json({
      success: true,
      threadId: tid,
      student: { id: stu.id, name: stu.name, className: stu.className, section: stu.section, admissionNumber: stu.admissionNumber, photo: photoOf(stu) },
      parentName: d.getParentContact(stu).name,
      // Staff see the parent's card (mobile, photo, children); parents don't need it about themselves.
      parent: isParent ? undefined : parentCardFor(stu),
      staff: { staffId: acc.staffId, ...staffNameFor(acc.staffId!) },
      data: list.slice(-300),
    });
  });

  app.post('/api/parent-chat/threads/:threadId/messages', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    await messages.ready();
    const tid = req.params.threadId;
    const acc = threadAccess(a, tid);
    if (!acc.ok) return res.status(403).json({ success: false, error: acc.reason || 'You cannot write in this conversation.' });
    const text = cleanMessageText(req.body?.text);
    if (!text) return res.status(400).json({ success: false, error: 'Type a message first.' });
    const stu = acc.stu;
    const who = staffNameFor(acc.staffId!);
    const msg = {
      id: newId('pm'),
      threadId: tid,
      staffId: acc.staffId,
      staffName: who.name,
      staffTitle: who.title,
      studentId: stu.id,
      studentName: stu.name,
      className: stu.className,
      section: stu.section,
      senderSide: acc.side,
      senderId: a.user.id,
      senderName: a.user.name,
      senderRole: roleOf(a),
      kind: 'TEXT',
      text,
      createdAt: nowIso(),
    };
    try {
      await messages.upsert(msg);
    } catch {
      return res.status(500).json({ success: false, error: 'The message could not be sent. Please try again.' });
    }
    res.status(201).json({ success: true, message: msg });
    // Tell the other side on their phone / browser. Fire and forget: never delays or fails the message.
    if (d.push) {
      if (acc.side === 'SCHOOL') {
        void d.push.notify(audience.familyOf(stu.id), {
          type: 'MESSAGE',
          title: `${who.name} · ${stu.name}`,
          body: text,
          data: { threadId: tid, studentId: stu.id },
          url: '/messages',
        }, a.user.id);
      } else {
        const toOffice = acc.staffId === SCHOOL;
        void d.push.notify(
          toOffice ? audience.withRole((role) => d.isStaffAdminTier(role)) : audience.staffMember(acc.staffId!),
          {
            type: 'MESSAGE',
            title: `${a.user.name || 'Parent'} · parent of ${stu.name}`,
            body: text,
            data: { threadId: tid, studentId: stu.id },
            url: '/messages',
          },
          a.user.id
        );
      }
    }
  });

  // =====================================================================
  // Emergency message: one message to every parent, chosen classes, or chosen students
  // =====================================================================

  app.post('/api/parent-chat/emergency', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const role = roleOf(a);
    if (!EMERGENCY_MESSAGE_ROLES.includes(role)) return res.status(403).json({ success: false, error: 'Only the Principal or school admins can send emergency messages.' });
    const text = cleanMessageText(req.body?.text);
    if (!text) return res.status(400).json({ success: false, error: 'Type the emergency message first.' });
    const scope = String(req.body?.scope || '').toUpperCase();
    if (!['ALL', 'CLASS', 'STUDENTS'].includes(scope)) return res.status(400).json({ success: false, error: 'Choose who should get the message.' });
    const active = d.getStudents().filter((s) => String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    let targets: any[] = [];
    if (scope === 'ALL') targets = active;
    else if (scope === 'CLASS') {
      const cls = new Set<string>((Array.isArray(req.body?.classIds) ? req.body.classIds : []).map(String));
      targets = active.filter((s) => cls.has(s.classId) || cls.has(s.className));
    } else {
      const ids = new Set<string>((Array.isArray(req.body?.studentIds) ? req.body.studentIds : []).map(String));
      targets = active.filter((s) => ids.has(s.id));
    }
    if (targets.length === 0) return res.status(400).json({ success: false, error: 'No students match. Choose at least one class or student.' });
    await messages.ready();
    const stamp = nowIso();
    const office = staffNameFor(SCHOOL);
    const created = targets.slice(0, 5000).map((stu) => ({
      id: newId('pm'),
      threadId: threadKey(stu.id, SCHOOL),
      staffId: SCHOOL,
      staffName: office.name,
      staffTitle: office.title,
      studentId: stu.id,
      studentName: stu.name,
      className: stu.className,
      section: stu.section,
      senderSide: 'SCHOOL',
      senderId: a.user.id,
      senderName: a.user.name,
      senderRole: role,
      kind: 'EMERGENCY',
      text,
      createdAt: stamp,
    }));
    try {
      await messages.upsertMany(created);
    } catch {
      return res.status(500).json({ success: false, error: 'The emergency message could not be saved. Please try again.' });
    }
    d.logAudit(a.user.name, role, 'EMERGENCY_MESSAGE_SENT', 'ParentMessage', scope, `Emergency message to the parents of ${created.length} student(s)`);
    res.json({ success: true, sent: created.length });
    if (d.push) {
      // One alert per phone, even when a parent has several children in the list.
      const ids = new Set(created.map((m) => m.studentId));
      const alsoStaff = !!req.body?.alsoStaff;
      void d.push.notify(
        (dev) =>
          ((dev.role === 'PARENT' || dev.role === 'STUDENT') && dev.studentIds.some((sid) => ids.has(sid))) ||
          (alsoStaff && dev.role !== 'PARENT' && dev.role !== 'STUDENT'),
        { type: 'MESSAGE', title: `Emergency · ${d.getSchoolName()}`, body: text, data: { kind: 'EMERGENCY' }, url: '/messages' },
        a.user.id
      );
    }
  });

  // =====================================================================
  // Events: "I'm interested" and a signed-in list with counts
  // =====================================================================

  const eventView = (e: any, userId: string) => {
    const ids: string[] = Array.isArray(e.interestedUserIds) ? e.interestedUserIds : [];
    const { interestedUserIds, ...rest } = e;
    return { ...rest, interestedCount: ids.length, isInterested: ids.includes(userId) };
  };

  app.get('/api/events', (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const all = req.query.all === '1' && d.isStaffAdminTier(roleOf(a));
    const list = d.getEvents().filter((e) => all || e.isActive !== false);
    res.json({ success: true, data: list.map((e) => eventView(e, a.user.id)) });
  });

  app.post('/api/events/:id/interest', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const events = d.getEvents();
    const e = events.find((x) => x.id === req.params.id);
    if (!e) return res.status(404).json({ success: false, error: 'Event not found.' });
    const ids: string[] = Array.isArray(e.interestedUserIds) ? e.interestedUserIds : [];
    const want = req.body?.interested !== undefined ? !!req.body.interested : !ids.includes(a.user.id);
    e.interestedUserIds = want ? Array.from(new Set([...ids, a.user.id])) : ids.filter((x) => x !== a.user.id);
    try {
      await d.saveEvents(events);
    } catch {
      return res.status(500).json({ success: false, error: 'Could not save. Please try again.' });
    }
    res.json({ success: true, event: eventView(e, a.user.id) });
  });

  /** Which children / chat identity a login stands for, saved with its notification devices. */
  const pushIdentity = (a: Auth): { studentIds: string[]; staffId?: string } => {
    const role = roleOf(a);
    if (role === 'PARENT') return { studentIds: parentStudents(a).map((s) => s.id) };
    if (role === 'STUDENT') {
      const me = d.getStudents().find((s) => s.id === a.session.studentId || s.admissionNumber === a.session.studentId || s.id === a.user?.id);
      return { studentIds: me ? [me.id] : [] };
    }
    if (PARENT_CHAT_STAFF_ROLES.includes(role)) return { studentIds: [], staffId: staffIdentity(a).id };
    return { studentIds: [] };
  };

  return { pushIdentity, leavesForStudent, allStudentLeaves, stripEventPrivateFields: (e: any) => { const { interestedUserIds, ...rest } = e || {}; return { ...rest, interestedCount: Array.isArray(interestedUserIds) ? interestedUserIds.length : 0 }; } };
}
