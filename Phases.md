# Phased Development Roadmap & Implementation Matrix

## RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
**Institutional ERP & Digital Campus Platform**

---

### Executive Baseline Audit

| Module / Subsystem | Current Implementation Status | Production Readyness | Primary Backing Model | Key Notes & Next Steps |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | ✅ Implemented & Working | High | `UserModel` | Multi-role login, JWT, bcrypt, account lockout, parent student switcher. |
| **Password Reset (Brevo)** | ✅ Implemented & Working | High | `UserModel`, Brevo API | REST v3 transactional dispatch, canonical frontend reset link generation. |
| **School Settings** | ✅ Implemented & Working | High | `SchoolSettingsModel` | Campus profile, CBSE affiliation code 10030206405, logo in R2. |
| **Academic Sessions** | ✅ Implemented & Working | High | `SchoolSettingsModel` | Session activation, context switching across portal views. |
| **Student Admission** | ✅ Implemented & Working | High | `StudentModel`, `UserModel` | Multi-step wizard, photo upload, preview, auto-parent credentials. |
| **Student Directory** | ✅ Implemented & Working | High | `StudentModel` | Filter by class/section/status, profile view, modal edit. |
| **Faculty & Staff** | ✅ Implemented & Working | High | `StaffModel`, `UserModel` | Onboarding, role assignment, portal credentials, ID cards. |
| **Classes & Sections** | ✅ Implemented & Working | High | `ClassModel` | Nursery to 12th, class teachers, section capacities. |
| **Subjects & Grading** | ✅ Implemented & Working | High | `SubjectModel`, `SchoolSettings` | Subject codes, theory/practical, 9-point grading scale. |
| **Master Timetable** | ✅ Implemented & Working | High | `TimetableSlotModel`, `TimetablePeriodModel` | 6-day matrix, period configs, teacher clash detection, PDF export. |
| **Attendance (Student)** | ✅ Implemented & Working | High | `AttendanceModel` | Class roster marking, Present/Absent/Late, SSE sync. |
| **Attendance (Staff)** | ✅ Implemented & Working | High | `StaffAttendanceModel` | Faculty presence logging, time-in/out, leave records. |
| **Fee Structures & Config** | ✅ Implemented & Working | High | `FeeStructureModel`, `ClassFeeConfigModel` | Monthly, yearly, general, exam, hostel, transport slabs, clone modal. |
| **Fee Ledgers & Billing** | ✅ Implemented & Working | High | `FeeLedgerModel` | Automated monthly dues generation, custom billing, balance tracking. |
| **Payment Collection** | ✅ Implemented & Working | High | `FeePaymentModel`, `FeeLedgerModel` | UPI, cash, cheque, discount, printable thermal/A4 receipt modal. |
| **Transport Management** | ✅ Implemented & Working | High | `TransportVehicleModel`, `TransportRouteModel`, `TransportSlabModel` | Vehicle registry, route mapping, student transit allocation. |
| **Hostel Management** | ✅ Implemented & Working | High | `HostelModel`, `HostelRoomModel` | Dormitory buildings, room capacity, bed allotment, hostel fee link. |
| **Exams & Marks Entry** | ✅ Implemented & Working | High | `ExamModel`, `ExamMarkModel` | Exam scheduling, roster marks entry, principal approval lock. |
| **Report Cards** | ✅ Implemented & Working | High | `ExamMarkModel`, `StudentModel` | CBSE scholastic & co-scholastic format, print isolation CSS. |
| **Communication / Notices** | ✅ Implemented & Working | High | `NoticeModel` | Targeted audience broadcast, priority tags, R2 attachments. |
| **Homework** | ✅ Implemented & Working | High | `HomeworkModel` | Daily homework assignment by class, subject, due dates. |
| **Study Materials** | ✅ Implemented & Working | High | `StudyMaterialModel` | Cloudflare R2 file uploads up to 25MB, subject-wise repository. |
| **ID Cards & Certificates** | ✅ Implemented & Working | High | Dynamic / Print Engine | Student ID cards with QR, Teacher ID cards, TC, Character certificates. |
| **Public Website CMS** | ✅ Implemented & Working | High | `PublicWebsite.ts` (7 models) | Hero slides, leadership carousel (3-card desktop/2 tablet/1 mobile, 3s auto-advance, dynamic dots, touch swipe), facilities, gallery, notices, events, content. |
| **Admission Enquiries** | ✅ Implemented & Working | High | `AdmissionEnquiryModel` | Public enquiry form on website, administrative enquiry tracker. |
| **Public Result Checker** | ✅ Implemented & Working | High | `ExamMarkModel`, `StudentModel` | Online public result check by admission number / roll number. |
| **Cloudflare R2 Storage** | ✅ Implemented & Working | High | `R2StorageService`, `FileMetadataModel` | Dual upload mode: Direct S3 presigned PUT with server stream gateway CORS fallback. |
| **Audit Logs** | ✅ Implemented & Working | High | `AuditLogModel` | Timestamped action logging across administrative mutations. |
| **Realtime Sync (SSE)** | ✅ Implemented & Working | High | Express SSE & `realtimeService` | Server-Sent Events with 250-event circular buffer, 15s keepalive heartbeat, and polling fallback. |
| **Render Production Deploy** | ✅ Implemented & Working | High | `render.yaml` | Static frontend + Node backend, rewrite `/* -> /index.html`. |

---

### Phase-by-Phase Roadmap

---

#### Phase 0: Existing System Audit & Baseline Verification
* **Objective:** Verify and document repository health, build pipelines, and production connectivity.
* **Status:** ✅ **COMPLETED**
* **Tasks:**
  1. Inspect complete codebase, routes, server middlewares, and database models.
  2. Run `compile_applet` to verify Vite and esbuild server bundling.
  3. Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
  4. Formulate authoritative project documentation (`PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `Memory.md`).
* **Dependencies:** None.
* **Completion Criteria:** All six core markdown documentation files committed to root; zero compilation or lint errors.

---

#### Phase 1: Authentication, RBAC & Session Security Hardening
* **Objective:** Ensure ironclad session security, multi-role access control, exactly three login experiences, and seamless password lifecycle management.
* **Status:** ✅ **COMPLETED & OPERATIONAL (VERIFIED 15/15 SUITE TESTS)**
* **Delivered Architecture:**
  1. **Three Dedicated Login Experiences:** (1) Staff / Admin common login, (2) Student portal login, (3) Parent portal login.
  2. **Common Staff / Admin Login:** One common login page authenticated by backend for all 10 roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`). No individual role login pages exist; frontend role selection is strictly forbidden.
  3. **Student Login:** Case-insensitive Admission / Registration Number + Date of Birth verification.
  4. **Parent Login:** Registered 10-digit mobile number + Child's Date of Birth, with instant multi-child session linking.
  5. **Password Management Lifecycle:**
     - Forgot Password flow with single-use SHA-256 hashed expiring token via Brevo Transactional Email API. No tokens or URLs leaked to client.
     - Admission confirmation and staff onboarding credentials dispatched via Brevo with secure instructions.
     - Authenticated user password change with current password verification and concurrent session invalidation.
     - Admin direct password reset with strict RBAC (Super Admin only can reset Principal/Admins; unauthorized resets rejected with HTTP 403).
     - Bcrypt 10 salt rounds hashing; zero plaintext password exposure.
* **APIs Involved:**
  - `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/switch-child`
  - `POST /api/auth/forgot-password`, `POST /api/auth/verify-reset-token`, `POST /api/auth/reset-password`, `POST /api/auth/change-password`
  - `POST /api/admin/reset-password-direct`, `POST /api/admin/send-login-details`, `POST /api/teachers/:id/reset-password`, `POST /api/students/:id/reset-password`
* **Database Impact:** `users`, `staff`, `students`, `parentAccounts` in MongoDB.
* **Testing Requirements:** Verified with `scripts/verify-auth-suite.ts` (15/15 tests passing) and `scripts/e2e-verification.ts`.

---

#### Phase 2: School Settings, Institutional Profile & Session Management
* **Objective:** Provide master institutional configuration and multi-year academic session context.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Ensure official school metadata (CBSE affiliation code 10030206405, Sheohar address, contacts) is populated across all report templates.
  2. Maintain academic session activation (`POST /api/academic-sessions/:id/activate`) and event broadcasting (`academic-session-changed`).
  3. Ensure school logo uploads persist to Cloudflare R2 (`school/school-logo/{uuid}.png`) and update portal brand headers.
* **APIs Involved:**
  - `GET /api/school-settings`, `PUT /api/school-settings`
  - `GET /api/academic-sessions`, `POST /api/academic-sessions`, `POST /api/academic-sessions/:id/activate`
* **Database Impact:** `school_settings` collection.
* **Testing Requirements:** Update school phone number and verify immediate change in top bar and public footer.

---

#### Phase 3: Student Admission & Student Management Lifecycle
* **Objective:** End-to-end student administration from intake to graduation.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Maintain multi-step admission wizard (`StudentAdmissionModal.tsx`) with real-time field validation (strict date-of-birth format `DD-MM-YYYY`).
  2. Maintain auto-generation of sequential Admission Numbers (e.g. `PDS-2026-0001`) via `/api/students/next-numbers`.
  3. Ensure linked parent portal account creation upon student admission.
  4. Verify student photo upload with client-side downsampling and Cloudflare R2 persistence.
  5. Provide detailed student profile inspection and editing with audit trail.
* **APIs Involved:**
  - `GET /api/students`, `POST /api/students`, `GET /api/students/:id`, `PUT /api/students/:id`, `PATCH /api/students/:id/status`, `DELETE /api/students/:id`
  - `GET /api/students/next-numbers`, `GET /api/students/stats`
* **Database Impact:** `students`, `users`, and `file_metadata` collections.
* **Testing Requirements:** Create a new student with photo upload; confirm parent credentials generated; verify presence in student roster.

---

#### Phase 4: Faculty & Staff Directory, Biometrics & Payroll Preparation
* **Objective:** Personnel management for educators, administrators, and operational staff.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Maintain employee directory with designation, department, qualification, salary, and contact information.
  2. Manage staff portal credentials (`/api/teachers/:id/portal-status`, `/api/teachers/:id/reset-password`).
  3. Generate official Staff ID Cards (`TeacherIdCard.tsx`).
  4. Record daily faculty attendance and leave balances (`StaffAttendanceModel`).
* **APIs Involved:**
  - `GET /api/staff`, `POST /api/staff`, `PUT /api/staff/:id`, `DELETE /api/staff/:id`
  - `GET /api/staff-attendance`, `POST /api/staff-attendance`
* **Database Impact:** `staff`, `staff_attendance`, and `users` collections.
* **Testing Requirements:** Onboard a new teacher; verify credential generation and portal login; test staff attendance logging.

---

#### Phase 5: Academic Structure (Classes, Sections, Subjects & Grading)
* **Objective:** Grade hierarchy, classroom sections, subject curricula, and CBSE grading thresholds.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Configure classes from Nursery to Grade 12 with numeric ordering.
  2. Configure sections with room numbers, capacities, and assigned Class Teachers.
  3. Maintain subject catalog with subject codes, credit hours, and Theory/Practical breakdown.
  4. Maintain CBSE 9-point grading scale (A1 to E2) via `GradingSystemModal.tsx`.
* **APIs Involved:**
  - `GET /api/classes`, `POST /api/classes`, `PUT /api/classes/:id`, `DELETE /api/classes/:id`
  - `GET /api/subjects`, `POST /api/subjects`, `PUT /api/subjects/:id`, `DELETE /api/subjects/:id`
* **Database Impact:** `classes` and `subjects` collections.
* **Testing Requirements:** Add a new subject; assign it to a class; verify availability in marks entry roster.

---

