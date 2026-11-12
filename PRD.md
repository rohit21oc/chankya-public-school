# Product Requirements Document (PRD)

## RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
**Single-School Institutional ERP & Public Digital Campus Portal**

---

### 1. Document Overview & School Identity

* **Product Name:** Residential PDS Public School ERP & Digital Campus
* **School Name:** RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
* **Campus Address:** BRC Near Shahpur Road, Sheohar, Bihar - 843329
* **CBSE Affiliation Code:** 10030206405
* **School Code:** PDS-7821
* **Affiliated Board:** Central Board of Secondary Education (CBSE), New Delhi
* **Institutional Email:** residentialpdspublicschool@gmail.com
* **Primary Telephone:** +91 9507595491, +91 8271676713
* **Office & Landline Contacts:** +91 9939115492, 06222-796505
* **Current Academic Session:** 2026-2027

---

### 2. Architectural Scope & Product Philosophy

#### 2.1 Single-School Architecture (Non-Negotiable)
This system is engineered strictly as a **Single-School Enterprise Resource Planning (ERP) platform**. 
* **NOT Multi-Tenant:** There are no school IDs, tenant partitions, or multi-tenant database routing.
* **Centralized Single Campus:** All 33 database collections in MongoDB Atlas belong to RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR.
* **Database as Sole Production Source of Truth:** MongoDB Atlas is the single production source of truth. The backend maintains an existing in-memory fallback strictly for development or preview environments when MongoDB is unavailable.
* **Frontend Cache Boundary:** Frontend `localStorage` is strictly an optimistic, read, and offline-draft cache for instantaneous UI rendering; it is NEVER the backend production source of truth.
* **Institutional Ownership:** The branding, configuration, fee categories, academic sessions, and portal settings are dedicated solely to this campus.

#### 2.2 Core Product Mission
To provide an end-to-end institutional operating system that connects administrative leadership, teachers, accountants, hostel wardens, transport coordinators, students, and parents into a single, cohesive, high-performance platform. It pairs an internal administrative ERP with a public-facing CBSE-compliant school website, real-time enquiry desk, and public result verification system.

---

### 3. User Personas & Role-Based Access Control (RBAC)

The ERP enforces granular permissions across twelve institutional user roles (10 Staff/Admin roles + Student + Parent):

| Role ID | Role Label | Description & Responsibilities | Key Permissions |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | Super Administrator | Executive technical administrator, developer, or chairman with unrestricted access. | Full CRUD on all ERP data, user accounts, system configuration, audit logs, and API docs. |
| `SCHOOL_ADMIN` | School Administrator | Head administrative manager handling day-to-day campus operations and records. | Management of students, staff, fees, classes, timetables, website CMS, and settings. |
| `PRINCIPAL` | Principal / Head of School | Academic head supervising faculty, approvals, report cards, notices, and institutional metrics. | Full visibility across student records, academic performance, exam approvals, staff attendance, and reports. |
| `VICE_PRINCIPAL` | Vice Principal | Senior administrator supervising discipline, secondary academics, and faculty coordination. | Oversight of student records, exams, discipline, timetable clashing, attendance, and faculty support. |
| `ACADEMIC_COORDINATOR` | Academic Coordinator | Curriculum lead managing subject allocations, pedagogical plans, and lesson evaluations. | Subject schedules, timetable assignments, marks roster review, academic materials, and teacher reviews. |
| `ACCOUNTANT` | Accounts Officer | Financial manager overseeing billing, payments, fee heads, waivers, and collection ledgers. | Fee configurations, invoicing, payment collection, fee ledgers, receipts, and financial reports. |
| `TEACHER` | Faculty Member | Class teachers and subject educators managing classroom operations. | Student attendance marking, homework publishing, study material uploads, marks entry, and notice broadcasting. |
| `HOSTEL_WARDEN`| Hostel Warden | In-charge of student residential quarters, room allocations, and hostel amenities. | Hostel building setup, room capacity management, student allocation, and residential records. |
| `TRANSPORT_MANAGER` | Transport Officer | Fleet manager handling bus routes, stops, vehicle maintenance, and transit allocations. | Vehicle registry, route definitions, transport slab pricing, and student route allocation. |
| `HR_STAFF` | HR / Staff Manager | Personnel officer managing staff directory, onboarding, staff attendance, leaves, and payroll. | Staff profiles, teacher attendance logging, biometric/leave records, and staff ID cards. |
| `PARENT` | Parent / Guardian | Father, mother, or legal guardian monitoring their enrolled child/children. | View child's academic reports, daily attendance, fee ledger, fee payment status, timetables, and homework. |
| `STUDENT` | Enrolled Student | Admitted student accessing learning materials, assignments, and exam cards. | View personal timetable, homework tasks, downloadable study materials, exam dates, report cards, and notices. |

---

### 3.1 Authentication & Password Management Specification (Strict Architecture)

