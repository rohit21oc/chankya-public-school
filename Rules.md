# AI Development Rules & Operational Directives

## CHANAKYA PUBLIC SCHOOL & COACHING CENTRE
**Strict Instructions for Future AI Coding Sessions**

---

### 1. Fundamental Principles (Non-Negotiable Invariants)

1. **ALWAYS Inspect Before Modifying:**
   - Every modification, enhancement, or bug fix must begin with a thorough inspection of the relevant existing files using `view_file` or `list_dir`. Never write assumptions or code blindly without reading current file implementations.

2. **NEVER Rebuild from Scratch:**
   - The application is an established, production-grade ERP with 20+ functional modules, 35 Mongoose schemas, and dozens of UI components.
   - Do not rebuild, re-architect, or swap foundational frameworks (e.g., do not replace React with Next.js, do not swap Tailwind with CSS modules, do not replace the custom SPA router with another routing framework unless explicitly instructed).

3. **NEVER Remove Working Modules:**
   - Never deprecate, comment out, or delete any existing module, tab, or modal (Students, Teachers, Academics, Timetable, Attendance, Fees, Exams, Documents, Hostel, Transport, Communication, Reports, Audit Logs, Settings, Website CMS, API Docs) without explicit user instructions.

4. **MongoDB Atlas is the SOLE Production Source of Truth:**
   - All dynamic records MUST persist in MongoDB Atlas across all 35 collections (including `staff_leaves` and `staff_payroll`).
   - **Development & Preview Fallback:** When running in local development or preview mode without a configured `MONGODB_URI`, the server gracefully falls back to an in-memory storage mode. In production deployments, MongoDB Atlas is mandatory.
   - **Frontend Cache Boundary:** Frontend `localStorage` (key `'cps_school_erp'`) is **strictly an optimistic, read-only, and offline-draft cache** for instantaneous UI responsiveness and offline resilience. It is **NEVER** the backend production source of truth.
   - **NEVER** write backend mutations to JSON files in `/data` or treat `localStorage` as authoritative. The JSON files in `/data` are one-time migration seeds and static fallbacks, NOT a runtime write target.
   - Any API route performing mutations (POST, PUT, PATCH, DELETE) must write directly to the appropriate Mongoose model in `server/models/`.

5. **Strictly Single-School ERP (NO Multi-Tenancy):**
   - The institutional identity is CHANAKYA PUBLIC SCHOOL & COACHING CENTRE.
   - Do NOT introduce multi-tenant paradigms, `schoolId` routing, tenant isolation middleware, or organization switches. All data belongs exclusively to this single campus.

6. **NEVER Introduce Mock / Fake Production Data:**
   - Do not populate student names, fee receipts, or teacher records with hardcoded dummy constants in UI components.
   - All tables, rosters, fee entries, and profile cards must bind dynamically to data retrieved from `src/services/api.ts` and the backend endpoints.

7. **Do NOT Expose Secrets to the Client:**
   - `MONGODB_URI`, `JWT_SECRET`, `R2_SECRET_KEY`, `R2_ACCESS_KEY`, `BREVO_API_KEY`, and `GEMINI_API_KEY` must remain strictly on the backend inside environment variables.
   - Never inject database connection strings, Brevo API keys, or email credentials into client-side code, `.env` files committed to Git, or `src/` files.