#### Phase 6: Student & Staff Attendance Tracking
* **Objective:** Daily roster attendance recording, monthly percentage computation, and attendance alerts.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Quick class roster attendance entry with bulk "Mark All Present" toggle.
  2. Support status values: `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `EXCUSED_LEAVE`.
  3. Broadcast attendance marking events via SSE to update dashboard statistics instantly.
  4. Provide attendance summary statistics on student report cards and parent portals.
* **APIs Involved:**
  - `GET /api/attendance`, `POST /api/attendance`
  - `GET /api/staff-attendance`, `POST /api/staff-attendance`
* **Database Impact:** `attendance` and `staff_attendance` collections.
* **Testing Requirements:** Mark attendance for a section; verify monthly attendance percentage calculation for enrolled students.

---

#### Phase 7: Weekly Master Timetable & Scheduling Engine
* **Objective:** Six-day classroom period scheduling with conflict prevention and PDF export.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Standard period timing configuration (Period 1-8, Assembly, Lunch) via `timetable_periods`.
  2. Grid-based schedule editor with teacher conflict validation.
  3. Class-wise and Teacher-wise timetable views.
  4. Printable and downloadable PDF timetable matrix via `timetablePdf.ts`.
* **APIs Involved:**
  - `GET /api/timetables`, `POST /api/timetables`, `PUT /api/timetables/:id`, `DELETE /api/timetables/:id`, `POST /api/timetables/bulk`
  - `GET /api/timetables/periods`, `POST /api/timetables/periods`
* **Database Impact:** `timetable` and `timetable_periods` collections.
* **Testing Requirements:** Schedule two periods; verify collision warning if the same teacher is scheduled concurrently; test PDF export.

---

#### Phase 8: Fees & Fee Collection, Invoicing, Receipting & Ledgers
* **Objective:** Institutional financial management, automated monthly dues, payment gateway/counter collection, and thermal receipts.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Class-wise fee structure templates (Tuition, Exam, Lab, Library, Sports).
  2. Distance-based transport fee slabs manager (`TransportSlabsManager.tsx`).
  3. Copy Fee Config Modal: Clone fee settings from one class to all classes.
  4. Automated monthly fee ledger batch generation (`/api/fee-ledgers/generate-monthly`).
  5. Counter payment collection supporting partial payments, waivers, and multiple payment modes (`CollectPaymentModal.tsx`).
  6. Instant generation of standardized printable receipts (`PrintableReceiptModal.tsx`).
* **APIs Involved:**
  - `GET /api/fees/structures`, `POST /api/fees/structures`, `PUT /api/fees/structures/:id`, `DELETE /api/fees/structures/:id`
  - `GET /api/fee-configurations`, `POST /api/fee-configurations`, `PUT /api/fee-configurations/:id`
  - `GET /api/transport-slabs`, `POST /api/transport-slabs`, `PUT /api/transport-slabs`
  - `GET /api/fee-ledgers`, `POST /api/fee-ledgers/generate-monthly`, `POST /api/fee-ledgers/:id/collect`, `POST /api/fee-ledgers/bill`
  - `GET /api/fees/payments`
* **Database Impact:** `fee_structures`, `fee_configurations`, `transport_slabs`, `fee_ledgers`, `fee_payments` collections.
* **Testing Requirements:** Generate monthly ledgers; record a partial cash payment; verify receipt rendering; inspect updated balance.

---

#### Phase 9: Transport & Hostel Management
* **Objective:** School fleet route coordination and residential hall administration.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Maintain vehicle registry (buses, vans, driver and conductor credentials, fitness dates).
  2. Map route stops with pickup times and bind distance slabs.
  3. Manage hostel buildings, room inventory, dorm capacities, and bed allotments.
  4. Automatically link transport slab fees and hostel room fees to the student's monthly fee ledger.
* **APIs Involved:**
  - `GET /api/transport`, `POST /api/transport/allocate`
  - `GET /api/hostels`, `POST /api/hostels/allocate`
* **Database Impact:** `vehicles`, `routes`, `transport_slabs`, `hostels`, `hostel_rooms` collections.
* **Testing Requirements:** Allocate a student to a bus route and a hostel room; verify dues reflected on their fee profile.

---

#### Phase 10: Exams, Marks Entry & CBSE-Compliant Report Cards
* **Objective:** Assessment scheduling, marks tabulations, principal approvals, and high-fidelity report cards.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Schedule exams with session, class, and date boundaries.
  2. Tabular marks entry interface with maximum mark validation and teacher remarks.
  3. Principal marks approval locking (`PUT /api/exams/:id/approve`).
  4. Printable CBSE Report Card Modal (`PrintableReportCardModal.tsx`) featuring scholastic grades, co-scholastic assessments, discipline, attendance %, and digital signature placeholders.
* **APIs Involved:**
  - `GET /api/exams`, `POST /api/exams`, `PUT /api/exams/:id`, `PUT /api/exams/:id/approve`, `DELETE /api/exams/:id`
  - `GET /api/marks`, `POST /api/marks`
* **Database Impact:** `exams` and `exam_marks` collections.
* **Testing Requirements:** Enter marks for an exam; approve exam; open report card; verify grade calculations and print preview.

---

#### Phase 11: Communication Center, Official Circulars & SMS Broadcast Gateway
* **Objective:** Comprehensive institutional circulars, SMS gateway dispatch, multi-channel automated triggers, homework, and cloud-backed study material downloads.
* **Status:** ✅ **COMPLETED, VERIFIED & OPERATIONAL** (41/41 Automated Tests Passed)
* **Tasks:**
  1. Complete circular CRUD with draft/publish status, priority levels (`NORMAL`, `IMPORTANT`, `URGENT`), and dynamic expiration.
  2. Audience targeting (`ALL`, `STUDENTS`, `PARENTS`, `STAFF`, `CLASS`, `INDIVIDUAL`) with strict backend RBAC visibility enforcement.
  3. SMS Management Center (`SmsCenterTab`) featuring live provider telemetry, sender ID (`PDSSHR`), and quick triggers.
  4. Quick SMS Triggers for Daily Absentees, Overdue Fee Reminders, Exam Schedules, Admit Cards Published, Results Declared, and Emergency Advisories.
  5. Live Quick Trigger Preview (`GET /api/sms/quick-triggers/preview`) calculating valid 10-digit Indian numbers, already-sent daily counts, and resolved message previews.
  6. Custom SMS Composer (`SmsComposerModal`) supporting all parents, classes, individual students, or manual phone numbers with live character & credit unit calculations.
  7. Strict server-side MongoDB idempotency protection (`idempotencyKey` unique index in `sms_logs`), preventing duplicate billing or sends upon refresh or retry.
  8. Persistent SMS Audit History (`SmsHistoryTab`) and detail inspection (`SmsLogDetailsModal`) in MongoDB Atlas.
  9. Automatic Notification Pipelines (`AutoNotificationsTab`) across Exam publication, Admit Card downloads, Result declarations, Monthly Fee overdue runs, and Daily Roll Call absentees.
  10. Cloudflare R2 file attachments for official circulars with direct modal previews and downloads.
  11. Clean, professional UI free of marketing copy, explanatory fluff, or instructional paragraphs.
* **APIs Involved:**
  - `GET /api/notices`, `POST /api/notices`, `PUT /api/notices/:id`, `DELETE /api/notices/:id`, `POST /api/notices/cleanup-duplicates`
  - `GET /api/sms/stats`, `GET /api/sms/history`, `GET /api/sms/quick-triggers/preview`, `POST /api/sms/quick-triggers/dispatch`, `POST /api/sms/send`
  - `GET /api/homework`, `POST /api/homework`, `PUT /api/homework/:id`, `DELETE /api/homework/:id`
  - `GET /api/study-materials`, `POST /api/study-materials`, `DELETE /api/study-materials/:id`
* **Database Impact:** `notices`, `sms_logs`, `homework`, `study_materials`, `file_metadata` collections in MongoDB Atlas.
* **Testing Requirements:** Run `npx tsx scripts/verify-communication-center.ts` (verifies RBAC, draft privacy, dynamic expiration, preview calculations, SMS dispatch, idempotency duplicate prevention, invalid phone safety, history query, and auto-circular generation across exam/admit/result lifecycles). All 41 tests pass.

---

#### Phase 12: Public Website CMS, SEO & Admission Enquiries Portal
* **Objective:** CBSE-compliant public web presence, online enquiry intake, and public board result checker.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Maintain public landing page components (Hero carousel, About, Academics, Facilities, Management, Gallery, Contact, Footer).
  2. Admin CMS view (`PublicWebsiteManagementView.tsx`) allowing full editing of hero slides, leadership team, facilities, and photo gallery.
  3. Online Admission Enquiry Desk (`QuickEnquiryModal.tsx`) logging directly to `admission_enquiries` collection with administrative status tracking (`NEW`, `CONTACTED`, `ADMITTED`, `REJECTED`).
  4. Public Result Verification Portal (`/results`) allowing roll number / admission number lookup.
  5. CBSE Mandatory Public Disclosure modal displaying legal affiliation documents.
* **APIs Involved:**
  - `GET /api/public/content`, `PUT /api/public/content`
  - `GET /api/public/hero-slides`, `POST /api/public/hero-slides`, `PUT /api/public/hero-slides/:id`, `DELETE /api/public/hero-slides/:id`
  - `GET /api/public/leadership`, `POST /api/public/leadership`, `PUT /api/public/leadership/:id`, `DELETE /api/public/leadership/:id`
  - `GET /api/facilities`, `POST /api/facilities`, `PUT /api/facilities/:id`, `DELETE /api/facilities/:id`
  - `GET /api/gallery`, `POST /api/gallery`, `PUT /api/gallery/:id`, `DELETE /api/gallery/:id`
  - `POST /api/public/enquiry`, `GET /api/enquiries`, `PUT /api/enquiries/:id`
* **Database Impact:** 7 public website collections in MongoDB.
* **Testing Requirements:** Submit an enquiry on public website; verify it appears in admin enquiry queue; verify CMS slide updates.

---

#### Phase 13: Documents, ID Cards, Certificates & PDF Generation
* **Objective:** Official institutional documents with QR verification and print isolation.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. Student ID Cards: Double-sided layout with student photo, barcode/QR code, blood group, address, and principal signature.
  2. Batch Student ID Card Export: Generate printable sheet or multi-page PDF for entire class via `idCardPdfExporter.ts`.
  3. Teacher ID Cards: Staff credentials format with employee ID.
  4. Official Certificates (`PrintableCertificateModal.tsx`):
     - Transfer Certificate (TC)
     - Character Certificate
     - Bonafide / Enrolment Certificate
  5. Print isolation styling: CSS rules in `src/index.css` hiding application navigation chrome during browser print (`Ctrl+P`).
* **APIs Involved:** Utilizes existing Student, Staff, and School Settings endpoints.
* **Database Impact:** None (dynamic document compilation).
* **Testing Requirements:** Trigger batch ID card print; verify print preview isolates cards; scan generated QR code to verify student data.

---

#### Phase 14: Production Hardening, Audit Logging, Render CI/CD & Performance
* **Objective:** Production reliability, audit compliance, security safeguards, and sub-second response times.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Continuous Hardening Tasks:**
  1. Maintain Render multi-service configuration in `render.yaml`.
  2. Authoritative Persistence Architecture: Staff Leaves (`staff_leaves`), Staff Payroll (`staff_payroll`), and Security Audit Logs (`audit_logs`) are fully backed by dedicated MongoDB collections with REST APIs (`/api/staff-leaves`, `/api/staff-payroll`, `/api/audit-logs`), client sync handlers, and optimistic caching.
  3. Admin account deletion (`DELETE /api/admin/accounts/:id` and `/api/admin/admins/:id`) synchronizes immediately with MongoDB `users` collection.
  4. Timetable configuration (working days, school timings, periods) and subject assignments persist cleanly to MongoDB without data loss.
  5. Monitor MongoDB Atlas index coverage for high-throughput queries (`students`, `users`, `fee_ledgers`, `staff_leaves`, `staff_payroll`).
  6. Maintain in-memory buffer caching on `/api/files/content` to maximize image delivery speed.
  7. Preserve strict SPA rewrite rules (`/* -> /index.html`) on Render static frontend.
* **APIs Involved:** `GET/POST /api/audit-logs`, `GET/POST/PUT /api/staff-leaves`, `GET/POST /api/staff-payroll`, `DELETE /api/admin/accounts/:id`, `GET /api/health`, `GET /api/files/storage-status`.
* **Testing Requirements:** Run `scripts/e2e-verification.ts` and `scripts/verify-mongodb-crud.ts` to ensure 100% test pass rate.

---

#### Phase 15: Class Teacher Assignment & Attendance Workflow Hardening
* **Objective:** Complete lifecycle consistency from Teacher assignment in staff registry to dynamic attendance defaulting, student roster loading, and atomic MongoDB upserting.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. *Dynamic MongoDB Active Classes:* Teacher forms (`AddStaffPageView`, `EditStaffPageView`, `AddStaffModal`) dynamically pull and synchronize active classes and sections via `api.syncClasses()`. Inactive and archived classes/sections are strictly excluded.
  2. *Teacher Assignment Persistence:* Persist both `classTeacherOf` string and structured `teachingProfile` in MongoDB Atlas (`staff` collection), mirrored to `classes` (`classTeacherId`).
  3. *Attendance Auto-Defaulting:* `/api/attendance/assigned-classes` computes assigned classes/sections for teachers. The Attendance module defaults to the teacher's active assignment automatically and reactively updates on assignment changes via SSE.
  4. *Dynamic Student Roster:* Selected class/section loads enrolled students dynamically from MongoDB Atlas.
  5. *Existing Attendance Loading & Atomic Upsert:* Existing records for same date + class + section load into UI; edits perform atomic upserts without duplicate records.
  6. *Strict RBAC Authorization:* Teachers attempting unauthorized access to unassigned classes/sections are blocked with HTTP 403 Forbidden.
* **APIs Involved:** `GET /api/classes`, `PUT /api/teachers/:id`, `GET /api/attendance/assigned-classes`, `GET /api/students`, `GET/POST /api/attendance`.
* **Testing Requirements:** Run `scripts/verify-teacher-assignment-attendance.ts` (33/33 tests pass, 100%).

---

#### Phase 16: Institutional Certificate & TC PDF Rendering Hardening
* **Objective:** Ensure Character Certificate, Bonafide Certificate, and Transfer Certificate (TC) render with high-fidelity typography, natural word-flow, zero gap stretching, authentic student photo reproduction, and balanced A4 page layout in both preview and downloaded PDF.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. *Transfer Certificate (TC) Profile Photo Fidelity:*
     - Student profile photo resolved dynamically via multi-strategy loader (DOM canvas extraction, local storage, Cloudflare R2, and remote CORS proxy).
     - Natural aspect ratio (4:5 passport proportions) preserved with zero vertical stretching or squishing.
     - Async resolution preloaded and awaited before PDF download starts, eliminating placeholder boxes.
  2. *Character & Bonafide Paragraph Flow:*
     - Implemented custom `renderJustifiedParagraph` to replace native jsPDF justification.
     - Standard inter-word spacing applied only to intermediate lines; terminal lines of paragraphs are strictly left-aligned naturally.
     - Zero manual hardcoded line breaks inside sentences.
  3. *Page Space Balancing:*
     - Eliminated arbitrary Y-coordinate jumps and central blank voids.
     - Structured Institutional Record Verification Box (32mm) with dual-column verified metadata.
     - Embossed official seal stamp guide ring positioned harmoniously above the signatures block.
     - Three signature columns: Prepared By (Admin), Checked by Registrar, and Principal (with signature image).
  4. *Strict 1 A4 Page Fit:*
     - Both preview modal and exported PDF strictly fit onto exactly one A4 portrait page.
* **APIs Involved:** `GET /api/students/:id`, `GET /api/settings`, `GET /api/files/content`, `GET /api/files/image-proxy`.
---

#### Phase 17: Permanent Dynamic Fee Structure, Student Admission & Overdue Billing Engine Hardening
* **Objective:** Establish permanent institutional fee rules, dynamic MongoDB class fee structures, admission-time one-time fee billing, and overdue monthly late fee engine for RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR.
* **Status:** ✅ **COMPLETED & OPERATIONAL**
* **Tasks:**
  1. *Admission Form Default Fee Selection:*
     - 6 Required Fee Heads checked by default: Admission Fee, School Fee, Exam Fee, Uniform / Dress Code, Books & Stationery, ID Card Fee.
     - Optional Heads (Tuition, Computer, Sports, Medical, Transport, Hostel) unchecked by default unless opted in or mandatory.
     - Staff can manually adjust amounts or uncheck heads for approved scholarships or waivers.
     - Saved admission data and drafts are never overwritten by defaults.
  2. *Dynamic Class-Wise Fee Structure:*
     - Loaded dynamically from MongoDB `fee_configurations` via `ClassFeeConfigModel`.
     - Changing class immediately reloads the correct fee structure and updates fee totals.
     - Dynamic calculations for Admission Payable, Monthly Payable, Annual/Exam Dues, and Session Total.
     - Selected fee profile persisted directly into student record (`feeProfile`).
  3. *Admission-Time Payment:*
     - Dedicated one-time admission invoice generated immediately upon student intake.
     - Clear "Pay Admission Fee" action in admission workflow.
     - Supports Cash, UPI, Bank Transfer, Cheque, partial payments, and official receipt generation (`REC-2026-XXXX`).
     - Real-time MongoDB persistence and receipt display; idempotent duplicate prevention.
  4. *Monthly Fee Due Date & Overdue Late Fee Engine:*
     - Monthly billing begins from student's actual Enrollment Date; enrollment month is not billed as a full monthly charge.
     - First monthly installment becomes due in the subsequent month (e.g., student enrolled 11 September -> first monthly installment due 10 October).
     - Payable window: 1st through 10th of each applicable month.
     - Starting on 11th: exactly ₹50 late fee applied once per overdue monthly invoice (`lateFeeApplied: true`).
     - Fully paid invoices receive zero late fee; partial payments correctly calculate remaining balance.
     - Configurable penalty via `schoolSettings.feeSettings.lateFeeAmount`.
     - Standard institutional timezone `Asia/Kolkata`.
* **APIs Involved:** `POST /api/students`, `GET/POST /api/fee-ledgers`, `POST /api/fee-ledgers/:id/collect`, `POST /api/fee-ledgers/generate-monthly`, `GET /api/fee-configurations`.
* **Testing Requirements:** Run `scripts/verify-admission-fee-billing-permanent.ts` (100% assertions pass).

---

#### Phase 18 (Mobile Phase 1): React Native Mobile Application Setup, Login & Authorized Modules
* **Objective:** Establish the production React Native mobile application for RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR, connecting directly to the live backend on Render (`https://residentialpdsschool.onrender.com`), supporting all three core login flows (Admin/Staff, Student, Parent), and enforcing strict backend RBAC module navigation.
* **Status:** ✅ **COMPLETED & OPERATIONAL (20/20 TESTS PASSED)**
* **Delivered Architecture:**
  1. *Mobile Workspace & Setup:*
     - Located in `/mobile` with clean Expo/React Native configuration, native Android project scaffold (`/mobile/android`), verified image assets (`/mobile/assets/icon.png`, `splash.png`, `adaptive-icon.png`), and independent TypeScript tooling.
     - Root React web ERP remains isolated and unaffected (`npm run build` and `npm run lint` succeed with 0 errors).
  2. *Three Dedicated Mobile Login Flows:*
     - **Admin/Staff Common Login:** All 10 staff roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`) authenticate through one common screen without client-side role dropdowns. Role and permissions are resolved by the server.
     - **Student Login:** Case-insensitive Admission Number + Date of Birth (DD-MM-YYYY).
     - **Parent Login:** 10-digit registered mobile number + Child DOB/Password with active multi-child sibling switching.
  3. *Authorized Dashboard & Module Navigation:*
     - Role-based module cards rendered dynamically according to backend RBAC permissions (`/mobile/src/utils/rbac.ts`).
     - Distinct portals for Staff/Admin, Students, and Parents.
     - Functional module view (`ModuleDetailScreen.tsx`) retrieving live authorized student, staff, notice, and institutional records from backend endpoints with resilient array unpacking.
  4. *Security & Cold-Start Resilience:*
     - Graceful handling of Render cold starts with retry mechanics and visual status banner.
     - Storage adapter (`authStorage.ts`) with token caching, cache recovery on `getUser()`, and clean invalidation upon logout.
  5. *Expo EAS Build Configuration (`mobile/eas.json`, `mobile/app.json`, `.easignore`):*
     - Verified official EAS configuration format with `cli.version: ">= 14.8.1"` and `cli.appVersionSource: "remote"`.
     - `preview` profile configured for internal Android APK testing (`distribution: "internal"`, `android.buildType: "apk"`).
     - `production` profile configured for Google Play Store AAB builds (`android.buildType: "app-bundle"`).
     - Integrated existing EAS Project ID `57c1b58e-2ffd-4a9b-9f51-0e118957f254` into `expo.extra.eas.projectId`.
     - Configured `owner: "decodewithrohits-team"` and `slug: "residentialpdsschool"` in `mobile/app.json` matching `@decodewithrohits-team/residentialpdsschool`.
     - Added `.easignore` ignoring partial native directories to enforce clean Managed Expo Prebuild on EAS Cloud.
     - `com.pds.schoolerp` Android package, assets, and backend configuration preserved. No synthetic credentials created.
* **Testing & Commands:**
  - Automated Suite: `npm run mobile:test` (20/20 assertions passed).
  - Mobile Typecheck: `npm run mobile:lint` (0 errors).
  - Root Web Linter: `npm run lint` (0 errors).
  - Dev Runner: `cd mobile && npm start`
  - Android Run: `cd mobile && npm run android`
  - EAS Preview APK Build: `cd mobile && eas build --profile preview --platform android`
  - EAS Production AAB Build: `cd mobile && eas build --profile production --platform android`
  - EAS Build Status Investigation (`613fb0a6-488d-4b65-be74-f17afc435e8c`): Resolved root cause where trailing slash in `.easignore` (`android/`) allowed the empty/partial `android` folder into the EAS upload archive, which triggered bare `gradlew` execution on EAS Cloud. Fixed `.easignore` with directory and glob rules (`android`, `android/**`); verified with EAS shallow-copy packager that `android` is 100% excluded so EAS Cloud invokes official Managed Expo SDK 52 Prebuild.




* **Phase 1 Part 2 (Expo & Android Build Verification):**
  - **Expo Configuration Validation:** Validated `mobile/app.json` (`com.pds.schoolerp`, SDK 52.0.0, platforms `ios`/`android`/`web`, splash, adaptive icon, and EAS projectId `57c1b58e-2ffd-4a9b-9f51-0e118957f254`) with 0 warnings.
  - **Asset Verification:** All 15 bundled assets (5 TTF font files in `assets/fonts/`, 10 PNG icons in `assets/icons/`, adaptive icon, splash, app icon) present and verified.
  - **Metro Android Bundling:** Executed `expo export --platform android` which successfully bundled 616 modules (Hermes bytecode `.hbc` 1.88 MB) with all 15 assets in 21.8s.
  - **Environment Build Capability:** Inspected container environment for native Android compilation tools. JDK 17, Android SDK (`$ANDROID_HOME`), and Gradle are absent (`JAVA: none, JAVAC: none, ANDROID_HOME: none, GRADLE: none`). Local Android APK build (`./gradlew assembleRelease` or `expo run:android`) must be executed on a workstation with Android Studio/SDK or via EAS Cloud Build.
  - **Commands for Local Computer Build:**
    - Development: `cd mobile && npm install && npx expo start`
    - Native Android Device/Emulator: `cd mobile && npx expo run:android`
    - EAS Cloud APK Build: `cd mobile && eas build --platform android --profile preview`
  - **Login Screens & Dashboard Navigation:** Verified 3 distinct authentication flows (`StaffLoginForm`, `StudentLoginForm`, `ParentLoginForm`) and dashboard routing (`DashboardScreen`, `TeacherDashboardScreen`, `StudentDashboardScreen`, `ParentDashboardScreen`) with RBAC enforcement and token storage isolation.
  - **Test Suite Pass Rate:** `npm run mobile:test` passed 20/20 (100%) against live Render backend; `mobile:lint` passed 0 errors; web ERP build (`npm run build`) passed 100%.

---

#### Phase 19 (Mobile Phase 2–3): Shared Mobile UI Foundation & Teacher Dashboard
* **Objective:** Improve shared mobile UI primitives and rebuild the Teacher dashboard on the live Teacher Portal contracts, without backend, schema or dependency changes.
* **Delivered:**
  - `mobile/src/screens/TeacherDashboardScreen.tsx`: teacher dashboard bound to `GET /api/teacher/dashboard-summary` (metrics, today's timetable with status, assigned sections with attendance status, pending attendance/marks tasks, upcoming exams, leave balance, notices). Quick actions are shown only for modules the user is authorized to open.
  - `mobile/src/services/apiService.ts`: `getTeacherDashboardSummary()` and `getTeacherAuthorizedAssignments()`. The existing `getDashboardSummary()` (`/api/dashboard/summary`) is unchanged.
  - `mobile/src/types/teacher.ts`: response contracts mirroring the server handlers.
  - `mobile/src/utils/teacherAssignments.ts`: UI-only assignment index built from `GET /api/teacher/authorized-assignments`. It never grants access; the server remains authoritative.
  - `mobile/src/components/ui/` (`StateView`, `SectionCard`, `StatTile`): shared loading, empty, error and retry states and card primitives.
  - `DashboardScreen` routes the TEACHER role to the new screen and no longer calls the unscoped `/api/timetables` for teachers.
  - `mobile/src/types/react-native.d.ts`: added missing accessibility and ellipsize prop typings (type-only). Cleared 12 pre-existing typecheck errors.
* **Known backend finding (not changed):** `GET /api/timetables` returns slots for all teachers to any authenticated caller. Teacher-facing timetable screens should use `GET /api/teacher/timetable`, which is teacher-scoped.
* **Testing & Commands:**
  - Mobile typecheck: `cd mobile && npx tsc --noEmit` (0 errors).
  - Android bundle: `npx expo export --platform android` (574 modules, builds).
  - Assignment helper unit checks: `npx tsx test/verify-teacher-assignments.ts` (9/9).
  - Contract check against a local backend (in-memory fallback, seed data, locally signed test token): response shapes of both teacher endpoints match the mobile types. Production was not reachable from the verification environment.
  - Existing `npm test` suite: 4/20 passing, unchanged from before this phase. Failures are network (production host unreachable from the verification environment) and RBAC module-ID expectations that predate this phase.

#### Phase 20 (Mobile Phase 4, partial): Teacher Modules — My Students, Scoped Pickers, Teacher Timetable (uncommitted)
* **Delivered:**
  - `mobile/src/screens/MyStudentsScreen.tsx`: students of the teacher's assigned sections only. Sections come from `GET /api/teacher/authorized-assignments`; rosters come from `GET /api/students?classId&section` (server returns 403 for any other section). Search, section chips, and expandable details.
  - `mobile/src/utils/teacherScope.ts` + `teacherScopeRules.ts`: class, section and subject pickers for teachers are filtered to server assignments. Fail-closed: if assignments can't be verified, the picker is empty and an error is shown.
  - `StudentAttendanceScreen` and `MarksEntryScreen`: pickers use the scoped loader. Other roles are unchanged.
  - `TimetableScreen`: teachers use `GET /api/teacher/timetable` (teacher-scoped) instead of unscoped `/api/timetables`.
  - `AppNavigator`: the `students` module opens My Students for TEACHER; other roles keep the generic module view.
  - `apiService.ts`: `getTeacherTimetable()`, `getStudentsForSection()`.
  - `react-native.d.ts`: type-only additions (FlatList, accessibility state/label props).
* **Not covered in this phase:** Profile, ID card, and Staff attendance (teachers are excluded) were not reworked. The existing screens were not audited in depth.
* **Testing & Commands:**
  - Mobile typecheck: 0 errors. Android bundle: builds (577 modules).
  - Offline unit checks (`npx tsx test/verify-teacher-assignments.ts`): 14/14.
  - Local backend (seed data, locally signed test token): assigned section returns 200; unassigned section and unassigned class return 403.
  - Existing `npm test`: 4/20, unchanged from baseline (network and outdated RBAC expectations).
  - expo-doctor: 14/18, unchanged from baseline (network checks and intentionally absent lock file).

#### Phase 21 (Mobile Phase 5): Teacher Profile, ID Card & Own Staff Attendance Audit (uncommitted)
* **Delivered (mobile only):**
  - `mobile/src/screens/TeacherProfileScreen.tsx`: teacher's real profile from `GET /api/teacher/dashboard-summary` (teacher block only). Employee ID prefers the signed-in session value. Missing fields show "Not recorded". Loading, error with retry, and stale-data banner states. A read-only "My attendance" section for the current month. Only the teacher's own records are counted, and an empty month shows a no-record state. Routed from the `profile` case for TEACHER only; other roles keep `ProfileScreen`.
  - `mobile/src/screens/MyIdCardScreen.tsx` (shared by roles that use it): removed invented fallbacks (`PDS-STAFF` employee ID, `Academic Instruction` department, school phone as staff phone, role enum as designation, login username as employee ID). Removed the silent fallback to session-built card on API failure; now shows the real error with retry. Identifier comes only from the signed-in session. Print/download is stated as web-only, because the mobile project has no print or sharing packages.
  - `mobile/src/utils/teacherProfileRules.ts`: pure rules (own identifier, ID card view model, own-attendance summary).
  - `mobile/test/verify-teacher-profile.ts`: offline checks for no invented values, own-record filtering, and role isolation (teacher cannot open the staff-attendance module).
  - `AppNavigator.tsx`: `profile` case routes TEACHER to the new screen.
* **Staff attendance audit result:** the mobile RBAC excludes teachers from the admin staff-attendance module. The server POST `/api/staff-attendance` rejects teachers (admin roles only). The server GET filters teacher tokens to own records (verified: teacher token returned 0 rows, no other staff rows).
* **Backend security findings (NOT changed in this phase; need a decision):**
  1. `GET /api/teachers` and `GET /api/staff` return every staff record with no authentication check. Verified on a local backend with seed data: unauthenticated request returned 17 records. The returned objects include password-hash and initial-password fields and salary fields. A teacher token receives the same full list.
  2. `GET /api/teachers/:id` (and `/api/staff/:id`) has no authorization check. Verified: a teacher token received another teacher's full record (HTTP 200).
  3. `GET /api/staff-attendance` has no authentication requirement. Without a token, the server returns all records. The web client calls this path at line 768 without a token, so a server fix needs checking against that web path first.
  4. `GET /api/teacher/dashboard-summary` and the ID card handler substitute defaults (`PDS0001`, `Teacher / Faculty`, `ACADEMICS`) when a teacher record lacks a value. These can read as another employee's data. The mobile profile prefers the session employee ID, but the defaults remain on the server.
  5. Own ID card (`/api/teachers/:id/id-card`) correctly returns 403 for another teacher's ID and 200 for the teacher's own (verified).
  Recommended fix (not applied): require `requireAuth` on items 1–3, return a sanitized staff projection (no password, salary, or bank fields) for non-admin roles, and limit single-record reads to the owner or admin roles. Because the web admin uses some of these routes, apply and test this as a separate, reviewed change. Staff credentials exposed through item 1 should be treated as compromised and reset.
* **Testing & Commands:**
  - `npx tsx test/verify-teacher-profile.ts`: 21/21.
  - `npx tsx test/verify-teacher-assignments.ts`: 14/14.
  - Mobile typecheck: 0 errors. Root typecheck: 0 errors.
  - `npx expo export --platform android`: builds (579 modules).
  - Existing `npm test`: 4/20 (unchanged; network and outdated RBAC expectations).
  - expo-doctor: 14/18 (unchanged).
  - Local backend (seed data, locally signed token): the server results above. Screens were not rendered on a device or emulator, and production was not reached.

#### Phase 22 (Mobile): Payroll, Attendance, Sidebar, Cache & ID Card Fixes (uncommitted)
* **Root causes found and fixed (mobile only):**
  - **My Payroll:** the screen called `rec.grossSalary.toLocaleString()` but the server field is optional (render crash); it read `deductionsTotal`/`allowancesTotal` while the server sends `totalDeductions`/`totalAllowances` (Deductions always showed 0); it read `paymentMode` while the server sends `paymentMethod`, and defaulted to "Bank Transfer"; it sent `user.employeeId || user.id`, where `user.id` is not the staff id. Now uses `GET /api/staff-payroll/my-salary` (identity from the session), normalizes records in `utils/payrollRules.ts`, shows "—" for missing amounts, and keeps only the signed-in user's own records as a second guard. 401/403/network errors have distinct messages.
  - **Student Attendance:** unmarked students defaulted to PRESENT at load and at submit; "Clear / Reset" actually marked everyone ABSENT. Now no status is preselected, a Marked/Unmarked count is shown, submit is disabled until everyone is marked, saved records are labelled "Saved", and a failed load of saved records blocks submit so existing data cannot be overwritten blindly. Stale responses from an older class/date selection are ignored. Rules in `utils/attendanceRules.ts`.
  - **Sidebar/header:** the hamburger was hidden on every screen that shows a Back button. Header now shows Back and menu together (40px targets). Assignment module removed from `MOBILE_MODULES` (all roles) and from the teacher/student grids; backend assignment data untouched. Removed "Production Server Connected (Render)", "Mobile Portal v1.0", the duplicated school name in the drawer, and "Sign Out from Device".
  - **Duplicate requests:** Dashboard, My Students, Marks Entry and Attendance each fetched `authorized-assignments`. Now shared through a 60-second, token-keyed cache with in-flight de-duplication (`utils/requestCache.ts`); failures are never cached; pull-to-refresh on the dashboard forces a fresh request; logout clears it.
  - **My ID Card:** removed hardcoded Blood Group "B+ (Verified)", hardcoded principal name, a fake QR glyph with a "biometric" claim, a hardcoded "2026-2027" badge and an unverified NFC/RFID note. Blood group and principal name now appear only if present in the saved record / school settings.
* **Tests:** `test/verify-payroll-attendance.ts` (39), `test/verify-request-cache.ts` (8), `test/verify-teacher-portal-audit.ts` (28). `npm run test:offline` runs all offline suites. `verify-home-redesign.ts` expectation updated because the Assignment module was removed on request.
  - **My ID Card redesign:** the mobile card now follows the website `TeacherIdCard.tsx` layout (340x540 design scaled to the screen), front and back, with a tap-to-flip (and Front/Back buttons). The back has a real, scannable QR (same public JSON payload and key order as the website; drawn with Views from the pure-JS `qrcode` package, so no native dependency), terms, official validation with the principal name/signature from school settings, staff contact/address and campus footer. Missing fields show "Not recorded"; blood group badge only when recorded. Model in `utils/idCardModel.ts`, QR in `utils/qrMatrix.ts` + `components/QrCodeView.tsx`, card in `components/StaffIdCard.tsx`. Differences from the website: solid colors instead of gradients, no line icons, photo is centre-cropped (no object-position). `mobile/package.json` gains `qrcode`.
* **Not done / open:** Marks Entry session→exam flow and server-side exam max-marks validation (section 6); pixel-level visual comparison of the ID card on a device; measured before/after request timings (no access to the production backend from the build sandbox); emulator/device checks.
* **Website template findings (not changed):** `src/components/common/TeacherIdCard.tsx` itself falls back to invented values (`Graduate`, `Permanent`, `R. Sharma`, hardcoded `31 MARCH 2027`). The mobile card does not copy these.

#### Phase 23 (Website): Parent Portal — Security, Correctness & Missing Modules (uncommitted)
* **Backend security (verified locally against the real server, see tests):**
  - Signed-out requests returned every family's personal data: `GET /api/students` (all students incl. Aadhaar, DOB, parent mobiles — the parent login credential is mobile + child DOB), `/api/students/:id`, `/api/students/:id/id-card`, `/api/attendance`, `/api/attendance/student-calendar/:id`, `/api/fee-ledgers`, `/api/fee-ledgers/student/:id`, `/api/fees/student/:id`, `/api/fees/payments` (`/api/fee-payments`), `/api/marks` (+ `/api/exam-marks`, `/api/exams/marks`). All now require `requireAuth`; the existing PARENT/STUDENT scoping inside each handler is unchanged.
  - Fee mutations accepted signed-out requests (only PARENT/STUDENT were blocked): `POST /api/fee-ledgers/student/:id/pay-full` (recorded a full payment, 200), `POST /api/fees/payments` (created a payment, 201), `POST /api/fee-ledgers/run-engine`, `/audit-reconcile`, `/generate-monthly`, `/student/:id/generate-monthly`. Now `requirePermission('fees.collect')` (payments) or `['fees.collect','fees.structure.manage']` (billing engine). The web client now sends the token on these calls (it did not before).
  - Realtime: `/api/realtime/events` (SSE) and `/api/realtime/poll` are open to signed-out visitors and broadcast full student records, fee payments, attendance, staff and settings objects; the poll replays the last 250. `server/services/realtimeRedaction.ts` now strips payloads and descriptions from personal entities (DELETE keeps `{ id }`), keeps school-level entities (class, subject, timetable, exam, holiday, homework, website...) and reduces SETTINGS/SESSION to session fields. Clients already refetch each slice with their own token after an event.
  - Public result check page downloaded every student and every mark into the visitor's browser. New `GET /api/public/results/lookup?examId&query&classId&dob` returns one student's marks for one exam with `resultsStatus === 'PUBLISHED'`; DOB and parent names only when the supplied DOB matches. `PublicResultCheckPage` uses it.
* **Web client data fixes:** sync calls for fee payments, fee ledgers and marks were sent without the token (so a parent's browser cached every family's ledgers); now authenticated. Full sync is single-flight with a 4 s reuse window (it ran 3× per page load, 5× in dev); parents/students no longer request 7 staff-only endpoints. Measured locally (dev mode, parent dashboard load, 3 runs): 141 → 30 API requests, 35 → 0 failed requests.
* **Parent portal bugs fixed:**
  - Dashboard "Fee Balance" showed "Cleared" for every child: it used fee structures (401 for parents) minus payments. Dashboard, My Children and Fees now share `utils/parentFeeSummary.ts` (ledger-based, Asia/Kolkata dates). Seeded child: "Cleared" → "₹32,050 due" (matches the Fees page and API).
  - `PrintableIdCardModal` ignored `isOpen`: the ID card modal was always open on parent Documents and My Children and could not be closed, hiding the report card tab.
  - Parent Timetable showed the admin editor (save, schedule slot, other classes). New read-only `ParentTimetableView` (child's class/section/session; table on tablet/desktop, day cards on phones). Server already refused parent writes (403).
  - Report card: added an Academic Session selector (from `/api/academic-sessions`), exam loading/error/retry, stale-response guard; no longer requires exam `status === 'PUBLISHED'` (completed exams with published results were hidden); subject names resolved from the school subject list (was "Subject 1/2/3").
  - Invented values removed: class fallback "10" and section "A", "Class Class 2" labels (`utils/classLabel.ts`), 100% attendance when there are no records (dashboard, My Children, report card PDFs), gender "MALE" default in report card PDFs, ID card address ", , -".
* **New parent modules:** Homework page (sidebar, PARENT only; status from due date — records have no completion field, so nothing is shown as "completed"); Holidays & Upcoming Events on Notices (`/api/holidays`, `/api/public/events`). Shared `useParentChildren` hook: linked children from the scoped `/api/students`, switching via `/api/auth/switch-child`, reverts on refusal.
* **Tests:** `npm run verify:parent-portal` → `scripts/verify-parent-portal-rules.ts` (48 offline checks) + `scripts/verify-parent-portal-security.ts` (66 checks against the real backend: signed-out access, forged/tampered tokens, own-family scoping, cross-family IDs, fees privacy and mutation guards, multi-child switching, report-card authorization, public lookup, realtime redaction, staff access). The same security suite run on the original code: 27 failures. `verify:staff-security` 53/53, `verify-document-suite` 6/6. Root `tsc` and `npm run build` pass.
* **Not changed / needs a decision:**
  1. Marks visibility rule: parents receive marks when an exam is principal-approved even if results are not published (`handleGetMarksList`), while the public lookup and report card require `resultsStatus === 'PUBLISHED'`.
  2. `JWT_SECRET` and `INITIAL_ADMIN_PASSWORD` have hardcoded fallbacks in `server.ts`; production must set both, or tokens can be forged and the default admin password is in the repository.
  3. 16 other web mutations still send no token (admin accounts, admin login-detail and reset-link emails, staff portal status, attendance, homework, notices, timetables, teachers, subjects, transport slabs, fee configurations, fee bill...). Their server guards were not audited in this phase.
  4. `/api/public/results/lookup` has no rate limit; admission numbers are sequential.
  5. `DocumentsView` returns early for PARENT before its hooks (rules-of-hooks); harmless while the role is fixed per session.
* **Not verified:** real parent login (needs MongoDB; sessions were locally signed with the same payload), production backend, real devices. `verify-exam-results-suite` needs MongoDB for admin login (503 here and on the original code).

#### Phase 24 (Mobile): Broken Merge Repair & Parent Portal (uncommitted)
* **Broken merge on `main` (117539b):** merge d0a556e concatenated two versions of six mobile files (`SchoolHeader`, `MyIdCardScreen`, `AppNavigator`, `MyPayrollScreen`, `StudentAttendanceScreen`, `apiService`), so the mobile app did not compile. Restored each from its last good version and kept the intended later changes (Report Card screen route, `report-card` admin module). `test/verify-source-parses.ts` now parses every mobile source file and fails on conflict markers.
* **Cache privacy fix:** the generic response cache in `apiService` was keyed only by method and URL and was not cleared on logout, so a second account on the same phone could be served the first account's data. Now keyed by session token and cleared on logout, on 401 and on child switch. A 401 for a signed-in session returns the app to the login screen.
* **Parent portal (`mobile/src/parent/`):** parents are routed from `AppNavigator` to a dedicated portal with bottom tabs (Home, Attendance, Fees, Results, More) and stacked screens (My Children, Timetable, Homework, Notices & Events, Documents, Profile). Android back closes an open screen, then returns to Home, then exits.
  - One active-child context (`ParentChildContext.tsx`): children come from the server-scoped `/api/students` and are also filtered to the session's linked ids; the stored choice is restored only if it is still authorized, otherwise the session child or the first child; switching goes through `POST /api/auth/switch-child` and is reverted if refused; cached data is cleared on switch; screens drop the previous child's data immediately and ignore late responses. Child switching exists only on My Children (header chip and "Change" lead there).
  - Screens use real endpoints only: attendance (`/api/attendance?studentId`), fee ledgers and payments, published exams and marks, timetables, homework, parent notices, holidays and events, school settings, student ID card. Missing data shows "Not recorded" or an empty state; no attendance means no percentage (not 100%); marks rows without a real maximum are skipped; duplicate exam records with the same name and dates are listed once.
  - Fees: outstanding, billed, paid, overdue; bill and receipt details in a sheet. No online payment (none exists in the backend); PDF receipt, report card and ID card downloads remain on the website (the app has no PDF/share libraries).
  - Student ID card QR carries admission number, name, class and roll only. The website card QR also encodes date of birth and contact number, which together are the parent login credential.
  - Lucide icons added as tinted PNGs (`assets/icons`, ISC licence included).
* **Tests:** `test/verify-parent-portal.ts` (59 checks: authorized children, rejected foreign stored child id, active-child defaults, attendance/fees/marks rules, session and class filtering of exams, back navigation, QR privacy, cache scoping, single child switcher, no emoji or placeholder text). `npm run test:offline` all suites pass; mobile and root `tsc` pass; `npx expo export --platform android` builds; root `npm run verify:parent-portal` 48 + 66 pass (backend own-family scoping, cross-family 403, switch-child refusal). expo-doctor: 15/18, the 3 failures need api.expo.dev (no network here). Screens were checked in a web render (390 and 360 px) against the local backend with a locally signed two-child parent session; not on a device.
* **Open / needs a decision:**
  1. On native Android the session and the chosen child are kept in memory only (`authStorage` persists only where `localStorage` exists), so parents sign in again after the app is closed. Persisting needs `expo-secure-store` and a new native build.
  2. Website student ID card QR (`src/utils/qrcodeHelper.ts`) exposes DOB + emergency contact.
  3. `EXPO_PUBLIC_API_URL` is read as `process.env?.EXPO_PUBLIC_API_URL`, which Expo does not inline, so the override has no effect in builds.
  4. Duplicate "Half Yearly Examination 2026" exam records exist in school data.
  5. Homework records have no submission/completion field; the app shows due-date status only.
  6. Real parent login not tested (needs MongoDB); production backend not reached.

#### Phase 25: Student & Staff ID Card Redesign + Scan-to-Mark Attendance (uncommitted)
* **New card design (website and mobile):** one design for both cards, matching the reference: navy header with logo, school name, CBSE affiliation and address, gold title ribbon, blue side waves, round photo with blood-group pill, details table; back with a second table, the QR code and the principal's signature. Student front: Student ID, Class, Section, Roll no, DOB; back: School Name, Father's Name, Mobile, Address. Staff front: Designation, Staff ID, Subject, DOB; back: School Name, Department, Mobile, Email. Missing values show "Not recorded"; the invented defaults of the old cards ("Mr. Guardian", "O+", "Graduate", "Permanent", "31 MARCH 2027", "R. Sharma") are gone.
  - Website: `src/components/common/idcard/IdCardDesign.tsx` (shared parts + `FlipIdCard`), `StudentIdCard.tsx`, `TeacherIdCard.tsx`. New side mode `flip` (tap the card or the button; 3D rotate, skipped with reduced motion) is the default in the ID card dialog and the parent ID card page; Print and PDF switch to both sides automatically. Cards stay 340 x 540 so the PDF exporter keeps working.
  - Mobile: `mobile/src/components/IdCard.tsx` (replaces `StaffIdCard.tsx`), `mobile/src/utils/idCardModel.ts` (staff and student models). Used by My ID Card (staff) and parent Documents (student).
* **Signed QR (`server/services/idCardQr.ts`):** the QR is `PDS1.<S|T>.<base64url(id)>.<HMAC>` with no name, DOB, phone or address. Secret: `ID_CARD_QR_SECRET`, else derived from `JWT_SECRET`. Tokens are returned only to people allowed to see the card: `GET /api/students/:id/id-card` and `/api/staff/:id/id-card` now include `qrToken`; `POST /api/id-cards/qr-tokens` returns tokens in batches (bulk print). The old plain-JSON QR helper (`src/utils/qrcodeHelper.ts`, which exposed DOB and contact) and the mobile `studentCardQrPayload` were removed. Old printed cards are recognised and refused with "please print a new card".
* **Scan to mark attendance — `POST /api/attendance/scan`:**
  - Student cards: teachers (only students of their assigned classes and sections) and admin roles / academic coordinator. Staff cards: SUPER_ADMIN, SCHOOL_ADMIN, ADMIN, PRINCIPAL, VICE_PRINCIPAL and HR_STAFF (the roles that already manage the staff register).
  - Marks today's date in India time only; refuses holidays, inactive students/staff, forged or edited codes, and the wrong card type. Writes only that one record (the rest of the register is untouched); a second scan the same day changes nothing. Optional "Mark as Late". Staff scans store the check-in time.
  - Existing Absent/Leave record: roles without correction rights are refused; others must confirm the change (`override`). Every scan is in the audit log and sent as a realtime update.
* **Scanner UI:** website `src/components/attendance/IdCardScanModal.tsx` (camera with BarcodeDetector or jsQR, "Use a photo" fallback, confirmation for overrides, list of people marked) on Attendance → Mark Daily ("Scan ID card") and Staff ("Scan staff ID card"). Mobile `ScanAttendanceModal.tsx` (expo-camera) on Student Attendance and Staff Attendance. A scanned person is updated in the open register without discarding other unsaved choices.
* **Related fixes:**
  - Saving the register after some students were scanned was blocked for roles without `attendance.edit` (any saved record counted as a correction). A correction now means changing or removing a saved record, on the server and in the web register; adding unmarked students is allowed.
  - `POST /api/staff-attendance` wrote only that day's records to `staffAttendance.json` (other days were lost without MongoDB). The full set is now written back.
* **Dependencies / config:** root `jsqr@^1.4.0`; mobile `expo-camera@~16.0.18` with camera permission text in `app.json` (`plugins`, Android `CAMERA`, iOS `NSCameraUsageDescription`). The camera is a native module: the Android app needs a new build (EAS) before scanning works; Expo Go already includes it. `.env.example` documents `ID_CARD_QR_SECRET`.
* **Tests:** `npm run verify:id-card-scan` (47 checks against the real backend: token issuance per role, no personal data in the QR, forged/edited/relabelled codes, old cards, scan RBAC for teacher/HR/parent/accountant/coordinator, one record per scan, idempotent second scan, Late, inactive student, wrong card type, register save after scans, override flow, staff check-in time, staff file keeps other days, holiday). Mobile `test/verify-id-card.ts` rewritten (26 checks). All mobile offline suites, `verify:parent-portal` (48 + 66), `verify:staff-security` (53) pass; root and mobile `tsc`, `vite build` and `expo export --platform android` pass. End-to-end: a real card QR shown to a fake camera in Chromium marked the student Present through the website scanner; the QR drawn by the mobile card decodes and is accepted by the server.
* **Not verified:** a physical phone camera and a printed card; MongoDB-backed production.


#### Phase 26: Dashboard, Students, Staff & Payroll Audit — Data Correctness, Security, Admission Letter, Responsive UI (uncommitted)
* **Baseline (original code, local MongoDB 8.3.7 seeded from `data/`):** `scripts/verify-erp-core-audit.ts` 23/65 passed; `scripts/verify-payroll-calculations.ts` 15/20 passed.
* **Security fixes (server):** `/api/dashboard/summary` was public (fee receipts with student names) → sign-in required, refused for students/parents, fee figures only for roles with `fees.view`. Logout, password change and deactivation did not end existing sessions (any valid JWT was re-accepted) → revoked-token list + per-user revocation cutoff, and every request re-checks that the staff/admin/student account is still active. Staff create/edit/portal-status allowed rank escalation (HR could create or promote a Super Admin, anyone could change their own role) → `canAssignRole` / `canManageUserAccount` enforced, no self role/status/ID changes. Password hashes were returned by staff create/edit/portal-status and by student list/detail (student records also carry reset tokens) → stripped. Payroll list returned all 104 rows to a teacher session without a staff record → 403.
* **Data integrity fixes (server):** admission accepted no name, missing/inactive class, wrong section, future DOB (fell back to "Class 10", "Unnamed Student", "Parent"); `POST /api/students` silently overwrote an existing student when an admission number or id was reused, and the browser chose the next admission number from its own cache (two simultaneous admissions could overwrite each other) → validation, 409 on reused numbers/ids/same child, server allocates admission (8-digit `6401xxxx`), registration and roll numbers. Student status accepted any value (e.g. `BANANA`) and was saved fire-and-forget → validated and awaited. Hard delete removed students with payments/attendance/marks → 409 "change status to Withdrawn"; deleting a mistaken record frees its hostel bed. Staff: duplicate employee ID was silently renumbered → 409; deactivation was not written to the login account (deactivated staff could still sign in) → synced + sessions revoked; `updateStaff` could match another record by shared email → exact id first. Admission/staff/student saves now report failure when MongoDB does not confirm the write.
* **Payroll fixes:** unconfigured salary produced an invented ₹30,000 (seed has 6 such PENDING records for PDS0010 — not modified) → skipped and listed as "no salary configured". Rejected or pending leave applications deducted a day even when the person worked → only APPROVED leave changes pay; a worked day is never deducted. Inactive/resigned staff were paid every month → only for months with attendance. Generation accepted future/current/invalid months → only completed months (IST). Mark-paid could pay twice, invented `TXN-PDS-…` references, and saved fire-and-forget → single conditional DB update (409 if already paid), reference required for non-cash, no future dates, awaited. Manual `POST /api/staff-payroll` could overwrite paid records → refused. Editing a staff profile as a non-payroll role could overwrite salary with the Edit page's ₹50,000 default → financial fields ignored for those roles; Edit page reads `monthlySalary`; Add Staff no longer pre-fills ₹45,000.
* **Admission letter:** shared model `src/utils/admissionLetter.ts` drives preview, Download PDF (jsPDF + autoTable, A4, one page for typical letters), Print (prints the PDF itself) and the new **Email to Parent** (`POST /api/students/:id/admission-letter/email`): stored parent email only, PDF signature/size checks, one send at a time, confirm before resending within 10 min, status recorded on the student (`admissionLetterEmail`) and in the audit log. Status is "accepted by the email service" — Brevo delivery/bounce is not tracked. Removed from the letter: invented fees (₹5,000 etc.), hardcoded bank/UPI fallback, printed passwords ("PDS123", DOB), "Affiliated to … New Delhi", default blood group/occupation. `emailService.sendEmail` supports attachments and no longer invents a message id.
* **Client fixes:** staff create/edit/delete/document/portal calls sent no token (all rejected with 401 while the UI reported success and kept the change only in the browser) → authenticated, awaited, errors shown. Student status changes, staff status/portal toggles and deletes now wait for the server. Password-reset helpers reported success when the server was unreachable → report failure. Students page showed "0 students" when opened directly/refreshed (it never loaded from the server for non-teacher roles) → loads on open with loading/error states. Dashboard: India-time "today", LATE counted as present, per-student de-duplication, receipts counted once, quick actions and cards only for permitted modules, honest "Last updated" and load-failure banner, no "Sync DB"/"MongoDB" wording. Mark-paid dialog hooks order fixed (rules of hooks).
* **Responsive:** phone card layouts for Students, Teachers & Staff and the Salary register (tables kept for ≥768 px), 40 px touch targets and aria-labels for row actions, admission letter dialog full-screen on phones.
* **Tests (all pass):** `verify:erp-core` 76/76 (needs local MongoDB + `JWT_SECRET`; refuses non-local DBs), `verify:payroll-calc` 20/20, `verify:admission-letter` (5 letters, text checks via `pdftotext`), `verify:email-payload` 10/10, `verify:responsive-ui` 35 screens / 0 overflow / 0 technical text / 0 page errors (Playwright, not a project dependency), `verify:staff-security` 53/53, `verify:id-card-scan` 47/47, `verify:parent-portal` 48 + 66; `tsc` and `npm run build` pass.
* **Not verified / open:** real Brevo delivery, production MongoDB Atlas, printing on a physical printer, real phones. Mid-month joiners are paid the full month (no pro-rata rule exists — needs a policy decision). Basic/HRA/DA/TA on the payslip is a fixed 60/20/10/10 split, not configured per staff. Revoked tokens are kept in memory (restart forgets explicit logouts; deactivation is still enforced). Unauthenticated client calls remain outside this scope (timetable, attendance, fee configuration, notices, homework, study materials, admin accounts).

## Phase 27 — Fee invoices: duplicate heads, receipts, Super Admin edit (2026-10-21)
* **Duplicate facility heads:** an invoice took transport / hostel / mess from the student's fee profile *and* again from the student's facility flags (`Transport Fee` + `Transport Fee (stop)`, `Hostel Residency Fee` + `Hostel Accommodation (…)`, `Hostel Mess Fee` + `Mess & Dining Charges`). One shared builder (`calculateStudentMonthlyBreakdownServer` → `addFacilityChargesOnceServer`) now adds a facility only if the profile does not already carry it; the single-student "generate monthly" route uses the same builder. Old invoices are repaired by `auditAndReconcileFeeLedgers` (step 2b) — never when collected money would then exceed the corrected total; paid invoices are left alone.
* **Late fee shown twice:** the invoice screen printed the breakdown's "Late Fee / Fine" line and a second "+₹fine" row. The second row shows only when the breakdown has no late-fee line.
* **Super Admin invoice edit:** `PUT /api/fee-ledgers/:id` (SUPER_ADMIN only) edits heads, discount, late fee and due date; reason required; no duplicate head names, one transport/hostel/mess line each; total can not fall below what is collected (409); audit-logged as `FEE_INVOICE_EDITED`. UI: "Edit Invoice" in the invoice screen.
* **Receipt numbers:** `nextReceiptCounter` restarted at 44 on every server start, so a new receipt reused an old number; MongoDB's unique index then refused the payment record while the invoice still showed as paid. The counter now continues after the highest stored receipt and `allocateReceiptNumber()` checks for clashes. Collector name defaults to the signed-in user (was an invented "Vikram Sethi (Accounts)"). Partial saves no longer overwrite the local `feePayments.json` / `feeLedgers.json` copy with one record; Mongo save failures are logged as errors.
* **Invoice header:** read `settings.address/city/phone` (not stored), so it printed a Delhi sample address; it now prints the school's saved address, affiliation number and phone.
* **Offline client fallback** no longer bills invented amounts (2200 / 1800 / 6000 / 3200).
* **Open:** `calculateStudentMonthlyBreakdownServer` still falls back to a ₹2,500 "Monthly Tuition Fee" when a student has no fee configured; payments already lost to the receipt clash cannot be recovered automatically (compare "Payment Transactions" with invoices marked paid).

## Phase 28 — Attendance defaults, A4 monthly register, mobile drawer, Homework module (2026-10-21, uncommitted)
* **Attendance (web + mobile + server):** Clear All / Clear / Reset All removed. Staff attendance starts **Unmarked** (web and mobile) and nothing is ever preselected. `POST /api/attendance` and `POST /api/staff-attendance` drop entries without a valid status (Present / Absent / Leave / Late, case-insensitive) instead of defaulting them to Present, and answer 400 when nothing is marked.
* **Monthly Attendance Register (web):** Download and Print now use one shared jsPDF + autoTable document (`src/utils/attendanceRegisterPdf.ts`): A4 landscape, 10 mm margins, header row repeated on every page, rows never split across pages, one totals row, page "n of N" footer. Print opens that same PDF, so the file and the printout match.
* **Mobile admin drawer:** the small description under each module name was removed (`mobile/src/components/AppDrawer.tsx`).
* **Homework module (web + mobile):** existing `Homework` model and `/api/homework` routes extended (`instructions`, `attachmentSize`; `description` optional). `GET /api/homework/options` returns the class → section → subject tree a user may assign, so web and mobile show the same choices. Create/edit/delete are server-checked: teachers only for classes/sections/subjects they are assigned to (`isTeacherAuthorizedForSubject`), only the owner (or admin) can edit or delete, bad input is rejected. Students/parents receive only homework for the child's class and section (`studentIdCardAccessError`). Attachments use the existing R2 upload (`uploadType: homework`); removing one also clears it in MongoDB. Audit-logged; realtime `HOMEWORK` is now a "changed" signal with no payload and is not public. UI: `src/components/views/HomeworkView.tsx` (staff), `ParentHomeworkView.tsx` (student/parent), `mobile/src/screens/HomeworkScreen.tsx`.
* **Tests:** `npm run verify:attendance-register` 12/12, `verify:homework-api` 61/61 and `verify:attendance-api` 7/7 (need a running **local** server + local MongoDB; they refuse any non-localhost `BASE_URL`), mobile `test:offline` extended (`verify-homework-and-attendance.ts`). Regression: `tsc`, `verify:erp-core` 76/76, `verify:parent-portal` 48+66, `verify:staff-security` 53, `verify:id-card-scan` 47, `verify:payroll-calc`, `verify:admission-letter`. Playwright UI check of Homework on desktop, student and a 390 px phone.
* **Not verified / open:** mobile screens on a real device or emulator (only type checks on the new files, offline rule tests and API tests of the same endpoints); real Cloudflare R2 direct upload; the browser's physical print dialog; production. Attachments can be added only from the web; editing from the phone keeps an existing attachment. `/api/files/presign-upload` and `/api/files/content` are still unauthenticated (pre-existing). Mobile `tsc` still reports the pre-existing `expo-camera` / `ParentResultsScreen` errors. Older homework documents may have no `instructions` (the app falls back to `description`).

## Phase 30 — Teacher form, incharge-only attendance, marksheet, payslip, profile menu, exam schedule
* **Teacher form:** "Classes Qualified to Teach" and "House & Club Responsibility" removed; "Assign as Class Incharge" lists only active class/sections the teacher is qualified for (`src/utils/classIncharge.ts`, server `validateClassIncharge` on POST/PUT `/api/teachers`).
* **Attendance:** teachers view/mark/scan only their Class Incharge class-section (server-enforced in `/api/attendance`, `/scan`, `/assigned-classes?scope=incharge`); admins unchanged.
* **Report card:** one marksheet model (`src/utils/marksheetModel.ts`, mobile `buildMarksheet`) lists every class subject (Pending when no marks) with totals/result; mobile gets a searchable `StudentPicker`.
* **Payslip:** `server/services/payslipPdf.ts` is the single source; web downloads via authed fetch, mobile via short-lived link (`/api/payslips/download`); only PAID records carry payment details.
* **Profile menu:** My Payroll / My ID Card / My Profile removed from teacher sidebar + mobile grid; reachable from the top-bar profile menu / profile screen.
* **Exam schedule:** `src/utils/examSchedule.ts` validates timetables on server and form (dates inside window, end>start, pass<=max, no duplicate subject per section); student view filters by section and sorts by date. Exam Syllabus module removed from navigation (document category "Syllabus" in Documents intentionally kept).
* **Tests:** `verify:teacher-scope-api` 31/31, `verify:exam-schedule` 14/14, mobile `test:offline` all pass, `verify:erp-core` 76/76, parent-portal 48+66, staff-security 53, id-card-scan 47 (fixture now uses an incharge teacher), homework-api 61, attendance-api 7.

## Phase 31 — Layout cleanup, Academic module, Timetable, Exams & Marks, documents
* **Layout:** the landing hero was pulled under the floating navbar by a fixed offset, so the top of the page was clipped on mobile and desktop. The navbar now publishes its measured height (`--lp-nav-h`) and the hero offsets by it; mobile title truncates and the Enquiry button hides under 480 px. Descriptive subtitles removed from Academics, Sessions, class/section and grading modals, Timetable, Exams and Results, plus "database/MongoDB" wording in user-visible text.
* **Academic subjects:** `DELETE /api/subjects/:id` now removes the Mongo document too (`persistentStorage.deleteSubject`); before, a deleted subject came back after reload. Subjects used by marks/timetable/exams stay protected (409) and can only be deactivated.
* **Timetable (server):** conflict check (`findTimetableSlotConflict`) on create and update; period timings validated (`validateTimetablePeriods`); all write routes need an admin/principal role (`TIMETABLE_WRITE_ROLES`, teachers are read-only). **Web:** one A4 landscape PDF (`src/utils/timetablePdf.ts`) drives Download and Print; CSV is Blob based. **Mobile:** class/section filter added, no invented defaults; mobile has no export/print.
* **Exams & Marks:** exam cards redesigned, server sync on mount (Schedules count was 0 until a refresh), real sections per class, schedule validation (see Phase 30). Results-tab row download and "Download all" now produce A4 PDFs through `reportCardPdfExporter` (they used to save an HTML file); Print on the admit/report modals prints the same PDF (`printPdfBlob`).
* **Documents:** admit card header name auto-fits, venue is ellipsised, schedule columns rebalanced, school code/affiliation printed only from saved settings; report card lists every class subject, totals, grade and result from saved marks, attendance shown only when recorded.
* **Tests:** `verify:academic-timetable-api` 24/24 (new), `verify:exam-schedule` 14/14, `verify:homework-api` 61/61, `verify:attendance-api` 7/7, `verify:teacher-scope-api` 31/31, `verify:erp-core` 76/76, payroll / admission letter / email payload / attendance register pass; web `tsc`, `build` clean; mobile `test:offline` 14/14, mobile `tsc` shows only the 5 pre-existing errors. PDFs rendered and inspected: admit card (A4, 1 page), report card with and without marks (A4, 1 page).
* **Open:** mobile not run on a device/emulator; physical printer not tested; an overall result is PASS/FAIL from total percentage, so a student with one failed subject can show overall PASS — the school should confirm its rule. Self-hosting suites re-run: parent-portal 48+66, staff-security 53, id-card-scan 47 (its fixture now picks an incharge class with 2+ active students instead of the first teacher with a class).

## Phase 32 — Hostel, Transport, Notices & SMS: correctness and cleanup
* **Notices (server):** one validation for create and edit (title/text, category, audience, class for class notices, dates, expiry not before publish). Same title on the same day now answers 409 instead of silently returning the old notice. Edit accepts only notice fields (id, author and created date can no longer be overwritten). Teachers edit/delete only their own notices and see their own drafts; admins manage all. Expiry uses the India date and is recomputed, so moving or clearing the expiry publishes the notice again. "Find duplicates" removes only exact copies (title, text, date and audience) after a preview; before, it deleted every notice that shared a title and worked only with MongoDB. Edits, status changes and deletes are audit-logged.
* **SMS (server):** without a configured gateway (`SMS_PROVIDER=FAST2SMS` + `SMS_API_KEY`) nothing is reported as sent any more: `/api/sms/send` and quick-trigger dispatch answer 503, stats return `configured:false`. Before, a built-in "PDS gateway" marked every message as submitted although none left the server. Staff-only notices never SMS parents; class notices respect the section. Send is limited to 500 recipients and 1,000 characters, duplicate numbers are sent once, history search text is escaped, technical database errors are no longer shown to users.
* **Notices & SMS (web):** misleading "Automatic Notifications" tab removed (nothing is sent automatically); status chips with counts, search, category/audience filters, confirmation for unpublish/delete/cleanup, server errors shown in place. Client no longer shows a notice as saved or deleted when the server refused it. Buttons follow the server roles (`src/utils/communicationAccess.ts`). **Mobile:** new staff screen `mobile/src/screens/CommunicationScreen.tsx` (list, filters, details, new/edit, publish/unpublish, delete with confirmation, SMS stats and history); rules in `mobile/src/utils/noticeRules.ts`.
* **Hostel:** counts come from the beds (stored counters were stale); a student holds one bed even if their record is out of date; inactive students and a student whose gender does not match the hostel type are refused; vacate/change-bed no longer free another student's bed; "remove bed" removes the chosen bed (it used to remove the last empty one) and new beds get an unused name; room/hostel edits are validated and cascade room number/floor to students and allocations; edit/delete roles now match create/allocate (adds Admin and Vice Principal). UI: compact bed grid, no invented fee defaults, warning when a hostel's name and type disagree.
* **Transport:** passenger count only includes students on an existing route (others are shown as "need a route"); seats are counted per vehicle across its routes; stop numbers are kept 1..n (stored repeats such as "#2, #2" are repaired on load); new stops can be inserted at a position; duplicate stop names, bad times and negative fares are refused; a stop or vehicle in use cannot be deleted; capacity cannot drop below riders; route cannot point to a missing or too small vehicle; bus/driver changes reach the students. Fixed: allocation without a stop name picked the wrong stop, and editing a stop could rewrite students who had no stop. UI: removed the hard-coded "GPS Active" and "Installed & Active" labels, placeholder stop/route/vehicle defaults, and "Assigned Stop" placeholder (students whose stop is not on the route are flagged).
* **Tests:** `npm run verify:operations` 67/67 (new, self-hosting); mobile `test:offline` incl. new `verify-notice-rules.ts` 22/22; staff-security 53, id-card-scan 47, parent-portal 48+66, exam-schedule 14, payroll-calc pass; root and mobile `tsc` clean; `vite build`, `expo export --platform android` pass; Playwright runs of the notice, hostel and transport flows on desktop and 390 px.
* **Open:** `verify:erp-core` needs a local MongoDB (not available here); SMS history depends on MongoDB; mobile screen checked in the web preview only (Alert confirmations are native-only and were not exercised); Hostel and Transport have no mobile screens. Data seen in the test copy that the school should fix: "Girls Hostel" is saved with type Boys, and rooms are labelled "2-Bed Sharing" while they have 4 beds.

## Phase 33 — Mobile Admin & Staff modules upgrade
* **Done (mobile):** live Admin Dashboard (student/staff overview, hostel vs day scholars, class/section counts, departments, today's attendance, fees, exams, timetable, notices, shortcuts) with loading/empty/error states; Marks Entry rebuilt around the Session→Exam→Class→Section→Subject→Students flow with search, confirm-on-submit and unsaved-changes guard; My Profile consolidated (details, payroll, ID card, attendance calendar with present/absent/leave/holiday/weekly off/no record); Student Management (summary, search + filters, profile tabs: personal, guardian, address, admission, class, attendance, fees, marks, ID card, documents, hostel); Staff Management (directory with filters, profile tabs: overview, attendance, leave, payroll for payroll roles, ID card, documents, activate/deactivate with confirmation); bottom nav Dashboard/Timetable/Attendance/Profile/More with icons instead of emoji; drawer/grid without duplicates.
* **Done (server):** `POST /api/marks` integrity validation incl. duplicate-row rejection; dashboard `studentOverview`/`staffOverview`; fee-ledger endpoints guarded for staff without fee access; staff departments merged case-insensitively.
* **Tests actually run:** mobile `npm run test:offline` passes (new: marks-entry flow 17, attendance calendar 15, profile sections 11, staff directory 8; `verify-home-redesign` updated for the new admin grid); mobile + server `tsc --noEmit` clean; live checks against a locally started server (45 students/17 staff seed) via signed test tokens: 25/25 (dashboard overview, fee-ledger 200/403, staff list field limits, student/staff detail, calendars own-vs-other, payroll history own-vs-other, staff status change forbidden for teacher/accountant, marks over-max/negative/duplicate rejected, unassigned teacher 403).
* **Not done / open:** nothing has been run on a device or emulator (UI rendering unverified); no student/staff create/edit/admission/promotion forms, fee collection, Reports, ID Cards bulk screen on mobile (use the website); ID card/payslip download or print needs new native modules (payslip opens via link); `/api/fees/student/:studentId` guard; `verify-mobile-auth` needs MongoDB.

## Phase 34 — Settings identity, password security, MIS reports, login, file and API security
* **Institute details:** all hardcoded school identity removed from web, mobile, PDFs and the public site (fake principal, demo bank account, invented phones, "CBSE Affiliation", PDS-7821). Server and storage defaults keep identity-only fields and no longer inject payment/bank defaults at start-up. Missing values show `Not configured`. Mandatory Disclosure no longer shows unverified certificate/infrastructure claims (school to fill in). Mobile identity is refreshed from the server and cached in SecureStore.
* **Passwords:** closed the parent `PDS123` change-password bypass; strength rule, reuse block, attempt limits and audit for change-password; forgot-password never reveals whether an account exists, its links can only point to known site origins and are not logged; Forgot password + Change password on mobile (staff/parent) and web.
* **Teacher profile:** "Currently assigned" (server-authorized classes/sections/subjects) shown separately from "Qualified to teach" (web + mobile); self-edit limited to contact fields with backend validation, own documents cannot be self-verified, changes audit-logged.
* **Reports (server):** report roles only; fee data only for fee roles, salary only for payroll roles; validated filters (ISO dates, active class and section); fixed inactive classes counted, "new admissions" = whole session, billed ≠ collected + pending, no-attendance shown as 100%, invented grade/months, payroll not limited to the period, unpaid staff shown as PAID; over-paid bills flagged; students in a class that is not set up get their own row; response no longer leaks error text; views are audit-logged.
* **Reports (web):** new MIS dashboard (`src/components/views/ReportsView.tsx`): session/date/class/section filters (+exam/subject on Exams), six categories, KPI cards, bar/donut/column charts, searchable paginated tables, loading/empty/error states, Refresh/Reset, CSV for Excel, jsPDF PDF with logo/letterhead/period/filters/author, print view. Local client-side recalculation fallback removed.
* **Reports (mobile):** new `ReportsScreen` (report roles) with session, period presets, class and section chips, compact KPIs and lists, Share as text.
* **Login (web):** `LoginView` rebuilt to match the mobile login (navy, gold-ringed crest, white card, segmented tabs, show/hide password, Forgot password for staff and parent); clutter and technical text removed.
* **Security:** CORS allow-list; file endpoints (presign, stream upload, confirm, delete, metadata, download links, media library) now need sign-in and role/ownership checks — before, anyone could overwrite or delete stored files, replace the school logo, or list private document keys; HTML/SVG served as sandboxed downloads; image proxy limited to signed-in users and public image URLs (was an open proxy); fee configuration, transport slab and study-material writes guarded; audit-log entries take identity from the session; email/db status guarded; enquiry events no longer broadcast applicants' details; public enquiry form validated and rate limited; settings updates filtered and change-audited; principal signature hidden from signed-out visitors.
* **Website management:** storage-provider, bucket, database and endpoint labels removed from user-facing text across the app.
* **Tests run:** web `tsc` clean, `vite build` pass; mobile `tsc` clean, `test:offline` all pass + `verify-reports-model.ts` 21/21; new `verify:report-rules`, `verify:reports-api` 23/23, `verify:password-security` 8/8, `verify:origin-policy`, `verify:file-policy`, `verify:file-api` 21/21, `verify:url-safety`; re-run: staff-security, id-card-scan, parent-portal, payroll-calc, engagement, blank-forms, admission-letter, attendance-register, exam-schedule, email-payload, operations, attendance-api 7/7, academic-timetable-api 24/24. Browser (Playwright, production build): reports desktop + 390 px, PDF and CSV downloads, web login desktop + 390 px, forgot-password message, Media Library upload end to end.
* **Not run here:** `verify:erp-core`, `verify:homework-api` and the MongoDB part of `verify:teacher-scope-api` (no MongoDB binary reachable in this sandbox; the first 8 teacher-scope checks passed); a real sign-in (login needs MongoDB); mobile on a device/emulator.
* **Configuration needed:** email provider (`BREVO_API_KEY` / sender) for reset links; `FRONTEND_URL` or `CORS_ORIGINS` for any domain not in the allow-list; Chairman designation on a staff record for parent chat; School Settings fields still empty show `Not configured`.

## Phase 35 — Marks entry fix and marksheet redesign
- Saving marks now sends only the students shown for the chosen class/section, one row each. Before, the exam-wide list (other classes, older duplicate rows) was sent, which caused "Unknown class" and "A student appears more than once". Changing a mark, or switching Absent to Present, works any number of times (`src/utils/marksSubmission.ts`).
- Marksheet (PDF download, print and on-screen): Attendance removed; Parent / Guardian signature replaced by a QR code holding the student's name, class and section, admission, roll and registration numbers, date of birth, gender, parents' names, result (PASS/FAIL), obtained marks and percentage. Photo is cropped to its frame instead of stretched; table rows are sized to the subject count so the page is filled evenly; a Result / Obtained / Percentage strip was added.
- Verified with `npm run verify:marksheet`, a rendered PDF whose QR was scanned back, `tsc` (web and mobile) and `vite build`.

## Phase 36 — Marks edit rules (admin vs teacher)
- Saving marks no longer fails with "A student appears more than once": if a student arrives twice in one request the last row wins.
- Admin (Super Admin, School Admin, Principal) can enter, correct and switch Absent/Present any number of times.
- A teacher can enter marks and save drafts, but cannot change a mark or Absent status once submitted (403 with a clear message); re-sending unchanged marks is accepted.
- Verified by `npm run verify:marks-edit` (12/12 against a local server).

## Phase 37 — Teacher mobile app polish, staff form fix, teacher access from classes and subjects
- **Staff form (web, Add and Edit):** "Classes Qualified to Teach" is a multi-select of active classes again (one teacher, any number of classes; a saved class that is no longer active stays visible so it can be removed). Subject Expertise is the only subject list; the duplicate "Additional Subjects Handled" field is removed.
- **Data migration:** on server start, any old `additionalSubjects` (top level and in `teachingProfile`) is merged into Subject Expertise without losing a subject, then removed. An older form that still sends it is folded in the same way on save (`src/utils/teacherSubjects.ts`).
- **Teacher access (backend):** classes come from Classes Qualified to Teach plus assigned classes; subjects come from Subject Expertise and the primary subject. A teacher qualified for a class but with no matching subject keeps the class's students but can enter no marks (before, they were given every subject). Class incharge keeps all subjects of their own class.
- **Mobile (teacher):** new My Classes screen (Assigned / Qualified tabs with sections, subjects, student counts, search) fed by `GET /api/teacher/authorized-assignments` (new `assignedClasses` and `qualifiedOnlyClasses`); My Classes in the side menu; dashboard shows assigned classes and subjects and eight quick actions (attendance, marks, students, timetable, classes, homework, notices, parent chat); Notices, Messages and Live Events share one tab strip. No mobile npm scripts were changed (Expo update fingerprint unchanged).
- **Verified:** `npm run verify:teacher-subjects` 14/14, `npm run verify:teacher-access` (API) all pass, mobile `test/verify-my-classes.ts` 21/21 plus the whole `test:offline` suite, web and mobile `tsc`, `vite build`, and the earlier attendance, timetable, marks, reports and file API suites.
- **Not verified:** a real device or emulator, real MongoDB sign-in, `verify-teacher-scope-api.mjs` (needs MongoDB).

## Phase 38 — Report card download hang, click feedback, notice popup, profile menu
- **Download / Print hang (root cause):** opening a marksheet started an endless loop (a fresh `[]` default prop re-ran the data effects on every render): about 113 student/settings fetches and 141 photo requests in 6 seconds, then the tab crashed. Defaults are now stable and the effects key on ids. Failed photo/logo lookups are cached for 60 s and shared while in flight.
- **Slow PDF:** the 1173x1187 PNG logo was re-compressed by jsPDF on every export (2+ s on a desktop, far more on a phone). Logo and signature are now shrunk before they go into a PDF. Measured in headless Chromium: download 48 s (6x slower CPU) / crash (normal CPU) before, 0.5 s / 2 s after.
- **Print on phones:** printing a PDF inside a hidden frame never works on phones, so the button seemed stuck. On phones the PDF is handed over as a file; the print helper also stops waiting after 8 s. Print shows a spinner and both buttons are disabled while a PDF is being prepared.
- **Click feedback (all screens):** hand cursor on every clickable element, a press-in animation, no 300 ms tap delay, a "not-allowed" cursor on disabled controls, reduced-motion respected.
- **Notice popup:** a new notice shows under the bell for 2 seconds, then hides. The live event carries no notice text (privacy), so the popup reads the notice from the user's own permission-filtered list. Click opens Notices.
- **Menus:** profile and notification menus close on an outside click/tap and on Esc; the profile button toggles; opening one closes the other.

## Phase 39 — Push notifications (Android phone + browser)
- **What:** messages, notices, homework and fee reminders now reach people outside the app. Phone: Expo push to the Android app. Browser: Web Push (service worker, works with the site closed). Both free.
- **Server:** `server/services/pushService.ts` (rules + delivery loop), `server/routes/pushRoutes.ts` (`/api/push/config|register|unregister|status|test`), `server/models/PushDevice.ts` (collection `push_devices`). A device belongs to one login; a parent's device also stores their children's ids, a staff device its chat identity. Recipients are decided with the existing access rules: chat goes to the other side of that thread only, notices follow the notice audience (drafts notify nobody; publishing a draft later does), homework goes to parents/students of that class and section, fee reminders to that child's family. The sender is never pinged about their own action. A push failure never fails the message/notice that caused it. Dead devices (Expo `DeviceNotRegistered`, browser 404/410) are removed automatically. Browser subscriptions must be public HTTPS push-service addresses (the server POSTs to them).
- **Phone app:** `expo-notifications` + `expo-device`; asks permission after sign-in, registers the token, creates the Android channel `school-alerts` (sound, pop-up, lock-screen), shows a banner with sound while the app is open, and a tap opens the matching screen (parents: chat / notices / homework; staff: messages / communication / homework). A Notifications card on every profile screen shows the state, turns it on and sends a test. Sign-out removes the phone's registration.
- **Web:** `public/sw.js` shows the notification (or, if the site is in front, a 2-second popup under the bell); the bell menu has "Turn on alerts", "Send a test", "Turn off". Sign-out removes the browser's registration.
- **Needs configuration (nothing is hard-coded):** browser alerts need `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on the server (`npx web-push generate-vapid-keys`). Phone alerts need a Firebase project: put its `google-services.json` in `mobile/` (or set the EAS file variable `GOOGLE_SERVICES_JSON`) and upload the FCM service-account key to the Expo project (Credentials > Android > FCM V1). `mobile/app.config.js` adds the file only when it exists, so builds work without it. The phone part includes a native module, so it needs a NEW app build; an OTA update is not enough.
- **Verified:** `npm run verify:push-service` (21), `verify:push-web` (12: service worker in a sandbox + the real web-push sender against a local HTTPS fake push service), `verify:push-api` (29: live server in record mode, recipients and non-recipients for chat, notices, drafts, homework, fee reminders, test push, unregister), `mobile/test/verify-push-routing.ts` (11), mobile offline suite, web/mobile `tsc`, `vite build`; browser: service worker registers, a push through Chromium's own pipeline shows the popup for 2 s.
- **Not verified:** delivery to a real phone or a real browser push service (the sandbox has no access to Expo, Firebase or browser push services), and the Firebase/Expo credential setup.

## Phase 40 — Parent "Pay full" (one online payment for everything owed) + receipt download
- **What:** the parent's Outstanding total now has a **Pay full** button (mobile app and website). One Razorpay payment clears every unpaid bill of the child, and ONE receipt is issued (same master-receipt + `breakdown` convention as the staff counter "pay full").
- **Server:** `POST /api/payments/razorpay/create-order` accepts `{studentId, payAll:true}`; the server adds up the open bills itself (paise integers, the client never sends an amount) and reuses an open order for the same total. `verify` and the `payment.captured` webhook share `settleFullPayment` (idempotent on the Razorpay payment id, so whichever arrives first wins and the other replays). Money is allocated oldest-due-first, every touched bill gets the master receipt number, and one `feePayments` record carries the breakdown. If the account was paid at the counter meanwhile, only what is still due is settled and the excess is written to the audit log. Pure logic lives in `server/services/feeSettlement.ts`.
- **Receipt:** `server/services/feeReceiptPdf.ts` builds the PDF. `POST /api/fees/receipts/:receiptNumber/link` (login + same access rules as paying) returns a 5-minute signed link and `GET /api/fees/receipts/download?token=` serves it, so the phone browser can download it. Web already had its own receipt exporter and the success toast now has a Download Receipt button.
- **Website:** the payment shows in Fee history straight away (same data, live FEE_PAYMENT / FEE_LEDGER events). The web Outstanding banner has a Pay Full button too.
- **Fixes on the way:** the new flow persists with the counter-flow pattern (the old single-bill online path overwrote `feePayments.json` with only the new row); `mobile/test/verify-push-routing.ts` no longer uses `import.meta.url` (mobile `tsc` was red).
- **Test hook:** `RAZORPAY_TEST_API_URL` can point Razorpay calls at a fake gateway, but only if it is a loopback address; production always talks to api.razorpay.com.
- **Known behaviour (not changed):** the existing late-fee audit removes the fine from monthly bills that become fully PAID, so Total Billed can drop by the late fees (e.g. 6 x ₹50) after a full payment while Paid keeps the amount actually received. This is how the engine already treats single-bill and counter payments.
- **Verified:** `npm run verify:fee-settlement` (15), `npm run verify:pay-full-api` (48, live server + fake Razorpay: access control, tampered signature, foreign parent, replay, webhook, counter-paid-in-between, audit log, receipt link security, old payments kept on disk), mobile offline suite, web and mobile `tsc`; browser: Pay Full on the website and the hosted checkout page, receipt shown and downloadable.
- **Not verified:** the React Native screen on a real device, a real Razorpay account (needs live keys and the webhook enabled for `payment.captured` on Render). The phone needs a NEW app build to get the button.

## Phase 41 — Student mobile portal, new login screen, roll-number login, website student fixes
- **Mobile login:** redesigned like the mock-up: navy hero (admin's hero-slide photo if one exists, else plain navy), crest, white card with the tab selector (Admin/Staff, Student, Parent), icons in the fields, "Login" button, Forgot password, "Need help? Contact school" (calls the school helpline). All three logins stay.
- **Student portal (new, `mobile/src/student/`):** side menu + bottom bar (Home, Attendance, Timetable, More). Screens: Dashboard (greeting, 8 tiles, today's highlights), Attendance (month calendar, tap a day, leave applications), Timetable (day chips, running-now), Marks & Results (term marks, exam schedule, result), Fees (outstanding, Pay Full, bills, payments, same engine as parent), Homework, Profile (edit contact number and address), Documents (ID card front/back, marks link), Notices (All/Academic/General, New badge), Events (upcoming/past, "I'm interested"), Settings (notifications, change password, logout). Push taps open Notices/Homework/Fees. Reuses the parent screens through a student-self provider, so no data rules were loosened.
- **Server:** a student can now sign in with Roll Number + Date of Birth as well as Admission Number; only when exactly one active student matches, otherwise it asks for the Admission Number.
- **Website student fixes:** a student used to see the staff pages (teacher attendance marking for another class, admin master timetable editor, school-wide fee management, staff ID cards). Attendance, Timetable, Fees and Documents now show the student's own read-only views (parent views, with student wording and "Student Portal" badge).
- **Not built (no data/backend exists):** subject-wise attendance, Theory/Practical timetable tabs, Bonafide/Character/TC request flow (shown as "issued by the school office"), a real campus photo on login.
- **Known:** a student's dashboard still makes a 403 call to `/api/dashboard/summary` (harmless, nothing shown from it).
- **Verified:** `mobile/test/verify-student-portal.ts` (30 offline checks), mobile offline suite, web and mobile `tsc`, `vite build`; screens checked through a react-native-web harness and the website in headless Chromium.
- **Not verified:** the React Native screens on a real device. The phone needs a NEW app build.

## Phase 42 — Razorpay payment security (server-verified fees only)
- **Bug:** verify/webhook took the bill and child from the browser (body / payment notes) and never compared the captured payment with the order the server created, so a ₹1 (or any) captured payment could clear a different bill, including another family's child; refunded payments passed; orders lived only in memory; the app showed "paid" from Razorpay's order status. Details and the new design: `docs/ONLINE_PAYMENTS.md`.
- **Server:** stored payment orders with a lifecycle (`payment_orders`: INITIATED → PENDING → SUCCESS / FAILED / CANCELLED / EXPIRED → REFUNDED), one booking path `settleOrder()` (per-child lock, idempotent on payment id, MongoDB transaction when available), strict capture check (`server/services/onlinePayments.ts`), webhook dedup by event id (`razorpay_webhook_events`), reconciliation endpoints + 5-minute sweep, unique indexes (order id, settled payment id, `fee_payments.razorpayPaymentId`, webhook event id) created without touching old data, TEST/LIVE credential split (`RAZORPAY_MODE`).
- **Website:** checkout sends only Razorpay's ids; close/failed asks the server (which checks Razorpay); lost network polls the server; opening Fees picks up pending payments; amber "being confirmed" state.
- **App:** hosted checkout uses a 30-minute order token (no login token in the URL) and the server's amount; returning to the app / reopening Fees asks the server; "paid" only on server SUCCESS. Older installed builds also only see "paid" after server verification (legacy status endpoint).
- **Verified:** `verify:payment-rules` (9), `verify:payment-security` (74 checks, 15 scenarios), `verify:pay-full-api` (48), `verify:fee-settlement` (15), website in Chromium (close, failed, forged callback, network drop → reconciled, refresh), hosted phone page, restart keeps orders, web + mobile `tsc`, `npm run build`, mobile parent-portal suite.
- **Not verified:** a real Razorpay test account and a real MongoDB replica set (transaction path is type-checked, not run here); the React Native screen on a device (needs a new app build).

## Phase 43 — Call teachers/management from parent Messages + mobile "New update available" popup
- **Call:** `/api/parent-chat/contacts` and the thread's `staff` block now carry the staff member's own mobile (staff record `phone`), School office uses School Settings contact number. Only parents linked to the child get it (same access check as chat). Parent can tap to call from the chat header (phone button) and the profile sheet — mobile and website.
- **Update popup:** School Settings → Mobile App Update (`mobileAppUpdate.latestVersionCode / latestVersionName / minVersionCode / message`), served publicly by `GET /api/app/version` (env fallback `APP_ANDROID_LATEST_VERSION_CODE`, `APP_ANDROID_MIN_VERSION_CODE`). The app (`AppUpdatePrompt`, rules in `mobile/src/utils/appUpdate.ts`) compares its own Android versionCode and shows the popup on every open (and on return to the foreground, max every 10 min) until updated; "Update now" opens the Play Store; below `minVersionCode` there is no "Later".
- **Release steps:** bump `android.versionCode` in `mobile/app.json` for every new .aab, publish, then enter that number in Settings → Mobile App Update and save. The popup itself only exists from the first build that contains it.

## Phase 44 — PhonePe replaces Razorpay (website + Android app)
- **Removed:** `server/services/razorpayService.ts`, all `/api/payments/razorpay/*` routes (create-order, verify, checkout-verify, webhook, orders, hosted checkout page), `src/hooks/useRazorpay.ts`, the app's Razorpay calls, Razorpay test scripts and fake, `RAZORPAY_*` env vars, Razorpay in the privacy policy. Historical Razorpay receipts and `payment_orders` documents stay in MongoDB untouched (payment code ignores orders without `gateway: 'PHONEPE'`).
- **Added:** `server/services/phonepeService.ts` (OAuth token cache, `/checkout/v2/pay`, order status, refund + refund status, webhook SHA/HMAC check), PhonePe section in `server.ts` (`/api/payments/phonepe/*`: config, create-order, orders/:id, orders?studentId, cancel, refund, webhook, return page), gateway-neutral rules in `server/services/onlinePayments.ts` (`checkCompletedOrder`, lifecycle), `src/hooks/usePhonePe.ts` (iframe PayPage, redirect fallback), app opens the PayPage in the phone browser and asks the server on return. Receipts carry gateway, merchant order id, PhonePe order/transaction id, payment mode, refund status; the PDF says "Online - PhonePe (UPI)".
- **Verified:** `verify:phonepe-api` (65), `verify:payment-rules` (7), `verify:fee-settlement` (15), website in Chromium with a stubbed PhonePe checkout.js (cancel, failed, pending → later confirmed, network drop, refresh, redirect return), web + mobile `tsc`, `npm run build`, mobile parent-portal suite.
- **Not verified:** a real PhonePe sandbox account (needs the school's Client ID/Secret), the exact HMAC header format on live webhooks (SHA auth is the documented default; either way only a server-side status check books a fee), a MongoDB replica set, the app screens on a device (needs a new app build).

## Phase 45 — Sections per qualified class, subject-only marks, dynamic attendance sections
- **Staff form (Add + Edit):** after picking "Classes Qualified to Teach", each class gets a dropdown with a checkbox for every active section of that class (live from Academics, "All sections" shortcut). Saving needs at least one section per class. Saved as `staff.qualifiedClassSections = [{ className, sections }]` (server cleans it: qualified classes only, upper case, unique). An older record without a choice keeps every active section (edit form shows them ticked).
- **Access:** `getTeacherTeachingAssignmentsDetailed` uses `qualifiedSectionsForClass()` (`src/utils/teacherSubjects.ts`, shared by web + server), so the teacher's dashboard (web + app), My Students, attendance lists, homework and marks entry show only the chosen class-sections. Inactive sections drop out automatically.
- **Marks:** a Class Incharge no longer gets every subject of the class for entry. `subjects` = what the teacher teaches (marks + homework); the other class subjects are listed as `monitorSubjects` (follow only). Only the subject's teacher can enter its marks in that class-section.
- **App attendance (Super Admin / Principal / incharge):** the section buttons were a fixed A/B/C; now `classSectionNames()` (`mobile/src/utils/classSections.ts`) shows exactly the class's active sections (scrolls when many).
- **Verified:** `scripts/verify-teacher-class-sections.mjs` (21, local server), `verify-teacher-subjects.ts`, `mobile/test/verify-class-sections.ts` (4) + teacher/marks mobile suites, web + mobile `tsc`, Chromium: staff form dropdowns (desktop + phone), validation.
- **Not verified:** the app screens on a device (needs a new app build).

## Phase 46 — Support staff (no app login) + Hostel Warden portal (mobile app)
- **Support staff:** new portal role `SUPPORT_STAFF` ("Support Staff (no app login)") with designations: Cleaning Staff, Sweeper, Driver, Conductor / Bus Helper, Peon / Attendant, Security Guard, Gardener (Mali), Cook, Kitchen Helper, Ayah / Maid, Electrician, Plumber, Lab Attendant, Office Boy, Helper, Other Support Staff (department "Support Services"). They get an Employee ID, ID card, staff attendance and payroll record like everyone else, but **never a login**: `loginEnabled` is forced to `false` on create, edit and the portal-access toggle; the login route and `getAuthContext` refuse the role (`isNoLoginStaffRole()` in `src/constants/staffRoles.ts`); no welcome-credentials email. The Add/Edit staff form replaces the "Enable Portal Account" block with a note.
- **Hostel Warden portal (mobile):** a HOSTEL_WARDEN login now opens `mobile/src/warden/WardenPortal.tsx` (bottom nav Home / Students / Attendance / More; Profile, password and Log out under More). Other roles are routed exactly as before.
  - **Home:** total / present / absent / outside / on leave / emergency counts for tonight, roll-call card, quick links (Attendance, Students, Leave Requests, Mess Menu), open alerts, today's activity timeline (built from saved records), pull-to-refresh, skeleton / empty / error states.
  - **Night attendance:** P / A / L / O per student, "mark remaining present" (approved leave → On Leave), one submit; saved rows lock and change only through **Correct** (reason required, history kept, audit log). History (daily) and monthly report per student.
  - **My Hostel Students:** only students with an ACTIVE bed in the warden's hostel; search (name, admission no., roll, room), class filter; profile with room / bed, parent and emergency contacts, **Call** (tel:) and **Message** (existing parent chat), recent nights, leave requests.
  - **Leave Requests:** the existing parent-submitted student leaves of these students (photo, class, room, dates, reason, parent name + phone, status, who is on leave today). The warden cannot approve (server `LEAVE_APPROVAL_ROLES` unchanged) and **forwards to the Principal** with a note; the Principal approves as before.
  - **Mess Menu:** Breakfast / Lunch / Dinner with timings per day, edit by the warden; a day without a menu shows the latest earlier one, labelled. No billing.
  - **Alerts:** ABSENT at roll-call opens an alert automatically (closed again if corrected); the warden can raise an emergency (Principal / admins get a push) and mark alerts resolved.
- **Server:** `server/routes/hostelWardenRoutes.ts` (`/api/hostel-warden/me|dashboard|students|students/:id|attendance|attendance/:id|attendance/history|attendance/report|alerts|alerts/:id/resolve|mess|leaves`), rules in `server/services/hostelWardenRules.ts`, models in `server/models/HostelWarden.ts` (`hostel_attendance` unique student+date+NIGHT, `hostel_mess_menus` unique hostel+date, `hostel_alerts`). `PUT /api/student-leaves/:id/forward` in the engagement routes. Engagement access (`canAccessStudent`) and parent chat now include HOSTEL_WARDEN, limited to their residents. Shared Mongo+memory store moved to `server/services/memoryStore.ts`.
- **Verified:** `scripts/verify-hostel-warden.mjs` (74 checks, local server: support-staff no-login, warden RBAC, assigned-students only, roll-call + duplicate/concurrent submit, corrections + audit, 2-day correction window, reports, alerts, mess, leave forward/approve, chat, school attendance untouched, other roles), `mobile/test/verify-warden-portal.ts` (12), `verify-teacher-class-sections.mjs` (21), push-routing / parent / student / messages mobile suites, web + mobile `tsc`, `npm run build`; warden screens rendered with real server data through a react-native-web preview (phone size).
- **Not verified:** a device build (the phone needs a NEW app build: new screens and icons); MongoDB (local run is in-memory; unique indexes are created by Mongoose on first use).

## Phase 47 — Hostel Warden desk on the website
- A HOSTEL_WARDEN signing in on the website now lands on `src/components/views/WardenDeskView.tsx` (instead of the generic dashboard; every other role's dashboard is unchanged). Same features and the same APIs as the warden app: Dashboard (tonight's counts, quick links, open alerts, activity timeline), Night Attendance (P/A/L/O, submit once, Correct with reason), My Students (table on desktop, cards on phone, search + class filter, profile with Call and Message), Leave Requests (forward to Principal), Mess Menu (view/edit), Alerts (raise/resolve), History & Reports (daily + monthly).
- Responsive: section tabs scroll sideways on phones, grids collapse to one column, no horizontal page scroll. Chat with a parent opens the existing Messages `Conversation` (now exported) in a dialog (Esc / Close). The warden also gets **Messages** in the sidebar.
- **Verified:** Chromium at 1366px and 390px with a local server: open desk, save roll-call, correct with reason, profile + chat, forward leave, save mess menu, raise alert, monthly report, no page errors, no horizontal scroll; Super Admin still gets the normal dashboard (21 checks). Web `tsc`, `npm run build`.

## Phase 48 — Fix: warden login opened another staff member's profile; warden saw no students
- **Cause:** sign-in and "who is this session" picked the FIRST record matching id OR employee ID OR email OR mobile (`findStaffForUser`, the staff login's `UserModel.findOne({$or})` + staff lookup, `findAuthEntityByIdentifier`). Staff who share an email (e.g. the school email) resolved to whoever was listed first — here the Vice Principal. The warden portal reads the hostel from that record, so it showed "No students in your hostel".
- **Fix:** `pickByPriority()` (`server/services/authMatch.ts`): exact keys first (id, employee ID, username); a shared email / mobile counts only when it belongs to exactly one account. Staff login with a shared email / mobile uses the one account whose password fits, otherwise asks for the Employee ID (`409 AMBIGUOUS_LOGIN`) — never another person's account.
- **Hostel of a warden:** Edit Staff now has the Hostel Assignment dropdown (it was only on Add Staff); both forms load hostels from the server. The portal also accepts a hostel whose record names the warden (warden mobile or name). Students whose bed is saved only on the student record (no allocation row) are included.
- **Access:** warden portal oversight and hostel emergency notifications only for Super Admin, School Admin, Principal, Vice Principal (`HOSTEL_OVERSIGHT_ROLES`); Accountant / HR / Academic Coordinator no longer.
- **Mess menu:** Delete (`DELETE /api/hostel-warden/mess?hostelId&date`) on website and app. **Messages (website):** a warden's "New" chat list shows only their hostel's students, listed straight away.
- **Verified:** `scripts/verify-auth-match.ts` (4), `scripts/verify-hostel-warden.mjs` (85; the shared-email check fails on the previous code and passes now), website Chromium: Edit Staff hostel dropdown → warden sees students, mess add/delete, warden chat picker (9), warden desk desktop + phone (21), teacher sections (21), mobile suites, web + mobile `tsc`, `npm run build`.
- **After deploy:** staff who logged in while the bug was live must **log out and log in again** (their old session points to the wrong record).

## Phase 49 — Weekly mess menu
- The warden sets the menu for **Monday … Sunday once** (`hostel_weekly_menus`, unique hostel + weekday); it repeats every week. A **special menu** saved for a date (`hostel_mess_menus`) replaces it on that day only; removing the special menu brings the weekly one back.
- Day shown = special for that date → weekly menu of that weekday → (only while a hostel has no weekly menu yet) the latest earlier menu, labelled. Rule: `resolveDayMenu()` in `server/services/hostelWardenRules.ts`.
- API: `GET|PUT|DELETE /api/hostel-warden/mess/weekly` (weekday 1 = Monday … 7 = Sunday); `GET /api/hostel-warden/mess` now returns `source` (SPECIAL / WEEKLY / EARLIER), `weekday`, `weekdayName`, `hasWeekly`.
- Website (Warden Desk) and app: Mess Menu has **Day view** and **Weekly menu**; the day card says "Weekly menu · Saturday" or "Special menu for <date>".
- **Verified:** `verify-hostel-warden.mjs` (96), website Chromium desktop + phone (10), app screen in the react-native-web preview (set weekday, day view label), web + mobile `tsc`, build. The app part needs a new app build.

## Phase 50 — Monthly audit-log archive (Excel → Cloudflare R2 + school e-mail) and lighter audit writes
- **Write fix:** every new audit entry used to rewrite the whole `data/auditLogs.json` (pretty-printed, blocking) and re-upsert EVERY entry into MongoDB, so each action got slower as the log grew. With MongoDB only the new entry is written now (including its `metadata`, which was dropped before); the JSON file is used only without MongoDB (local preview).
- **Archive job** (`server/routes/auditArchiveRoutes.ts`, rules `server/services/auditArchiveRules.ts`, Excel `server/services/xlsxWriter.ts` with `fflate`): every hour the server checks; each finished month (IST) is written to `archives/audit-logs/audit-logs-YYYY-MM.xlsx` in R2, read back to confirm, recorded in `audit_archives`, and e-mailed to School Settings → e-mail (attached up to 7 MB, link always). Failed e-mails retry (max 5). Entries are removed from MongoDB only for months more than **3 full months** old AND with a confirmed archive holding all of them; the removal itself is logged. Without R2 nothing is removed.
- **Audit Logs page:** "Monthly archives" table (entries in database, archive saved, e-mail, removal date, Download Excel for any month — archived months come from R2, others are built on the fly), Super Admin: Run archive now, Resend e-mail, Database storage (size per MongoDB collection).
- API: `GET /api/audit-logs/archives`, `GET /api/audit-logs/archives/:month/download` (audit_logs.view), `POST /api/audit-logs/archives/run`, `POST /api/audit-logs/archives/:month/email`, `GET /api/system/storage` (Super Admin). `AUDIT_ARCHIVE_DISABLED=1` turns the timer off; `AUDIT_ARCHIVE_EMAIL` is a fallback recipient.
- **Verified:** `scripts/verify-audit-archive.ts` (17: IST month edges, keep-3-months rule, corrupt cloud copy → nothing removed, archive + e-mail + removal with fake R2/e-mail, download of a removed month, no duplicates, e-mail retry, guards; files opened with openpyxl and LibreOffice), `verify-audit-trail-api.mjs` (24), audit policy checks, warden suite (96), Chromium Audit Logs page desktop + phone, `tsc`, build.
- **Not verified here:** real R2 upload / Brevo e-mail (not configured in this sandbox) and `$collStats` on Atlas.

## Phase 51 — Same profile page for every staff role; bottom-bar gap fixed; profile API hardening
- **Profile:** new `mobile/src/components/profile/MyStaffProfile.tsx` (identity card, My ID Card + My Payroll tiles, profile details from the staff record incl. hostel for wardens, editable contact details, my attendance calendar, leave apply / history, notifications, password, sign out). Used by teachers (+ teaching assignments card), every other staff role (`ProfileScreen` → `StaffProfileLayout`) and the hostel warden (More → My Profile, plus My ID Card / My Payroll screens inside the warden app).
- **White gap above the bottom tabs (Android):** screen-level `SafeAreaView`s measured their position once; when that happened before the root frame had its final size they kept a status-bar-high gap above the tab bar and an extra gap under the screen, cutting off the dashboard's quick actions. `App.tsx` `RootFrame` already reserves both system bars on Android, so screens now use `components/ui/SafeArea.tsx` (plain View on Android, the real SafeAreaView on iOS). Modals keep the library SafeAreaView.
- **`/api/auth/profile`:** picked the user / staff record with "id OR email OR phone" and merged it into whichever in-memory record matched the email (same bug class as Phase 48); now exact id / employee ID first, email / phone only when unique, merge by id / employee ID only. It also returned the staff record's password hash and reset tokens: now stripped (`sanitizeStaffRecord`).
- **Verified:** mobile `tsc`, all mobile suites (pre-existing failures in `verify-mobile-part1` / `verify-mobile-auth` also fail on main), web `tsc` + build, profile pages for teacher / accountant / warden rendered with real server data in the react-native-web preview. The Android bar fix needs a new app build and a device check.

## Phase 52 — Roles & Permissions page: toggle bug, photos, real role data, phone layout
- **Toggle bug:** switching ON a permission the role does not have never stuck (the denied-list update ran inside the granted-list updater and the granted change was thrown away). Overrides now go through pure helpers in `src/utils/rbacEditor.ts` (`togglePermission`, `grantAll`, `resetKeys`, `normalize`), tested by `scripts/verify-rbac-editor.ts`. Redundant overrides are never stored.
- **Photos:** avatars used the raw file key as the image URL; now `PersonAvatar` (signed file URL, initials fallback). The server now also sends the admin account's photo.
- **Real role data:** the matrix and editor used the built-in defaults; they now use the role templates from `GET /api/rbac/roles` (customised templates included). Counts are computed (12 login roles, 52 permissions) instead of hard-coded "12 roles / 42 permissions".
- **Support staff:** no login, so they are left out of the users list, the role picker and the matrix; `PUT /api/rbac/users/:id/role` refuses `SUPPORT_STAFF`.
- **Read-only view:** your own account and accounts at or above your rank open read-only with a short note (before, the switches and Save were active and the server rejected the save).
- **List:** asks for up to 2,000 users (the server default of 100 hid the rest).
- **UI:** cards on phone, table on desktop; full-screen editor on phone; modules collapse; plain wording; the confirm dialog lists permission names instead of keys; matrix shows one role as a list on phone.

## Phase 53 — Bulk ID cards (staff + students): photos and logo on every card, faster, print all
- **Missing photo / logo on lower cards:** html2canvas downloaded each card's photo, logo and signature again with a 5 s limit. With many cards the server got busy and later images timed out and came out blank. Now every image is downloaded once (6 at a time, one retry), kept as a data URL and put into each capture. Export also waits until every QR code and image on screen has loaded.
- **Cards without design:** the hidden copy html2canvas makes had to load the stylesheet again; when it had not finished, a card came out unstyled (huge logo, plain text). The page CSS is now put inline in the copy (bulk and single PDF).
- **Speed:** only the card being captured is copied (not the whole app and every other card), one capture per card instead of per side. Local test: 17 staff 27 s → 8 s; 45 students in ~22 s including the latest data for each.
- **PDF layout:** every page is the real card size (CR80 54 × 85.6 mm), front and back side by side, same size on all pages.
- **Print:** printed only the card on screen and the dialog's screen height cut the rest. Bulk print now shows all cards (both sides), waits for images and QR codes, and prints one card per page.
- **Student data:** only the first 10 selected students were refreshed from the server; now all of them (6 at a time). Download waits while that is still loading.

## Phase 54 — Staff attendance: only Super Admin and Principal; in time = mark time, out time = dispersal time
- **Who can mark:** only `SUPER_ADMIN` and `PRINCIPAL` (`STAFF_ATTENDANCE_MARK_ROLES` in `src/constants/staffRoles.ts`). Enforced on `POST /api/staff-attendance` and on staff ID-card scans (`/api/attendance/scan`). Vice Principal, School Admin and HR no longer see the Staff Attendance tab (web) or module (app). Staff still see their own attendance in their profile.
- **In time:** the time the person is marked Present / Late (tap or "Mark all present") or the ID card scan time. Before, the web register filled a fixed 08:00 AM.
- **Out time:** the school's dispersal time from School Settings → Timetable → "Dispersal / End Time" (server fills it when the app sends none, also for scans). Before, a fixed 02:30 PM. Absent / Leave have no in / out time.
- **Verified:** VP → 403 on register and scan; Principal / Super Admin → saved with in = now, out = settings; web tab hidden for VP; P/A toggles set / clear the times. Web + mobile `tsc`, build.

## Phase 55 — Public website: uploaded gallery photos now show, edits no longer delete photos
- **Gallery photos not showing (main bug):** an uploaded photo is saved with `imageUrl = /api/files/content?key=…`. The landing page wrapped that in a second `/api/files/content?key=`, so the address pointed at a file that does not exist and the server answered with its placeholder. New `src/utils/publicMedia.ts` `mediaSrc()` turns any stored value (key, file-API address, http, data:) into a working URL; used by the gallery, facilities, hero slider, about / management photos on the landing page and by the admin previews.
- **Editing deleted the photo:** the gallery edit form sent the photo as its address instead of its key, the server saw a "new" image and deleted the stored file (photo gone after changing only the title). Edits now keep the key, and the server compares storage keys (`storageKeyOf` / `deleteReplacedFile`) before deleting, for gallery, facilities, hero slides, leadership photos, events and notice attachments. Delete endpoints also resolve the real key.
- **Categories:** the landing filters were a fixed list that did not match the admin's categories (Smart Classes, Science Lab, Cultural, Annual Function…), so those photos never appeared under a filter. Landing filters now come from the photos; the admin list adds categories already used by older photos.
- **Hidden items:** "Hidden" gallery photos and facilities still showed on the website. `GET /api/gallery` and `/api/facilities` now return only active items in display order; the admin panel asks with `?all=true`.
- **Hero slider:** the mobile banner uploaded in Hero Slider is now used on phones (`<picture>`).
- **Management Team (admin):** a photo that fails to load shows initials instead of a broken image with overflowing alt text.
- **Verified:** upload → shown on landing (real JPEG); title edit → file still there; hidden photo → public 12 / admin 13; all 11 admin tabs and the landing page at 1366 px and 390 px without horizontal overflow or page errors. `tsc`, build.

## Phase 56 — Weekly offs from School Working Days; staff salary cut for absent and unmarked days
- **Weekly offs are dynamic:** the days ticked in Timetable → "Period Timings & Schedule Settings" → School Working Days are working days; every other weekday is a weekly off (default Monday–Saturday when nothing is saved). Shared rules in `src/utils/workingDays.ts` (server + website) and `mobile/src/utils/workingDays.ts` (app). Used by: website attendance calendar (students + staff), class register and its PDF, payroll, leave day counting (`leaveWorkingDates`), app attendance calendar (staff + student profiles) and the student/parent "My attendance" grid. Before, Sunday was hard-coded everywhere.
- **Salary cut (payroll):** on a working day (not a weekly off, holiday or approved leave) an Absent mark costs one day's salary (monthly ÷ 30), as before, and now a day with **no attendance mark** costs one day too (`notMarkedDays` / `notMarkedDeduction`, shown separately on the salary slip, salary detail, staff salary list, profiles and the app's My Payroll). Only days before "today" count, and only from `UNMARKED_SALARY_CUT_FROM` (2026-11-01) so older months that were never marked in the system are not cut after the fact.
- **Calendars show the cut:** staff calendars (website and app) mark each absent / unmarked past working day with "−1 day" and show a "Salary cut: N days" total with the rule. Student calendars do not.
- **Fix:** the website staff calendar used any staff member's record for a date when the person had none (`return true`); it now uses only this person's records.
- **Verified:** payroll unit checks (33, incl. Monday as weekly off, unmarked days, mid-month, holiday, approved leave, before the rule start), app calendar model (22), student grid, engagement rules, mobile offline suite; end to end on the local server: working days without Monday → website and app calendars show Mondays as OFF, an absent day shows "−1 day", October payroll counts 4 Monday offs and cuts ₹1,200 (₹36,000 ÷ 30) for the absence.

## Phase 57 — Edit Student: fee structure (custom fees after admission)
- **Edit Student → 7. Fee Structure:** the same fee heads as admission step 4. Switch a head on / off, change its amount for this student, add a custom fee (every month / one time / yearly / half-yearly / quarterly), remove a custom fee, undo, or reset to the class fee. Students admitted without a fee structure get "Set up from class fee". Transport, hostel and mess rows are read-only here (set in their own sections). Shows monthly / one-time / yearly totals with the old values and a "When you save" summary.
- **Billing rules** (`src/utils/feeProfileEdit.ts`, shared by the page and the server): monthly heads go into the coming monthly bills; one-time / yearly heads that are added or switched on are billed once right away in a separate bill (`INV-EXT-…`, billKind EXTRA); exam, books, late fee and facility heads keep their own rules; amount changes on a head already on and bills already made are not touched. For a student without a fee structure, the class fee settings are the "before", so admission charges are not billed again.
- **Who:** only users with `fees.structure.manage` (Super Admin, School Admin, or granted in Roles & Permissions) see the section; the server ignores fee-structure changes from others. Heads are cleaned on the server (names, amounts 0–1 crore, valid frequency) and totals recalculated. Audit log entry `STUDENT_FEE_STRUCTURE_UPDATE`.
- **Fix:** a day scholar who was given a hostel by editing kept switched-off hostel / mess heads, and because a listed head stops the facility charge, hostel and mess were never billed. Hostel / mess heads now follow the hostel residency on every save (like transport).
- `buildDefaultFeeHeads` moved out of `FeeStructureStep` so admission and edit start from the same list.
- **Verified:** `scripts/verify-fee-profile-edit.ts` (11 checks); API: custom one-time ₹500 + monthly ₹300 → bill ₹500, saving again → no second bill, Principal without the permission → change ignored, bad payload ignored; hostel allotted by edit → hostel + mess heads on, monthly ₹1,800 → ₹8,300, vacated → off; browser (1366 px and 390 px): set up from class fee, add custom fees, preview shows only the custom ₹500 bill, save → "New bill … ₹500", bill in the fee ledger.

## Phase 58 — Section dropdowns follow Academic Structure (admission, edit, promote, exams)
- **Bug:** the full-page admission form (Students → Admission, step 3 "Academic Enrollment & Previous School History") had a fixed "Section A / B / C" list, whatever sections the class has. The admission modal and Edit Student fell back to A / B / C, student Promote had a fixed A / B / C, the Students filter showed A / B / C for "All classes", and the exam form a fixed A–D.
- **Fix:** `src/utils/classSections.ts` `classSectionOptions()` gives a class's sections from Academic Structure (section list + detailed sections, switched-off ones left out, natural order); `sectionForClass()` keeps the chosen section when the class changes if the class has it, else its first section. Used by the admission page and modal, Edit Student, Promote, the Students filter and the exam form.
- **Fresh classes:** `src/hooks/useFreshClasses.ts` loads the class list from the server when a form opens and when the tab is opened again, so a section added in Academic Structure (on any computer) shows up without reloading. Admission forms also keep the chosen section valid after a refresh.
- **Verified:** `scripts/verify-class-sections.ts` (8 checks); browser: every class shows its own sections (Nursery A, Class 1 A,B …), adding section C to Class 5 and B to Nursery on the server shows them in the open admission form after returning to the tab, and in Edit Student (phone width); the old code showed A,B,C for every class.

## Phase 59 — Attendance → Student Calendar: search and class filter
- **Picker** (`src/components/attendance/StudentCalendarPicker.tsx`): class filter with "All classes", section filter, and a search on name, admission no., registration no. (spaces / dashes ignored) or roll no.; results with photo, numbers and class-section; count shown. The tab was a single drop-down of every student ("Student Ledger"); it is now "Student Calendar".
- **Teachers** see only the students of the classes they teach (all their teaching assignments; marking attendance stays limited to the class they are in charge of). Before, the list showed every student in the school.
- **Full records:** the chosen student's attendance is loaded from the server (`/api/attendance/student-calendar/:id`); before, only days already opened in this browser were used, so older months showed as "not marked". The student list is refreshed from the server when the tab opens.
- Register print legend says "Weekly off" instead of "Sunday / Off".
- **Verified (browser):** admin, 45 students — "rohan" → 9, "ADM-3669" → 1, "PDS2026100033" and "PDS2026-100033" → 1, Class 2 → 4, selecting opens the calendar; same at 390 px with no horizontal scroll; teacher → classes Class 2, Nursery, LKG and their 4 students, a student of another class not found.

## Phase 60 — Timetable period timings: time pickers, one timing for every class
- **Time pickers:** opening time, dispersal / end time and every period's start / end use the device's time picker (`<input type="time">`, 5-minute steps) instead of typing "08:00 AM". Values are still stored as "hh:mm AM/PM" (`src/utils/periodTimings.ts`).
- **Quick setup:** first period start, period length, periods a day, break after period N and break length create the whole day in one go. "Keep periods back to back": changing a time moves the later periods and keeps their lengths; adding a period continues after the last one. Each row shows its length.
- **Checks before saving** (same rules as the server): every period needs a start and end, end after start, no overlaps, dispersal after opening; warnings when a period starts before opening or ends after dispersal. Save is disabled while there are errors; a server refusal is shown in the dialog (before, any failure still showed "updated successfully" and kept the unsaved copy).
- **Same timing for all classes and sections:** slots copy their period's times when created, so after a change the old times stayed on lessons already scheduled. Saving now moves every slot of every class and section to the new times of its period (`applyPeriodTimingsToSlots` on `/api/timetables/config` and `/api/timetables/periods`) and reports lessons left in a period that became a break or was removed. The grid also shows the period's time.
- **Verified:** `scripts/verify-period-timings.ts` (12 checks); browser at 390 px and 1366 px: 18 time pickers, quick setup 08:00 + 8 × 40 min + 30 min break → 08:00–01:50; P1 end 08:50 moves the rest (last 02:00); end before start blocks save; save → "8 scheduled lessons moved", Nursery-A and the other class both at 08:00–08:50; overlapping periods → server 400 "P2 overlaps P1."; no element past the dialog edge.