#### 3.1.1 Exactly Three Login Experiences
The system provides exactly three distinct login experiences:
1. **STAFF / ADMIN LOGIN (One Common Login Page):**
   - Single unified authentication entry point supporting all 10 administrative and faculty roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`).
   - Strictly NO separate login pages for Teacher, Admin, Principal, Accountant, etc.
   - User inputs User ID, Employee ID (e.g. `PDS0001` - `PDS0010`), Email, or Phone + Password.
   - **Backend Authorization Mandate:** Role is determined exclusively and securely on the backend from authoritative database records upon verification. The frontend NEVER chooses, switches, or submits a user role.
2. **STUDENT LOGIN:**
   - Case-insensitive 8-digit Admission Number (e.g., `64010001`) or Registration Number (`PDS2026100001`).
   - Verified securely against student's Date of Birth (DD-MM-YYYY format with leap year validation) or custom portal password.
3. **PARENT LOGIN:**
   - 10-digit registered parent mobile number.
   - Verified securely against linked child's Date of Birth (DD-MM-YYYY) or portal password. Automatically associates all enrolled siblings to the parent session with live child-switching.

#### 3.1.2 Password Management Architecture
- **Forgot Password Flow:** Users submit their registered email address or identifier. A cryptographically random 32-byte token is generated, hashed with SHA-256, stored with a strict 15-minute expiration, and sent via Brevo Transactional Email API (`server/services/emailService.ts`). Tokens and raw reset URLs are never exposed in UI or API responses.
- **Token Redemption (`/reset-password?token=...`):** Single-use, validated, immediate invalidation of token upon password update, and session revocation across existing sessions.
- **Logged-In Password Change (`POST /api/auth/change-password`):** Authenticated users can update their password by confirming their current password and providing a new password (min 6 chars, bcrypt 10 rounds). Other active sessions are invalidated.
- **Admin Password Management & RBAC:**
  - `SUPER_ADMIN` can reset passwords for any account (Admins, Principal, Faculty, Students, Parents).
  - `SCHOOL_ADMIN` and `PRINCIPAL` can reset passwords for Faculty, Staff, Students, and Parents, but are strictly forbidden by backend RBAC from resetting `SUPER_ADMIN` or each other's credentials (HTTP 403 Forbidden).
  - All passwords are securely hashed using bcrypt (10 salt rounds); plaintext passwords are never stored or logged.
  - Temporary passwords generated by administrators are dispatched via Brevo Transactional Email API when requested.
- **Student Admission & Parent Credential Dispatch:**
  - Upon student enrollment, if a parent email exists, an official admission confirmation and portal access email is sent via Brevo with Admission Number / login ID and security guidance.
- **Staff Account Creation Dispatch:**
  - Upon creating a new staff account, employee login ID and temporary password are sent to their registered email through Brevo with mandatory instruction to change password on first login.

---

### 4. Functional ERP Modules

#### 4.1 Student Admission & Student Management
* **Module Identifier:** `students`
* **Purpose:** Complete lifecycle management of students from admission enquiry to alumni status.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `ACCOUNTANT`, `PARENT`.
* **Core Workflows:**
  1. *New Student Admission Wizard:* Multi-step admission wizard:
     - Step 1: Personal Details & Photo (Cloudflare R2 direct presigned upload).
     - Step 2: Parent/Guardian Details (Father, Mother, Guardian, Emergency contacts, Address).
     - Step 3: Academic Information (Class selection, Section, Academic Session, Previous Schooling, Enrollment Date).
     - Step 4: Fee Structure & Facilities Configuration:
       - Configured fee heads checked by default: Admission Fee, School Fee, Exam Fee, Uniform / Dress Code, Books & Stationery, and ID Card Fee.
       - Optional fee heads (Tuition, Computer, Sports, Medical, Transport, Hostel) follow policy and opt-in choices.
       - Authorized staff can manually uncheck fee heads or adjust amounts for scholarships/waivers.
       - Dynamic class-wise fee structure loaded from MongoDB `fee_configurations`.
       - Automatic calculation of Admission Payable, Monthly Payable, Annual/Exam dues, and Total Session fee without hardcoded figures.
     - Step 5: Document Uploads (Birth Certificate, TC, Previous Marksheet, Aadhaar).
     - Step 6: Portal Access & Confirmation.
  2. *Admission Confirmation & Instant One-Time Invoice Generation:*
     - Generates the student record and immediately creates a dedicated payable invoice for all selected one-time admission charges.
     - Clear "Pay Admission Fee" action in the admission workflow allows immediate fee collection at admission time.
     - Supports all payment methods (Cash, UPI, Bank Transfer, Cheque) and partial payments.
     - Automatically generates official printable receipt upon successful payment.
     - Never marks invoices as paid without a recorded payment transaction; prevents duplicates on refresh/retry.
  3. *Student Directory & Filtering:* Searchable by student name, admission number, roll number, class, section, status, and gender.
  4. *Student Profile View:* Detailed 360-degree view displaying personal details, academic history, attendance percentage, fee payment status, linked parent accounts, and issued documents.
  5. *Student Edit & Status Updates:* Inline or modal editing of student data with audit logging. Ability to promote students or transfer them out.
* **Data Entities:** `Student` (schema defined in `server/models/Student.ts`).
* **Existing APIs:**
  - `GET /api/students` (supports pagination, filtering by class, section, status)
  - `GET /api/students/:id`
  - `POST /api/students` (creates student record and automatically generates linked parent login account)
  - `PUT /api/students/:id` / `PATCH /api/students/:id`
  - `PATCH /api/students/:id/status`
  - `DELETE /api/students/:id`
  - `GET /api/students/next-numbers` (retrieves next sequential admission and roll number)
  - `GET /api/students/stats` (class-wise and gender-wise demographic distribution)
* **Persistence:** MongoDB Atlas `students` collection. Binary photos stored in Cloudflare R2 via `/api/files/presign-upload` or `/api/files/stream-upload`.

---

#### 4.2 Faculty & Staff Management
* **Module Identifier:** `teachers`
* **Purpose:** Personnel administration for teaching faculty, administrative personnel, and support staff.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `HR_STAFF`.
* **Core Workflows:**
  1. *Staff Onboarding:* Adding teachers/staff with Employee ID (e.g., `EMP-101`), full name, email, phone, system role (`TEACHER`, `PRINCIPAL`, `ACCOUNTANT`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`), designation, department, qualification, joining date, salary grade, and address.
  2. *Portal Access Management:* Creating staff portal credentials, resetting passwords, and toggling portal login permission.
  3. *Staff Directory:* Filterable by department (Science, Mathematics, Humanities, Sports, Administration), role, and employment status.
  4. *Faculty Full Profile & ID Card:* Dedicated view of qualifications, allocated subjects, assigned class teacher roles, and one-click printable staff ID card.