8. **Strict Authentication & Login Invariants:**
   - Exactly THREE login experiences: (1) Staff / Admin common login, (2) Student login, (3) Parent login.
   - Strictly ONE common login page for all 10 staff/admin roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`).
   - NEVER create separate login pages for Teacher, Admin, Principal, Accountant, or any individual staff role.
   - Role MUST be determined securely by the backend after authentication. The frontend must NEVER submit or choose a role.
   - Never store or expose plaintext passwords, reset tokens, or reset URLs in UI or `localStorage`.
   - Passwords must always be hashed with bcrypt (10 rounds).
   - Password reset/change operations must invalidate relevant active sessions.

9. **Management Team Carousel Invariants:**
   - The Management Team module on the public website MUST use the responsive carousel/slider display: 3 cards on desktop, 2 on tablet, 1 on mobile.
   - The carousel auto-advances every 3 seconds, pauses on interaction (hover, drag, dot click), and resumes automatically.
   - Dynamic pagination dots MUST generate exactly N dots for N active members; never hardcode dot counts.
   - Cards must NEVER overflow or wrap into a secondary vertical row.
   - MongoDB remains the single source of truth; members are loaded dynamically via `/api/public/leadership` and sorted by `displayOrder`.
   - Never remove existing team members, profiles, routes (`/management/:id`, `/leadership/:id`), or admin CRUD functionality.

10. **Fee Structure, Student Admission & Fee Billing Invariants:**
    - **Default Admission Fee Selection:** Exactly 6 fee heads must be checked by default on new student intake: Admission Fee, School Fee, Exam Fee, Uniform / Dress Code, Books & Stationery, and ID Card Fee.
    - **Optional Heads:** Tuition, Computer, Sports, Medical, Transport, and Hostel follow policy and student opt-in choices.
    - **Scholarships / Waivers:** Authorized staff can manually uncheck a fee head or adjust amounts without breaking database links. Default selections must be configurable and never overwrite saved admission records.
    - **Dynamic Class-Wise Fee Structure:** Loaded dynamically from MongoDB class-wise fee structures (`fee_configurations`). Amounts and session totals must never be hardcoded or fabricated.
    - **Admission-Time Payable & Action:** At admission, immediately generate a payable invoice containing all selected one-time charges (`ONE_TIME`). Provide a prominent "Pay Admission Fee" action in the admission workflow. Never mark an invoice as paid unless payment is successfully recorded in MongoDB. Support receipt generation (`REC-2026-XXXX`).
    - **Next-Month Billing Cycle Rule:** Monthly fee billing begins strictly from the student's actual Enrollment Date. No monthly fees are charged prior to enrollment. Monthly fees for a student's enrollment month are not billed as a full monthly charge; the first monthly installment becomes due in the subsequent month (e.g., student enrolled 11 September 2026 -> first monthly installment due 10 October 2026, payable 1 October - 10 October).
    - **Monthly Payable Window:** 1st through 10th of each applicable month.
    - **Late Fee / Overdue Penalty:** Starting on the 11th, if the monthly invoice is unpaid or has an outstanding balance, apply a ₹50 late fee per overdue monthly invoice once (`lateFeeApplied: true`).
    - **Late Fee Immunity:** Never charge late fees on fully paid invoices. Partial payments must calculate remaining balance correctly (`total - paidAmount`).
    - **Idempotency:** Repeated page visits, scheduled jobs, retries, or payment attempts must not add duplicate penalties or duplicate payment records.
    - **Timezone:** Standard institutional timezone `Asia/Kolkata` must be used for all billing dates and overdue calculations.

11. **Online Fee Payment (PhonePe) Invariants — see `docs/ONLINE_PAYMENTS.md`:**
    - PhonePe Standard Checkout is the only gateway. A fee becomes PAID only after the SERVER has called PhonePe's Order Status API itself and `checkCompletedOrder()` passed against the stored `payment_orders` record: state COMPLETED, exact amount in paise, a completed transaction. Nothing else may clear a fee: not the PayPage callback (CONCLUDED), a redirect back to the site, a pending payment, or a webhook body (an authenticated webhook only triggers the server's own status check).
    - Which bill, which child and how much always come from the stored order (our `merchantOrderId`). The website/app never send an amount for "pay full"; for one bill an amount may only lower it.
    - The status check, the webhook and reconciliation all book through `settleOrder()` (one child at a time, idempotent on the merchant order id, unique index `fee_payments.merchantOrderId`). Never add a second booking path.
    - Lifecycle: INITIATED → PENDING → SUCCESS / FAILED / CANCELLED / EXPIRED → REFUNDED. SUCCESS can only become REFUNDED. A refund never edits the receipt automatically; the office reverses it with the Refund action.
    - Never book more than what is owed: excess is flagged `reconciliationRequired` and audited, never dropped.
    - Client ID/secret and webhook credentials live only in server env vars (`PHONEPE_*`). The website and the app never see them. Historical receipts of the old gateway stay untouched.

---

### 2. API Contract & Backend Rules

1. **Preserve Existing API Signatures:**
   - Do not rename or remove existing API endpoints (e.g., `/api/students`, `/api/fee-ledgers/:id/collect`, `/api/auth/login`, `/api/timetables`).
   - If extending an endpoint, ensure backward compatibility by making new request parameters optional and maintaining the existing response envelope (`{ success: true, ... }` or JSON arrays).

2. **Dual Route Compatibility:**
   - Maintain established dual-route aliases already present in `server.ts`:
     - Both `/api/timetable` and `/api/timetables`
     - Both `/api/staff` and `/api/teachers`
     - Both `/api/school-settings` and `/api/settings`
     - Both `/api/public/leadership` and `/api/public-website/leadership`

3. **Strict RBAC Enforcement on All Mutation Routes:**
   - Any endpoint altering data must use `requireAuth` and `requireRole(...)`.
   - Never allow unauthenticated or unauthorized role execution on administrative tasks (e.g., fee collection, marks approval, student deletion, user password resets).

4. **Real-time Event Broadcasting (SSE):**
   - Whenever an entity is created, updated, or deleted on the backend, call `broadcastRealtimeEvent(entity, action, data, meta)` so all active client sessions update automatically via Server-Sent Events (SSE).
   - Backend maintains an in-memory 250-event circular buffer (`recentEventsBuffer`) and dispatches a 15-second keepalive heartbeat (`: heartbeat\n\n`) to preserve connection health across proxies and firewalls. Clients fall back to `/api/realtime/poll` if SSE is interrupted.

5. **Safe Server Process Restart:**
   - Server runs via `tsx server.ts` in dev and `node dist/server.cjs` in production. Always test compilation using `compile_applet` before requesting or expecting server reloads.

---

### 3. Database & Mongoose Model Rules

1. **Keep Schema Definitions in `server/models/`:**
   - All Mongoose schema files live in `server/models/` and are re-exported in `server/models/index.ts`.
   - When adding fields to an entity, update the TypeScript interface in `src/types/index.ts` AND the Mongoose schema in `server/models/{Entity}.ts` in lockstep.

2. **Always Use Unique Business Identifiers:**
   - Students must have unique `id` and unique `admissionNumber`.
   - Users must have unique `id` and unique `username`.
   - Timetable slots are indexed by `{ dayOfWeek, periodNumber, classId, section }`.
   - File metadata is keyed on `fileKey`.

3. **Never Drop Existing Collections in Normal Workflows:**
   - Do NOT execute `deleteMany({})` on core operational collections like `students`, `users`, `fee_ledgers`, or `staff` during regular CRUD operations. Use targeted updates (`updateOne`, `findOneAndUpdate`, or selective `bulkWrite`).
   - For collection-replacement workflows (e.g., timetable period reconfiguration), ensure atomic operations.

4. **Maintain Schema Resiliency:**
   - Mongoose schemas must use `lean()` on read operations when modifying or serializing responses to prevent circular references and mongoose overhead.
   - Clean documents by removing MongoDB internal metadata (`_id`, `__v`) before sending to clients.

---

### 4. UI, Component & Styling Rules

1. **Design System Adherence (Institutional Brand):**
   - Palette: Deep Navy (`#0B1F4B`), Royal Blue (`#123B8C`), Gold Accent (`#D9A441`), Soft Off-White Background (`#F7F9FC`).
   - Headings: Use `font-family: 'Outfit', sans-serif` via `font-heading` or `<h1-h6>`.
   - Body & UI: Use `font-family: 'Plus Jakarta Sans', sans-serif`.
   - Styling Framework: Tailwind CSS v4. Do NOT introduce separate `.module.css` or arbitrary custom stylesheet files. Keep styles utility-first in Tailwind.