* **Data Entities:** `TeacherStaff` (`server/models/Staff.ts`), `StaffLeave` (`server/models/StaffLeave.ts`), `StaffPayrollRecord` (`server/models/StaffPayroll.ts`), `User` (`server/models/User.ts`).
* **Existing APIs:**
  - `GET /api/staff` / `GET /api/teachers`
  - `POST /api/staff` / `POST /api/teachers`
  - `PUT /api/staff/:id` / `PUT /api/teachers/:id`
  - `DELETE /api/staff/:id` / `DELETE /api/teachers/:id`
  - `GET /api/staff-leaves`, `POST /api/staff-leaves`, `PUT /api/staff-leaves/:id/status`
  - `GET /api/staff-payroll`, `POST /api/staff-payroll`
  - `PATCH /api/teachers/:id/portal-status`
  - `POST /api/teachers/:id/reset-password`
  - `POST /api/teachers/:id/resend-credentials`
* **Persistence:** MongoDB Atlas `staff`, `staff_leaves`, and `staff_payroll` collections, synchronized with `users` collection.

---

#### 4.3 Academic Structure (Classes, Sections, Subjects & Grading)
* **Module Identifier:** `academics` (or `academic`)
* **Purpose:** Institutional hierarchy defining academic sessions, grade levels, sections, subjects, and grading systems.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`.
* **Core Workflows:**
  1. *Academic Sessions:* Creation and activation of institutional sessions (e.g., `2025-2026`, `2026-2027`, `2027-2028`) with start and end dates. Changing active session updates global ERP context.
  2. *Classes & Sections:* Managing classes (e.g., Nursery to Grade 12) with numeric order, standard sections (A, B, C), room assignments, capacity limits, and assigned Class Teachers.
  3. *Subject Management:* Defining subjects (e.g., English, Mathematics, Science, Social Studies, Hindi, Sanskrit, Computer Science), subject codes (e.g., `MATH-101`), subject types (Theory, Practical, Co-Curricular), and maximum marks.
  4. *Grading System Modal:* CBSE 9-point or percentage-based grading configuration (A1, A2, B1, B2, C1, C2, D, E1, E2) with min/max percentage thresholds.
* **Data Entities:** `AcademicClass` (`server/models/Class.ts`), `Subject` (`server/models/Subject.ts`), `SchoolSettings` (`server/models/SchoolSettings.ts`).
* **Existing APIs:**
  - `GET /api/classes`, `POST /api/classes`, `PUT /api/classes/:id`, `DELETE /api/classes/:id`
  - `GET /api/subjects`, `POST /api/subjects`, `PUT /api/subjects/:id`, `DELETE /api/subjects/:id`
  - `GET /api/academic-sessions`, `POST /api/academic-sessions`, `PUT /api/academic-sessions/:id`, `POST /api/academic-sessions/:id/activate`, `DELETE /api/academic-sessions/:id`
* **Persistence:** MongoDB Atlas `classes`, `subjects`, and `school_settings` collections.

---

#### 4.4 Attendance Management
* **Module Identifier:** `attendance`
* **Purpose:** Daily attendance capture and tracking for both students and staff members.
* **Target Users:** `TEACHER`, `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `HR_STAFF`, `PARENT`.
* **Core Workflows:**
  1. *Student Daily Attendance Marking:*
     - Select Class, Section, and Date.
     - View student roster populated automatically.
     - Mark status: `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `EXCUSED_LEAVE`.
     - Quick "Mark All Present" toggle.
     - Add remarks (e.g., "Medical Leave", "Family Function").
     - Bulk submission with real-time SSE notification broadcast.
  2. *Staff Daily Attendance:*
     - Daily presence logging for faculty and administration.
     - Time-in, time-out recording, leave balance adjustments, and payroll linkage.
  3. *Attendance Analytics:* Monthly attendance percentage per student, class-level attendance averages, and absentee lists.
* **Data Entities:** `AttendanceRecord` (`server/models/Attendance.ts`), `StaffAttendanceRecord` (`server/models/Attendance.ts`).
* **Existing APIs:**
  - `GET /api/attendance` (filter by date, classId, section, studentId)
  - `POST /api/attendance` (bulk upsert for class roster)
  - `GET /api/staff-attendance`
  - `POST /api/staff-attendance`
* **Persistence:** MongoDB Atlas `attendance` and `staff_attendance` collections.

---

#### 4.5 Weekly Master Timetable
* **Module Identifier:** `timetable`
* **Purpose:** Grid-based scheduling of classroom periods across all six academic days (Monday through Saturday).
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `STUDENT`, `PARENT`.
* **Core Workflows:**
  1. *Period Configuration:* Setting standard daily periods (e.g., Period 1 to Period 8, Morning Assembly, Zero Period, Lunch Recess) with exact start and end times.
  2. *Timetable Matrix Editor:*
     - Interactive grid: Days of the week as rows, periods as columns.
     - Class-wise view and Teacher-wise view.
     - Assign subject, teacher, and classroom room number to each slot.
     - Teacher Conflict Detection: Prevents double-booking a teacher in two different classes during the same period.
  3. *PDF Export:* High-resolution printable timetable matrix for classroom display and teacher schedules via `src/utils/timetablePdf.ts`.
* **Data Entities:** `TimetableSlot` (`server/models/Timetable.ts`), `TimetablePeriodConfig` (`server/models/Timetable.ts`).
* **Existing APIs:**
  - `GET /api/timetables` / `GET /api/timetable` (filter by classId, section, teacherId, dayOfWeek)
  - `POST /api/timetables` / `POST /api/timetable`
  - `PUT /api/timetables/:id`
  - `DELETE /api/timetables/:id`
  - `POST /api/timetables/bulk`
  - `GET /api/timetables/periods`, `POST /api/timetables/periods`
* **Persistence:** MongoDB Atlas `timetable` and `timetable_periods` collections.

---

#### 4.6 Fees & Financial Accounts Management
* **Module Identifier:** `fees`
* **Purpose:** Institutional fee lifecycle management including category configuration, class fee structures, student fee ledgers, automated monthly billing, payment collection, invoicing, and thermal/A4 receipts.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `ACCOUNTANT`, `PRINCIPAL`, `PARENT`, `STUDENT`.
* **Core Workflows:**
  1. *Fee Structure & Category Setup:*
     - Class-wise fee templates: Tuition Fee, Admission Fee, Examination Fee, Laboratory Fee, Library Fee, Sports Fee, Computer Fee.
     - Frequency: Monthly, Quarterly, Half-Yearly, Yearly, One-Time.
     - Category Tabs: Monthly Fees, Yearly Fees, General Fees, Exam Fees, Hostel Fees, Transport Slabs.
     - Copy Fee Config Modal: Clone complete fee setup from one class to other classes in one click.
  2. *Transport Slabs Manager:*
     - Distance-based slab configuration (e.g., 0-3 km: ₹500, 3-6 km: ₹800, 6-10 km: ₹1200, 10+ km: ₹1500).
     - Automatically applied to students enrolled in school bus transit.
  3. *Automated & Monthly Ledger Generation:*
     - Billing Cycle Anchor: Monthly fee billing begins strictly from the student's actual Enrollment Date. No monthly fees are charged prior to enrollment date.
     - Enrollment Month Rule: Monthly fees for a student's enrollment month are not billed as a full monthly charge; the first monthly installment becomes due in the subsequent month (e.g., student enrolled 11 September 2026 -> first monthly installment due 10 October 2026, payable 1 October - 10 October).
     - Payable Window: Monthly fee is payable from the 1st through the 10th of each applicable month.
     - Overdue Late Fee Rule: Starting on the 11th, if the applicable monthly invoice remains unpaid or has an outstanding balance, a ₹50 late fee is applied per overdue monthly invoice.
     - Single Penalty Application: Late fee is applied only once per invoice; repeated page visits, scheduled background jobs, retries, or payment attempts must never add duplicate penalties (`lateFeeApplied: true`).
     - Paid Invoice Immunity: Fully paid invoices never receive a late fee. Partial payments calculate the remaining balance correctly (`pendingAmount = total - paidAmount`).
     - Configurable Penalty: The ₹50 late fee penalty is configurable in fee settings (`schoolSettings.feeSettings.lateFeeAmount`) by authorized administrators.
     - Timezone Standard: All billing dates, overdue calculations, and scheduled jobs run against `Asia/Kolkata` timezone.
  4. *Payment Collection & Admission-Time Payment:*
     - Admission-Time Payment: At admission, an initial payable invoice for all selected one-time charges is immediately generated and ready for collection.
     - Search student by Admission No, Name, or Mobile.
     - Clear visibility of invoice month, due date, outstanding amount, late fee, and total payable across fee ledger and payment screens.
     - Payment modes: Cash, Online/UPI, Bank Transfer, Cheque, Demand Draft.
     - Supports Partial Payment, Excess/Advance Payment, Fine Waiver, and Discount.
     - Instant generation of Printable Receipt (`PrintableReceiptModal`) with institutional header, student details, itemized breakdown, and authorized signature stamp.
     - Never marks an invoice as paid unless payment is successfully recorded in MongoDB Atlas; idempotent payment execution prevents duplicates.
  5. *Invoicing & Custom Bills:*
     - `AddBillModal`: Add ad-hoc fee charges (e.g., Annual Sports Kit, Field Trip, Lost ID Card replacement).
     - `GenerateInvoiceModal` & `InvoiceDetailModal`: Official tax/fee invoice generation with invoice number, GSTIN (if applicable), and due dates.
* **Data Entities:** `FeeStructure`, `ClassFeeConfiguration`, `TransportSlab`, `FeePayment`, `FeeLedgerEntry` (`server/models/Fee.ts`, `server/models/Transport.ts`).
* **Existing APIs:**
  - `GET /api/fees/structures`, `POST /api/fees/structures`, `PUT /api/fees/structures/:id`, `DELETE /api/fees/structures/:id`
  - `GET /api/fee-configurations`, `POST /api/fee-configurations`, `PUT /api/fee-configurations/:id`, `DELETE /api/fee-configurations/:id`
  - `GET /api/transport-slabs`, `POST /api/transport-slabs`, `PUT /api/transport-slabs`, `DELETE /api/transport-slabs/:id`
  - `GET /api/fees/payments`, `POST /api/fees/payments`
  - `GET /api/fee-ledgers`, `GET /api/fee-ledgers/student/:studentId`
  - `POST /api/fee-ledgers/generate-monthly` (batch)
  - `POST /api/fee-ledgers/student/:studentId/generate-monthly`
  - `POST /api/fee-ledgers/:id/collect` (single ledger payment)
  - `POST /api/fee-ledgers/student/:studentId/pay-full` (lump-sum clearing)
  - `POST /api/fee-ledgers/bill` (custom bill)
* **Persistence:** MongoDB Atlas collections: `fee_structures`, `fee_configurations`, `transport_slabs`, `fee_payments`, `fee_ledgers`.

---

#### 4.7 Transport Management
* **Module Identifier:** `transport`
* **Purpose:** Fleet administration, school bus route mapping, stop definitions, and student transport allocation.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TRANSPORT_MANAGER`, `PRINCIPAL`.
* **Core Workflows:**
  1. *Vehicle Registry:* Bus/Van number, vehicle model, capacity (seats), driver name, driver mobile number, helper/conductor name, insurance & fitness expiry dates.
  2. *Route Management:* Route title (e.g., Route 1: Sheohar BRC to Piprahi), vehicle assignment, list of stops with pick-up/drop-off times and distance slabs.
  3. *Student Transport Allocation:* Assign student to a vehicle and route stop. Automatically binds the corresponding transport slab fee to the student's monthly fee ledger.
* **Data Entities:** `TransportVehicle` (`server/models/Transport.ts`), `TransportRoute` (`server/models/Transport.ts`).
* **Existing APIs:**
  - `GET /api/transport` (returns vehicles and routes)
  - `POST /api/transport/allocate` (binds student to route and stop)
* **Persistence:** MongoDB Atlas `vehicles` and `routes` collections.

---

#### 4.8 Hostel & Residential Life
* **Module Identifier:** `hostel`
* **Purpose:** Management of residential students, hostel buildings, room inventory, bed allotments, and warden supervision.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `HOSTEL_WARDEN`, `PRINCIPAL`.
* **Core Workflows:**
  1. *Hostel Building Setup:* Hostel name (e.g., Boys Senior Hostel, Girls Junior Hostel), hostel type (Boys/Girls/Combined), warden in charge, contact details, total room capacity.
  2. *Room Inventory:* Room numbers, floor levels, room types (Single, Double, 4-Bed Dormitory, 8-Bed Hall), total bed capacity, monthly hostel fee per occupant.
  3. *Student Bed Allocation:* Assign student to an available room and bed. Updates student's residential status (`isHostel: true`) and links the monthly hostel fee to billing ledgers.
* **Data Entities:** `Hostel` (`server/models/Hostel.ts`), `HostelRoom` (`server/models/Hostel.ts`).
* **Existing APIs:**
  - `GET /api/hostels` (returns hostels and rooms)
  - `POST /api/hostels/allocate` (allocates student to room/bed)