2. **Reuse Existing Components & Modals:**
   - Before creating a new modal or form, check `src/components/modals/` and `src/components/common/`.
   - Use `FileUploadComponent.tsx` for all photo and document attachment interactions.
   - Use `PrintableReceiptModal.tsx` for fee receipts.
   - Use `PrintableIdCardModal.tsx` for student ID cards.
   - Use `PrintableReportCardModal.tsx` for report cards.

3. **Responsive Viewport Support:**
   - All interfaces must remain fully responsive and clean across mobile (< 640px), tablet (640px - 1024px), and desktop (> 1024px).
   - Sidebar must support mobile drawer overlay (`isMobileOpen`) and desktop collapsible state (`isCollapsed`).

4. **Zero-Pill Discipline & Institutional Elegance:**
   - Avoid garish or neon gradients, over-rounded "pill" shapes, or toy-like SaaS buttons.
   - Maintain crisp rounded corners (`rounded-xl` or `rounded-2xl`), subtle borders (`border-slate-200`), professional slate text tones (`text-slate-800`, `text-slate-500`), and accessible contrast ratios.

---

### 5. File Uploads & Cloudflare R2 Storage Rules

1. **Cloudflare R2 Dual Upload Architecture:**
   - **Direct Presigned Upload (`DIRECT_R2`):** Obtain presigned PUT URL via `POST /api/files/presign-upload` and upload binary data directly from browser to Cloudflare R2 when credentials and bucket CORS are verified.
   - **Server Stream Gateway Fallback (`SERVER_GATEWAY`):** If bucket CORS is unconfigured or blocked by browser preflight, seamlessly route the upload via the server streaming gateway (`PUT /api/files/stream-upload/:fileKey(*)`) to prevent upload disruptions.