* **Persistence:** MongoDB Atlas `hostels` and `hostel_rooms` collections.

---

#### 4.9 Examinations, Marks & Report Cards
* **Module Identifier:** `exams`
* **Purpose:** Assessment cycle management from exam scheduling to subject-wise marks entry, tabulations, approval workflows, and CBSE-compliant printable report cards.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `STUDENT`, `PARENT`.
* **Core Workflows:**
  1. *Exam Creation:* Setting up exams (e.g., Term 1 Examination, Half-Yearly, Pre-Board, Annual Examination 2026) with start/end dates, academic session, applicable classes, and passing criteria.
  2. *Marks Entry Roster:*
     - Select Exam, Class, Section, and Subject.
     - Tabular marks roster populated with all enrolled students.
     - Entry of Theory marks, Practical/Internal Assessment marks, and teacher remarks.
     - Validation: Flags marks exceeding maximum allowed limits.
  3. *Approval Workflow:* Teachers submit marks; Principal reviews and approves (`PUT /api/exams/:id/approve`), locking records against unauthorized tampering.
  4. *CBSE-Compliant Report Card:* High-fidelity printable modal (`PrintableReportCardModal`) featuring institutional emblem, student demographic details, term-wise scholastic marks, co-scholastic grades (Work Education, Art, Health & Physical Education), discipline grade, class attendance percentage, teacher remarks, and principal's signature box.
* **Data Entities:** `Exam` (`server/models/Exam.ts`), `ExamMark` (`server/models/Exam.ts`).
* **Existing APIs:**
  - `GET /api/exams`, `POST /api/exams`, `PUT /api/exams/:id`, `DELETE /api/exams/:id`
  - `PUT /api/exams/:id/approve`
  - `GET /api/marks` (filter by examId, classId, section, studentId)
  - `POST /api/marks` / `POST /api/exams/marks`
* **Persistence:** MongoDB Atlas `exams` and `exam_marks` collections.

---

#### 4.10 Communication Center, Official Circulars & SMS Gateway
* **Module Identifier:** `communication`
* **Purpose:** Multi-channel broadcast of institutional circulars, official announcements, homework assignments, downloadable learning resources, and real-time SMS broadcasts via institutional SMS gateway.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `STUDENT`, `PARENT`.
* **Core Workflows:**
  1. *Institutional Notice & Circular Management (`NoticesTab`):*
     - Create, view, edit, unpublish/publish, and delete circulars with title, content, priority (`NORMAL`, `IMPORTANT`, `URGENT`), category/type (`GENERAL`, `ACADEMIC`, `EXAM`, `RESULT`, `HOLIDAY`, `EVENT`, `FEE`, `ADMISSION`, `EMERGENCY`), status (`DRAFT`, `PUBLISHED`, `EXPIRED`), publish date, and optional expiry date.
     - Dynamic status evaluation: Notices with `expiryDate < today` automatically evaluate to `EXPIRED`.
     - Target Audience Filtering: Supports `ALL` (Entire School), `STUDENTS`, `PARENTS`, `STAFF`, `CLASS` (specific class and section), and `INDIVIDUAL` (selected student IDs).
     - Strict Backend RBAC: Public visitors only see `PUBLISHED` notices marked for public/all; Students only see `PUBLISHED` notices matching `ALL`, `STUDENTS`, their specific class, or their individual student ID; Parents only see `PUBLISHED` notices matching `ALL`, `PARENTS`, or their linked children's classes/IDs; Staff and Admins have access to draft/preview circulars.
     - Cloudflare R2 Attachments: Official circulars support PDF, DOCX, and image attachments up to 25MB uploaded to Cloudflare R2 storage with file preview and download modals.
     - Immediate SMS Broadcast Option: Toggling instant SMS broadcast upon circular creation dispatches real-time SMS alerts to registered parent mobile numbers of the targeted audience.
  2. *SMS Gateway Dispatch Center (`SmsCenterTab`):*
     - Real-time institutional SMS gateway integration with provider support (PDS Gateway / Fast2SMS) and sender ID (`PDSSHR`).
     - Live Gateway Telemetry: Today dispatched, today failed, total dispatched, and active provider statistics from MongoDB Atlas.
     - Quick Automated Triggers: Pre-configured, one-click institutional trigger workflows for Daily Absentees, Overdue Fee Reminders, Exam Schedule Announcements, Admit Cards Published, Results Declared, and Emergency Weather/Holiday Advisories.
     - Live Quick Trigger Preview (`GET /api/sms/quick-triggers/preview`): Calculates total eligible recipients, validates 10-digit Indian mobile numbers, counts already-sent messages today, and renders a live resolved sample message with GSM credit unit estimation (160 characters/unit) without sending.
     - Custom SMS Broadcast Composer (`SmsComposerModal`): Custom recipient targeting by All Parents, Specific Class/Section, Selected Students, or Manual 10-Digit Mobile Number with real-time character counter and SMS credit calculations.
  3. *Strict Server-Side Idempotency & Duplicate-Send Protection:*
     - Every SMS dispatch requires a unique server-side `idempotencyKey` (e.g., `absentee-{studentId}-{date}`, `admit-card-{examId}-{studentId}`, `fee-reminder-{studentId}-{month}-{date}`).
     - Backed by an atomic compound unique index in MongoDB Atlas (`idempotencyKey: 1` in `sms_logs`).
     - Repeated API submissions, rapid clicks, network retries, or page refreshes automatically detect existing sent records, skip duplicates, and guarantee zero duplicate charges or message sends.
  4. *Persistent SMS Audit History & Telemetry (`SmsHistoryTab`):*
     - Full audit trail stored in MongoDB Atlas `sms_logs` collection with pagination, search, status filtering (`SENT`, `FAILED`), trigger type filtering, and date filtering.
     - Inspection modal (`SmsLogDetailsModal`) displaying full message text, character count, credit units, gateway provider message ID, timestamp, recipient name, phone, linked student, and idempotency key.
  5. *Automated System Integration Pipelines (`AutoNotificationsTab`):*
     - **Examination & Admit Card Lifecycle:** Publishing exams or declaring results automatically creates official circulars in MongoDB Atlas and enables instant SMS alerts. Publishing admit cards automatically creates an Admit Card notice and triggers parent notifications.
     - **Fee Dues & Overdue Engine:** Automated monthly fee engine identifies pending balances past the 10th of the month and delivers personalized fee reminders.
     - **Daily Attendance Integration:** Morning roll call marking ABSENT automatically triggers Daily Absentee SMS alerts to registered parent phones.
  6. *Homework & Study Materials:*
     - Subject teachers publish homework with due dates and attachments.
     - Direct presigned upload to Cloudflare R2 with fallback to backend stream gateway (`PUT /api/files/stream-upload/:fileKey(*)`). File metadata indexed in MongoDB `file_metadata`.