2. **Permanent Content Retrieval:**
   - Store and serve file assets using permanent gateway URLs: `/api/files/content?key=${encodeURIComponent(fileKey)}`.
   - Never generate temporary presigned URLs in persistent database records, as they expire after 300 seconds.

3. **Client-Side Image Downsampling:**
   - Utilize `src/services/imageCompressionService.ts` before uploading student or staff profile photos to downsample files > 2MB and convert them to standard JPEG/WebP.

4. **File Metadata Persistence:**
   - Every file uploaded must be finalized with a `POST /api/files/confirm` call to persist metadata (`fileKey`, `folder`, `contentType`, `fileSize`, `associatedEntity`) into the `file_metadata` collection in MongoDB Atlas.

---

### 6. Email Subsystem & Brevo Transactional Email Rules

1. **Brevo REST API Only:**
   - All system emails (Forgot Password, Student Admission / Parent Credentials, Staff Account Welcome, Admin Temporary Password) must be sent via Brevo's official Transactional Email API (REST v3: `POST https://api.brevo.com/v3/smtp/email`).
   - `BREVO_API_KEY` must only be stored in backend environment variables. Never expose it in client code, responses, or Git.

2. **Single-Use Expiring Tokens (Forgot Password):**
   - Reset tokens must remain single-use and expire strictly after 15 minutes.
   - Never send existing or plaintext passwords by email.
   - Do not reveal whether an email or account exists during the password reset request flow.

3. **Student Admission & Staff Credentials:**
   - Student admission confirmation is sent to valid parent email with Admission Number / login ID and password instructions.
   - New staff account emails deliver Employee ID and temporary password with clear instructions to change password upon first login.
   - Never expose or log passwords in server output, databases, or client logs.

4. **Dynamic Canonical Links:**
   - Links generated in transactional emails must resolve strictly to the canonical frontend domain (`/reset-password?token=...`).
   - Never output internal container hosts or backend API domains in user-facing email links.

5. **Sanitized Error Logging & Safe User Messaging:**
   - If Brevo rejects a message or fails, log only safe technical details on the backend. Never log API keys, tokens, or passwords.
   - Return clean, user-friendly error messages (e.g., "Unable to send the email. Please try again later."). Never expose raw upstream Brevo error payloads to users.
   - Do not falsely report an email as sent if Brevo rejected or failed the dispatch.

---

### 7. Router, SPA & Navigation Rules

1. **Browser Refresh (F5) Support:**
   - All portal and public routes must handle browser refresh without returning 404 errors.
   - On Render, the rewrite rule `/* -> /index.html` is enforced in `render.yaml`. Any new public entry point must be accommodated by the router.

2. **Query Parameter & Token Preservation:**
   - Password reset tokens can arrive in URL search params (`?token=...`), hash fragments (`#?token=...`), or path params (`/reset-password/...`). Always sanitize tokens using `cleanTokenString()` to strip accidental email client brackets or trailing punctuation.

3. **Sub-Tab Synchronization:**
   - When navigating nested modules (e.g. Fees module tabs: `STUDENT_LEDGER`, `LEDGER`, `CONFIG`), ensure both the component state and the URL pathname (`/fees/collection`, `/fees/ledger`, `/fees/config`) are updated synchronously via `moduleToPath()` and `pathToModuleInfo()`.

---

### 8. Error Handling & Verification Rules

1. **No Silent Failures:**
   - Catch all asynchronous API errors and surface clean, human-readable notifications in the UI.
   - Never suppress `catch (err)` blocks without logging an appropriate error message or presenting feedback to the user.

2. **Validate Changes Across Both Tiers:**
   - If modifying an API endpoint or request payload in `server.ts`, immediately update the corresponding frontend caller in `src/services/api.ts` or `src/services/authService.ts`.

3. **Verification Command Sequence:**
   - Before finishing any AI session, execute:
     1. `compile_applet` to guarantee that the Vite build and esbuild server bundle succeed without syntax or import errors.
     2. `lint_applet` (`tsc --noEmit`) to verify TypeScript type consistency.
     3. Verify MongoDB data persistence and API endpoints if backend code was modified.

4. **Never Claim Completion Without Verification:**
   - Do not tell the user a task is completed until the build passes with zero errors and the code matches the requirements specified above.

---

### 9. Communication Center & SMS Gateway Rules

1. **Strict Server-Side Idempotency Protection:**
   - Every SMS dispatch MUST include a unique, deterministic `idempotencyKey` (e.g. `absentee-{studentId}-{date}`, `admit-card-{examId}-{studentId}`, `fee-reminder-{studentId}-{month}-{date}`).
   - Backed by an atomic compound unique index in MongoDB Atlas (`idempotencyKey: 1` in `sms_logs`).
   - Re-running triggers, repeated API hits, network retries, or browser refreshes MUST NEVER produce duplicate SMS dispatches or double-bill SMS units.

2. **Audience Filtering & Portal Distribution Enforcement:**
   - Public visitors only see `PUBLISHED` circulars.
   - Students only see `PUBLISHED` circulars targeted to `ALL`, `STUDENTS`, their specific `class`, or their specific `studentId`.
   - Parents only see `PUBLISHED` circulars targeted to `ALL`, `PARENTS`, or their linked children's class/ID.
   - Draft and expired notices are restricted from student/parent portals.

3. **Zero Fake/Mock Communication Data:**
   - Do NOT generate hardcoded fake notices or simulated SMS records in production code.
   - Real-time MongoDB persistence in `notices` and `sms_logs` is mandatory.

4. **Clean UI Discipline:**
   - Avoid long marketing paragraphs, instructional descriptions, or redundant subtitles in the Communication UI.
   - Maintain a compact, professional UI with clean tables, badges, action buttons, and essential counters. Do not remove functional elements.

---

### 11. Class Teacher Assignment & Attendance Workflow Rules

1. **Dynamic MongoDB Loading Only:**
   - Hardcoded class names or section letters in teacher forms and attendance views are strictly prohibited.
   - All classes and sections must be retrieved dynamically from active MongoDB database records via `api.syncClasses()`.
   - Inactive classes (e.g. `status === 'INACTIVE'`) must never be selectable for teacher assignment or shown in active attendance dropdowns.

2. **Persistence Integrity:**
   - When updating or adding a teacher's class assignment, persist both `classTeacherOf` (string, e.g. "Class 1-A") and structured `teachingProfile` (`assignedClassId`, `assignedClassName`, `assignedSection`, `isClassTeacher`) in MongoDB Atlas.
   - Synchronize corresponding class records (`c.classTeacherId`, `c.classTeacherName`, `detailedSections.classTeacherId`) to preserve bilateral consistency across reloads and logins.

3. **Attendance Automatic Defaulting:**
   - For teachers logging in or viewing the Attendance module, their assigned class and section must be pre-selected automatically based on backend `/api/attendance/assigned-classes`.
   - Real-time updates (`TEACHER` and `STAFF` SSE events) must dynamically refresh the attendance view's default selections without page reload.