* **Data Entities:** `Notice` (`server/models/Notice.ts`), `SmsLog` (`server/models/SmsLog.ts`), `Homework` (`server/models/Homework.ts`), `StudyMaterial` (`server/models/StudyMaterial.ts`), `R2FileMetadata` (`server/models/FileMetadata.ts`).
* **Existing APIs:**
  - `GET /api/notices`, `POST /api/notices`, `PUT /api/notices/:id`, `DELETE /api/notices/:id`, `POST /api/notices/cleanup-duplicates`
  - `GET /api/sms/stats`, `GET /api/sms/history`, `GET /api/sms/quick-triggers/preview`, `POST /api/sms/quick-triggers/dispatch`, `POST /api/sms/send`
  - `GET /api/homework/options` (assignable class → section → subject tree), `GET /api/homework`, `POST /api/homework`, `PUT /api/homework/:id`, `DELETE /api/homework/:id`
  - `GET /api/study-materials`, `POST /api/study-materials`, `DELETE /api/study-materials/:id`
* **Persistence:** MongoDB Atlas `notices`, `sms_logs`, `homework`, `study_materials`, `file_metadata`. Attachments in Cloudflare R2 bucket (`pds-school`).

---

#### 4.11 Documents, ID Cards & Certificates
* **Module Identifier:** `documents`
* **Purpose:** Issuance of standardized, institutional student ID cards, teacher ID cards, and official administrative certificates.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `STUDENT`.
* **Core Workflows:**
  1. *Student ID Card Generation:*
     - Single student or batch generation by Class and Section.
     - Dual-sided card design (Front: School emblem, student photo from R2, full name, class, section, roll no, blood group, emergency contact; Back: Terms, transport route, campus address, principal's signature).
     - QR Code containing student verification payload.
     - Printable modal with print-isolation CSS (`@media print` isolation in `src/index.css`).
     - Batch PDF Export via `idCardPdfExporter.ts` and `jspdf`.
  2. *Teacher & Staff ID Cards:* Standard institutional ID cards for employees with employee ID, designation, and blood group.
  3. *Official Certificates (`PrintableCertificateModal`):*
     - Transfer Certificate (TC) with serial number, admission date, leaving date, conduct, and reason.
     - Character Certificate.
     - Bonafide / Enrolment Certificate.
* **Data Entities:** Dynamic rendering based on `Student`, `TeacherStaff`, and `SchoolSettings`.
* **Persistence:** Real-time generation from MongoDB records.

---

#### 4.12 Public Website, Landing Page & CMS
* **Module Identifiers:** Public Website (`/`, `/website`), Public CMS (`public-website-management`), Online Results (`/results`)
* **Purpose:** Public-facing institutional presence, CBSE mandatory public disclosures, online admission enquiries, and public result verification.
* **Target Users:** General public, prospective parents, current parents, inspecting authorities, and ERP administrators.
* **Core Sections & CMS Tabs:**
  1. *Hero Carousel:* High-impact banner slides with title, subtitle, call-to-action buttons, and background images managed via CMS.
  2. *About Institutional Profile:* School history, vision, mission, and principal's message.
  3. *Academic Programs:* Overview of curriculum from Pre-Primary, Primary, Middle, to Secondary/Senior Secondary.
  4. *Facilities Showcase:* Smart classrooms, computer laboratories, composite science labs, sports grounds, digital library, and transport fleet.
  5. *Leadership & Management Team (`PublicManagementTeamSection`):* Profiles of Chairman, Director, Principal, and Advisory Board with photographs and biographies. Frontend features a responsive carousel/slider showing 3 member cards at a time on desktop (2 on tablet, 1 on mobile) with automatic 3-second horizontal sliding, dynamic pagination dots (generating exactly N dots for N active members), interactive touch swipe/mouse drag, previous/next controls, interaction-pause with auto-resume, seamless circular looping, and modal/direct URL routing (`/management/:id`, `/leadership/:id`). MongoDB Atlas remains the single source of truth with real-time updates.
  6. *Public Notice Board:* Real-time ticker and bulletin board of active circulars and CBSE announcements.
  7. *Photo & Video Gallery:* Event categories (Annual Day, Sports Meet, Science Exhibition, Independence Day).
  8. *Admission Enquiry Desk (`QuickEnquiryModal`):* Prospective parent enquiry form capturing parent name, email, phone, child name, target class, and query. Real-time logging into `admission_enquiries` for administrative follow-up.
  9. *CBSE Mandatory Public Disclosure Modal:* Documents including affiliation letter, trust deed, building safety certificate, fire safety certificate, and academic calendar.
  10. *Public Online Result Checking (`/results`):* Direct portal enabling students and parents to enter Admission Number/Roll Number and view verified term results.
* **Data Entities:** `FacilityModel`, `GalleryItemModel`, `HeroSlideModel`, `LeadershipProfileModel`, `WebsiteEventModel`, `AdmissionEnquiryModel`, `WebsiteContentModel` (`server/models/PublicWebsite.ts`).
* **Existing APIs:**
  - `GET /api/public/content`, `PUT /api/public/content`
  - `GET /api/public/hero-slides`, `POST /api/public/hero-slides`, `PUT /api/public/hero-slides/:id`, `DELETE /api/public/hero-slides/:id`
  - `GET /api/public/leadership`, `POST /api/public/leadership`, `PUT /api/public/leadership/:id`, `DELETE /api/public/leadership/:id`
  - `GET /api/public/events`, `POST /api/public/events`, `PUT /api/public/events/:id`, `DELETE /api/public/events/:id`
  - `GET /api/facilities`, `POST /api/facilities`, `PUT /api/facilities/:id`, `DELETE /api/facilities/:id`
  - `GET /api/gallery`, `POST /api/gallery`, `PUT /api/gallery/:id`, `DELETE /api/gallery/:id`
  - `POST /api/public/enquiry`, `GET /api/public/enquiry/status`, `GET /api/enquiries`, `PUT /api/enquiries/:id`, `DELETE /api/enquiries/:id`
* **Persistence:** MongoDB Atlas collections: `website_content`, `hero_slides`, `leadership`, `website_events`, `facilities`, `gallery`, `admission_enquiries`.

---

#### 4.13 Authentication, User Accounts & Password Reset
* **Module Identifier:** `login`, `reset-password`, `profile`
* **Purpose:** Secure multi-role authentication, password security, session persistence, and Brevo Transactional Email API notifications.
* **Target Users:** All user personas.
* **Core Workflows:**
  1. *Unified Multi-Role Login:*
     - Identifier input accepts: Username, Email, Normalized Mobile Phone (10 digits), Employee ID (e.g., `EMP-101`), Student Admission Number (e.g., `PDS-2026-0001`), or Registration Number.
     - Password verification using `bcrypt` (10 salt rounds).
     - Account lockout protection: 5 consecutive failed login attempts trigger a 15-minute temporary lockout.
     - "Remember Me" toggle creates a 7-day JWT token; standard session creates a 12-hour JWT token.
  2. *Parent Multi-Student Switching:* Parents with multiple enrolled children can seamlessly toggle between children (`/api/auth/switch-child`) without logging out.
  3. *Password Reset via Email:*
     - User enters registered email or phone on `/login?forgot=true`.
     - Backend verifies identity, generates a cryptographically secure 32-byte hex token, hashes it via SHA-256 for database storage, and sets a 15-minute expiration timestamp.
     - Dispatches an institutional email via **Brevo Transactional Email API** (`server/services/emailService.ts`).
     - Email contains a direct one-click link resolving to the canonical frontend domain (`/reset-password?token=...`).
     - The user enters a new password on `/reset-password`, which is validated, hashed with bcrypt, and saved to MongoDB.
  4. *Direct Admin Password Management:* Administrators can reset user passwords directly or trigger automated credential re-sends from user detail panels via Brevo.
* **Data Entities:** `UserDoc` (`server/models/User.ts`), `AdminAccount`, `ParentAccount`.
* **Existing APIs:**
  - `POST /api/auth/login`
  - `GET /api/auth/me` (requires Bearer token)
  - `POST /api/auth/logout`
  - `POST /api/auth/switch-child`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/change-password`
  - `POST /api/admin/reset-password-direct`
  - `POST /api/admin/send-reset-link`
  - `POST /api/admin/send-login-details`
* **Persistence:** MongoDB Atlas `users` collection.

---

#### 4.14 School Settings & Institutional Configuration
* **Module Identifier:** `settings`
* **Purpose:** Global campus metadata, affiliation numbers, official branding logos, academic year configuration, and admin account management.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`.
* **Core Workflows:**
  1. *Institutional Identity:* School Name, School Code, CBSE Affiliation Number, Board, Address, Official Email, Primary Telephones, Principal Name.
  2. *Official Logo Management:* Direct upload of official school crest/logo to Cloudflare R2 (`school/school-logo/{uuid}.png`) with immediate update across the portal navbar, report cards, ID cards, and receipts.
  3. *Admin Accounts Registry:* Create and manage administrative user accounts with specific roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`).
* **Data Entities:** `SchoolSettings` (`server/models/SchoolSettings.ts`).
* **Existing APIs:**
  - `GET /api/school-settings` / `GET /api/settings`
  - `PUT /api/school-settings` / `PUT /api/settings`
  - `GET /api/admin/accounts`, `POST /api/admin/accounts`, `PUT /api/admin/accounts/:id`, `DELETE /api/admin/accounts/:id`
* **Persistence:** MongoDB Atlas `school_settings` and `users` collections.

---

#### 4.15 Real-time Synchronization & System Audit Logs
* **Module Identifiers:** `realtime`, `audit-logs`
* **Purpose:** Live multi-user synchronization and immutable audit trail of administrative modifications.
* **Workflows:**
  1. *Server-Sent Events (SSE):* Endpoint `/api/realtime/events` streams live events to active browser tabs with an in-memory 250-event buffer (`recentEventsBuffer`) and a 15-second keepalive heartbeat (`: heartbeat\n\n`). Falls back to polling buffer `/api/realtime/poll` if SSE is interrupted by client network conditions.
  2. *Audit Trail:* Every critical action (student admissions, fee payments, grade updates, configuration edits) writes an entry with timestamp, user ID, user role, action type, entity type, and detailed description to the `audit_logs` collection.
* **Existing APIs:**
  - `GET /api/realtime/events` (SSE stream)
  - `GET /api/realtime/poll`
  - `GET /api/audit-logs`
  - `POST /api/audit-logs`
* **Persistence:** MongoDB Atlas `audit_logs` collection.

---

#### 4.16 Class Teacher Assignment & Dynamic Attendance Workflow
* **Module Identifiers:** `teachers`, `attendance`, `academic`
* **Purpose:** End-to-end integration connecting Class Teacher designation in the staff registry directly with real-time class attendance roster population, role authorization, and duplicate-safe MongoDB persistence.
* **Target Users:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `ACADEMIC_COORDINATOR`, `TEACHER`.
* **Core Requirements & Workflows:**
  1. *Dynamic MongoDB Active Class/Section Loading:* Teacher creation and edit forms load active academic classes and sections dynamically via `api.syncClasses()`. Archived or inactive classes (e.g. status `INACTIVE`) are strictly filtered out.
  2. *Dual-Model Class Teacher Persistence:* When a teacher is assigned as Section Incharge/Class Teacher, updates are saved to MongoDB `staff` collection (`classTeacherOf`, `teachingProfile`, `assignedClasses`) and mirrored to `classes` collection (`classTeacherId`, `classTeacherName`, `detailedSections.classTeacherId`).
  3. *Automatic Default Selection in Attendance View:* On opening the Attendance module, assigned class and section automatically default to the teacher's active assignment (`/api/attendance/assigned-classes`). If an admin changes the teacher's assignment, the attendance default updates reactively without manual re-selection.
  4. *Dynamic Student Roster Loading:* Active students enrolled in the selected class and section are fetched dynamically from MongoDB (`/api/students?classId=...&section=...`).
  5. *Existing Attendance Loading & Duplicate Prevention:* When opening attendance for a class, section, and date that has already been marked, existing attendance records load into the register rather than generating blank or duplicate rows.
  6. *Atomic Attendance Upsert & Update:* Saving edits updates existing student records in MongoDB Atlas via batch atomic upsert/update and broadcasts real-time SSE events. Refreshing retains the latest updated statuses and teacher remarks.
  7. *Strict RBAC Authorization:* Teachers attempting to view or submit attendance records for classes and sections not assigned to them are strictly denied with HTTP 403 Forbidden.
* **APIs Used:**
  - `GET /api/classes` & `POST /api/classes/sync`
  - `PUT /api/teachers/:id` & `POST /api/teachers`
  - `GET /api/attendance/assigned-classes`
  - `GET /api/students`
  - `GET /api/attendance` & `POST /api/attendance`
* **Persistence:** MongoDB Atlas collections: `staff`, `classes`, `students`, `attendance`.

---

#### 4.17 Institutional Certificate & TC PDF Rendering System (Bonafide, Character, Transfer Certificate)
* **Module Identifiers:** `documents`, `certificates`, `transfer-certificate`
* **Purpose:** Institutional issuance of CBSE-standardized Character Certificates, Bonafide Certificates, and School Leaving / Transfer Certificates (TC) with pixel-perfect A4 vector PDF export and high-fidelity preview matching.
* **Core Requirements & Workflows:**
  1. *Transfer Certificate (TC) Profile Photo Fidelity:*
     - The student's actual profile photo is dynamically resolved and rendered in the downloaded PDF and on-screen preview.
     - Preserves the authentic passport aspect ratio (4:5); strictly avoids distortion, stretching, or disproportionate scaling.
     - Preloads and awaits image resolution asynchronously before initiating PDF export, eliminating broken images and placeholder fallbacks for registered students.
     - Supports local storage, Cloudflare R2, image proxying for remote CDN URLs, and canvas DOM extraction with cross-origin safeguards.
  2. *Character & Bonafide Continuous Paragraph Justification:*
     - Custom paragraph text renderer (`renderJustifiedParagraph`) that flows body text continuously with natural word-wrapping across the page width.
     - Eliminates unnatural large gaps between words by enforcing standard word spacing on intermediate lines (capped at 2.3x normal space) and strictly left-aligning the last line of every narrative paragraph.
     - No manual line breaks inside sentences.
  3. *Page Space Utilization & Vertical Balance:*
     - Distributes vertical whitespace dynamically across the A4 portrait sheet (210mm x 297mm) to eliminate excessive blank voids in the middle.
     - Structured Institutional Record Verification & Official Seal box with dual-column authenticity details (Admission Register volume, affiliation code, school code, character verification, authorizing authority, and legal validity).
     - Official embossed institutional seal guide circle placeholder between verification box and signature row.
     - Three institutional signature columns: Prepared By (Admin), Checked by Registrar, and Principal / Head of Institution (with signature image).
  4. *Strict 1 A4 Portrait Page Guarantee:*
     - Both browser preview and downloaded vector PDF strictly fit onto exactly one A4 portrait page without overflow.
* **APIs Used:**
  - `GET /api/students/:id`
  - `GET /api/settings`
  - `GET /api/files/content?key=...`
  - `GET /api/files/image-proxy?url=...`
* **Persistence:** MongoDB Atlas collections: `students`, `school_settings`, `file_metadata`.