4. **Zero Duplicate Attendance Records:**
   - Attendance submission for an already marked class, section, and date must perform an atomic upsert/update rather than creating duplicate entries.
   - Loading attendance must pull the existing saved statuses and remarks from MongoDB Atlas so teachers can review and edit previous marks accurately.

5. **Strict RBAC Enforcement:**
   - Teachers are strictly forbidden from viewing or recording attendance for classes/sections they are not assigned to.
   - Unauthorized attempts must be blocked with HTTP 403 Forbidden on both GET and POST `/api/attendance`.

---

### 12. Certificate & Transfer Certificate (TC) PDF Rendering Rules

1. **Continuous Text Flow & Anti-Gapping Rule:**
   - Never use jsPDF's native `{ align: 'justify' }` on multi-line text arrays directly without protecting the last line of paragraphs.
   - Always route certificate narrative paragraphs through `renderJustifiedParagraph`.
   - The last line of every narrative paragraph MUST strictly be left-aligned (natural word spacing). Never stretch short terminal lines across the page width.
   - Inter-word spacing on intermediate lines must be clamped to natural bounds (maximum 2.3x normal space width).
   - Never insert manual hardcoded line breaks inside sentences. Word wrapping must calculate dynamically via `doc.splitTextToSize`.

2. **Student Profile Photo Fidelity & Aspect Ratio:**
   - The student's actual profile photo must always render in the Transfer Certificate (TC) PDF and preview.
   - Never substitute with a placeholder initial box when a student has a registered photo in MongoDB/storage.
   - Strictly preserve the original photo's aspect ratio. Never distort, squish, or stretch student photos to force arbitrary dimensions. Center the photo within the 24mm x 30mm passport frame.
   - Always await async photo resolution before triggering PDF export. Use the dual strategy: DOM canvas extraction for live previews and multi-path backend/R2/local resolution for headless exports.

3. **Page Space Discipline (No Excessive Voids):**
   - Never use hardcoded arbitrary `currentY` jumps (e.g. jumping directly to Y=212) that leave gaping empty holes in the middle of the certificate.
   - Distribute vertical whitespace dynamically between paragraphs, the Institutional Verification Box, and the signatures section.
   - Institutional Record Verification Box must be positioned naturally following the narrative, with a minimum height of 30mm and dual-column verified metadata.

4. **Single-Page Constraint:**
   - All certificates (Character, Bonafide, and TC) must strictly fit on exactly one A4 portrait page (210mm x 297mm).
   - Extraneous page buffers generated by trailing margins must be pruned automatically via `doc.deletePage`.

5. **Dynamic Data Rules:**
   - All student particulars (name, admission number, registration number, roll number, DOB, gender, category, parents' names, class, section, session, address) must come dynamically from MongoDB records via `api.fetchStudentDirect(student.id)`.
   - Never introduce hardcoded mock student names, fake roll numbers, or static dimensions.

### 13. Support Staff & Hostel Warden Rules (Phase 46)
1. **Support staff never log in.** `SUPPORT_STAFF` (cleaning, driver, guard, cook …) is a staff record for ID, ID card, attendance and payroll only. Use `isNoLoginStaffRole()` (`src/constants/staffRoles.ts`) wherever login is granted; never send them credentials.
2. **Warden scope is server-side.** A HOSTEL_WARDEN sees only hostels from their staff record (`hostelAssignment.hostelId`) or hostels listing their mobile as warden phone, and only students with an ACTIVE allocation there. Every `/api/hostel-warden/*` call re-checks this; the app never filters for security.
3. **Night attendance is not school attendance.** It lives in `hostel_attendance` and must never read or write the `attendance` collection. One record per student per night; a second submit is 409 — changes go through the correction endpoint with a reason (history + audit log). Wardens may correct up to 2 days back; older nights need admin tier.
4. **One leave system.** Hostel leave = the existing student leave (`/api/student-leaves`). Wardens forward (`PUT /api/student-leaves/:id/forward`); only `LEAVE_APPROVAL_ROLES` approve.
5. **No mock data** in warden screens; all numbers come from the server.

