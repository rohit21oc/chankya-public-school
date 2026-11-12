# System Architecture Documentation

## CHANAKYA PUBLIC SCHOOL & COACHING CENTRE
**Single-School Institutional ERP & Digital Campus Platform**

---

### 1. High-Level Architectural Overview

The application is structured as a full-stack, decoupled-capable, single-school enterprise system. 
* **Frontend:** A high-performance React 19 Single Page Application (SPA) built with TypeScript and Vite, styled using Tailwind CSS v4.
* **Backend:** An Express.js Node.js server providing RESTful endpoints, Server-Sent Events (SSE) for live synchronization, JWT-based RBAC authentication, and integration gateways.
* **Database (Primary Single Source of Truth):** MongoDB Atlas cloud cluster hosting all institutional data collections.
* **Object Storage:** Cloudflare R2 (S3-compatible API) for persistent binary media, student photographs, faculty documents, and public website assets.
* **Email Subsystem:** Brevo Transactional Email API (REST v3: `https://api.brevo.com/v3/smtp/email`) for secure password resets, student admission confirmations, staff account credentials, and administrative password updates.
* **Production Deployment:** Hosted on Render with separate optimized services:
  - Frontend SPA: Static Web Service (`https://your-school-domain.example`) with `/* -> /index.html` rewrite rules.
  - Backend API: Node.js Web Service (`https://your-backend.example`) running bundled `dist/server.cjs`.

```
                                    +-----------------------------------------+
                                    |               End Users                 |
                                    | (Admins, Teachers, Parents, Students)   |
                                    +--------------------+--------------------+
                                                         |
                                                         v
                                    +-----------------------------------------+
                                    |         React 19 SPA (Render)           |
                                    |  your-backend.example|
                                    +--------------------+--------------------+
                                                         |
                                  HTTPS REST API Calls   |  Live SSE Stream
                                  Authorization: Bearer  |  /api/realtime/events
                                                         v
                                    +-----------------------------------------+
                                    |        Node.js / Express Backend        |
                                    |      your-backend.example  |
                                    +--------+------------------+-------------+
                                             |                  |
                       Mongoose 9 / MongoClient                 | AWS S3 SDK (v3)
                                             |                  | Presigned URLs & Gateway
                                             v                  v
                          +-------------------------+  +-------------------------+
                          |   MongoDB Atlas Cloud   |  |      Cloudflare R2      |
                          | (Single Source of Truth)|  |     (Object Storage)    |
                          |  Database: cps_school_erp| |  Bucket: school-documents|
                          +-------------------------+  +-------------------------+
                                             |
                                             v Brevo Transactional Email API (REST v3)
                                  +--------------------+
                                  |    Brevo Cloud     |
                                  | Password Resets &  |
                                  | Credential Alerts  |
                                  +--------------------+
```

---

### 2. Frontend Architecture

#### 2.1 Technology Stack
* **Framework:** React 19 (`react` ^19.0.1, `react-dom` ^19.0.1)
* **Language:** TypeScript (~5.8.2)
* **Build Tool:** Vite 6 (`vite` ^6.2.3, `@vitejs/plugin-react` ^5.0.4)
* **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` ^4.1.14, `@import "tailwindcss";`)
* **Icons:** Lucide React (`lucide-react` ^0.546.0)
* **Document & PDF Generation:** `jspdf` (^4.2.1), `jspdf-autotable` (^5.0.8), `html2canvas-pro` (^2.4.2), `qrcode` (^1.5.4)
* **Animation & Motion:** `motion` (^12.23.24)

#### 2.2 Application Structure & Component Hierarchy
The entry point `src/main.tsx` mounts `<App />` from `src/App.tsx`. The component layout adapts dynamically according to route classification (`public`, `auth`, or `portal`):

1. **Public Website Route (`/`, `/website`, `/home`):**
   - Renders `src/components/public/PublicLandingPage.tsx`.
   - Sub-sections: `PublicTopBar`, `PublicNavbar`, `PublicHeroCarousel`, `PublicAboutSection`, `PublicAcademicsSection`, `PublicFacilitiesSection`, `PublicManagementTeamSection` (responsive 3-card desktop / 2-card tablet / 1-card mobile carousel with 3s auto-advance, dynamic pagination dots, swipe/drag gestures, and circular infinite wrapping), `PublicNoticeBoard`, `PublicGallerySection`, `PublicContactSection`, `PublicFooter`.
   - Modals: `QuickEnquiryModal`, `MandatoryDisclosureModal`, `AcademicCalendarModal`, `PublicManagementProfileModal`.
   - Public Results Check: `src/components/public/PublicResultCheckPage.tsx` (`/results`).

2. **Authentication Routes (`/login`, `/reset-password`):**
   - `src/components/auth/LoginView.tsx`: Multi-role login screen with direct tab for password recovery request.
   - `src/components/auth/ResetPasswordPage.tsx`: Dedicated password change form triggered by token link (`/reset-password?token=...`).

3. **Protected ERP Portal Workspace (`/dashboard`, `/students`, `/fees`, etc.):**
   - Guarded by `authService.getStoredUser()` and route listener. Unauthenticated users are redirected to `/login?redirect=...`.
   - Top Bar: `src/components/Navbar.tsx` displaying school branding, current academic session, quick navigation, notifications bell, and user avatar dropdown.
   - Navigation Drawer / Sidebar: `src/components/Sidebar.tsx` with responsive collapse state, role-filtered navigation items, and mobile drawer overlay.
   - Dynamic Main Workspace (`<main>`): Renders active view component matching `currentRoute.module`.
   - Floating Modals: `MyProfileModal` for account security and profile editing.

#### 2.3 Custom SPA Router Service (`src/services/routerService.ts`)
Instead of heavy external routing libraries, the ERP uses a purpose-built, high-performance HTML5 History API router:
* **Deep Linking & Refresh Preservation:** Listens to `popstate` and dispatches custom `cps:route_change` events.
* **URL Structure:**
  - `/` or `/website`: Public school landing page.
  - `/login`: Portal authentication.
  - `/reset-password?token=...`: Secure password reset view.
  - `/results`: Public board/term exam result verification.
  - `/dashboard`: Role-based analytical dashboard.
  - `/{module}`: Module views (`/students`, `/teachers`, `/academics`, `/timetable`, `/attendance`, `/hostel`, `/transport`, `/exams`, `/documents`, `/communication`, `/reports`, `/settings`, `/audit-logs`, `/api-docs`, `/profile`).
  - `/{module}/{subTab}`: Sub-navigation mapping (e.g., `/fees/collection` -> module `fees`, subTab `STUDENT_LEDGER`; `/fees/ledger` -> subTab `LEDGER`; `/fees/config` -> subTab `CONFIG`).
* **Route Normalization:** Automatically strips malformed characters and trailing slashes.

#### 2.4 Data Layer, State & Real-Time Sync
1. **Central Service Cache & LocalStorage Boundary (`src/services/api.ts`):**
   - Maintains an in-memory reactive cache of all ERP collections.
   - Frontend `localStorage` (key `'cps_school_erp'`) is utilized **exclusively as an optimistic, read-only, and offline-draft cache** to ensure instant initial UI hydration and prevent data loss during network hiccups. It is **never** the backend production source of truth.
   - On application mount, `api.syncWithServer()` issues parallel `fetch` calls to `/api/*` endpoints to hydrate cache directly from the authoritative MongoDB Atlas database.
   - Emits custom window events (`cps_entity_*`, `academic-session-changed`) to trigger instantaneous UI re-renders.
2. **Real-time Push Stream (`src/services/realtimeService.ts`):**
   - Establishes a native `EventSource` connection to `/api/realtime/events`.
   - Server maintains an in-memory 250-event circular buffer (`recentEventsBuffer`) and dispatches a keepalive heartbeat every 15 seconds (`: heartbeat\n\n`) to prevent proxy/load-balancer connection drops.
   - Listens for server broadcasts (`STUDENT_CREATED`, `ATTENDANCE_MARKED`, `FEE_PAYMENT_RECORDED`, `NOTICE_PUBLISHED`, etc.).
   - Updates local cache in real time without requiring manual page reloads.
   - Graceful Degradation: If SSE is closed by an aggressive firewall, falls back to lightweight polling (`/api/realtime/poll?since=...`).
3. **API Configuration & Remote Backend Auto-Detection (`src/services/apiConfig.ts`):**
   - Detects whether the app is running on Render production frontend (`your-backend.example`), static preview hosting, or local full-stack server.
   - Routes requests to `https://your-backend.example` when running on the production frontend domain.
   - Injects `Authorization: Bearer <token>` automatically on all protected requests via `getAuthHeaders()`.
   - Validates client JWT token expiration client-side via `isJwtTokenExpired()`.

---

### 3. Backend Architecture

#### 3.1 Server Entry Point (`server.ts`)
* **Runtime:** Node.js with Express 4 (`express` ^4.21.2).
* **Development Mode:** `tsx server.ts` starts Express on port 3000 and mounts `vite.middlewares` for instant Vite development.
* **Production Build:** `npm run build` runs:
  1. `vite build` -> generates static assets in `./dist`.
  2. `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` -> compiles single backend executable.
* **Production Execution:** `npm start` executes `node dist/server.cjs`. Express serves the compiled static files from `./dist` and catches all unmatched GET routes (`/*`) to send `./dist/index.html`.

#### 3.2 Security, Middleware & Networking
* **IPv4 Resolution Order:** Explicitly enforces `dns.setDefaultResultOrder('ipv4first')` to prevent IPv6 route deadlocks on cloud hosting environments.
* **CORS & Body Parsing:** Express handles JSON and URL-encoded bodies up to 50MB. Preflight OPTIONS requests are handled with proper headers.
* **Authentication Middleware & Core Identity Architecture:**
  - **Three Consolidated Login Experiences:** Exactly three dedicated entry points: (1) Staff / Admin common portal, (2) Student portal, (3) Parent portal.
  - **Single Common Staff/Admin Login:** Unified login for all 10 administrative and staff roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`). No individual role-specific login views exist. Role is determined strictly by backend authentication; the frontend never submits or chooses a role.
  - **Password & Token Cryptography:** Passwords hashed with bcrypt (10 rounds). Single-use password reset tokens (32 random bytes) hashed with SHA-256 with 15-minute expiration. No tokens or plaintext credentials exposed to client. Sessions revoked upon password update.
  - `requireAuth`: Verifies `Authorization: Bearer <jwt>` against `JWT_SECRET`. Resolves session user.
  - `requireRole(allowedRoles: UserRole[])`: Rejects unauthorized roles with HTTP 403 Forbidden. Strict RBAC ensures non-super-admins cannot reset Principal or Administrator credentials.
* **Audit Logging:** Administrative operations automatically log audit records to MongoDB via `AuditLogModel`.

---

### 4. Database Architecture (MongoDB Atlas)

#### 4.1 Persistence Philosophy
**MongoDB Atlas is the sole, authoritative production source of truth for the entire application across all 33 institutional collections.**
* Static JSON files in `/data/*.json` are one-time historical migration seeds. They are **never** written to by server operations.
* Every create, update, and delete operation executed through `/api/*` persists directly to MongoDB Atlas via Mongoose models or native MongoDB collections.
* **Development & Preview Fallback:** If `MONGODB_URI` is not configured or unavailable during local development or isolated preview environments, the server gracefully activates its non-crashing in-memory fallback mode (`IN_MEMORY_FALLBACK`), pre-seeded from initial system defaults. On production Render deployments, `MONGODB_URI` is strictly required.

#### 4.2 Database Connection & Resiliency (`server/db/mongo.ts`)
* **Environment Variable:** `MONGODB_URI` (must be a valid MongoDB Atlas connection string, e.g. `mongodb+srv://...`).
* **URI Sanitization (`sanitizeMongoUri`):** Automatically decodes, trims, and cleans accidentally URL-encoded or quoted credentials.
* **Connection Pooling:** MongoClient with `serverSelectionTimeoutMS: 5000` and `connectTimeoutMS: 5000`.
* **Database Name:** Defaults to `cps_school_erp`.
* **Index Configuration:**
  - `students`: `{ id: 1 }` (unique), `{ admissionNumber: 1 }` (unique), `{ classId: 1, section: 1, rollNumber: 1 }`.
  - `users`: `{ username: 1 }` (unique), `{ email: 1 }`, `{ role: 1 }`, `{ email: 1, userType: 1 }`.
  - `file_metadata`: `{ fileKey: 1 }` (unique), `{ folder: 1 }`, `{ 'associatedEntity.id': 1 }`.
  - `study_materials`: `{ id: 1 }` (unique), `{ fileKey: 1 }`.
  - `file_binaries`: `{ fileKey: 1 }` (unique).

#### 4.3 Mongoose Models Registry (`server/models/`)
The repository maintains strict Mongoose models in `server/models/index.ts`:

| Model Name | Source File | Collection Name | Purpose |
| :--- | :--- | :--- | :--- |
| `SchoolSettingsModel` | `SchoolSettings.ts` | `school_settings` | Institutional identity, CBSE code, address, active session |
| `UserModel` | `User.ts` | `users` | Multi-role user accounts, bcrypt hashes, lockout, reset tokens |
| `StudentModel` | `Student.ts` | `students` | Student demographic, admission, parent, and academic data |
| `StaffModel` | `Staff.ts` | `staff` | Faculty directory, designation, salary, department |
| `ClassModel` | `Class.ts` | `classes` | Class levels (Nursery to 12) and sections |
| `SubjectModel` | `Subject.ts` | `subjects` | Subjects, codes, theory/practical breakdown |
| `TimetableSlotModel` | `Timetable.ts` | `timetable` | Weekly classroom period slots |
| `TimetablePeriodModel`| `Timetable.ts` | `timetable_periods` | Period timing definitions |
| `AttendanceModel` | `Attendance.ts` | `attendance` | Daily student attendance logs |
| `StaffAttendanceModel`| `Attendance.ts` | `staff_attendance` | Daily faculty attendance logs |
| `StaffLeaveModel` | `StaffLeave.ts` | `staff_leaves` | Staff leave applications and approval workflows |
| `StaffPayrollModel` | `StaffPayroll.ts` | `staff_payroll` | Staff monthly salary disbursements and slips |
| `FeeStructureModel` | `Fee.ts` | `fee_structures` | Class-wise fee templates |
| `ClassFeeConfigModel` | `Fee.ts` | `fee_configurations` | Fee component definitions per grade |
| `FeePaymentModel` | `Fee.ts` | `fee_payments` | Fee transaction receipts |
| `FeeLedgerModel` | `Fee.ts` | `fee_ledgers` | Student monthly dues and ledger accounts |
| `PaymentOrderModel` | `OnlinePayment.ts` | `payment_orders` | Online-payment orders (PhonePe `merchantOrderId`) created by the server and their lifecycle (INITIATED → PENDING → SUCCESS/FAILED/CANCELLED/EXPIRED → REFUNDED); unique `orderId` and settled `paymentId`. Older gateway documents are kept as they are |
| `PaymentWebhookEventModel` | `OnlinePayment.ts` | `payment_webhook_events` | Processed PhonePe webhook deliveries (unique id = SHA-256 of the body), so repeats are applied once |
| `TransportSlabModel` | `Transport.ts` | `transport_slabs` | Distance-based transport fee rates |
| `TransportVehicleModel`| `Transport.ts`| `vehicles` | School bus/van registry |
| `TransportRouteModel` | `Transport.ts` | `routes` | Transit routes and pickup stops |
| `HostelModel` | `Hostel.ts` | `hostels` | Hostel buildings |
| `HostelRoomModel` | `Hostel.ts` | `hostel_rooms` | Hostel rooms and bed inventory |
| `ExamModel` | `Exam.ts` | `exams` | Assessment schedules and terms |
| `ExamMarkModel` | `Exam.ts` | `exam_marks` | Student marks records |
| `HomeworkModel` | `Homework.ts` | `homework` | Class/section/subject assignments (title, instructions, assigned/due date, optional attachment); scoped server-side by teacher assignment and student class |
| `NoticeModel` | `Notice.ts` | `notices` | Institutional circulars |
| `SmsLogModel` | `SmsLog.ts` | `sms_logs` | SMS dispatch audit logs & idempotency telemetry |
| `StudyMaterialModel` | `StudyMaterial.ts` | `study_materials` | Downloadable syllabus & notes |
| `FacilityModel` | `PublicWebsite.ts` | `facilities` | Public campus facilities |
| `GalleryItemModel` | `PublicWebsite.ts` | `gallery` | Photo and event gallery |
| `HeroSlideModel` | `PublicWebsite.ts` | `hero_slides` | Public landing page banners |
| `LeadershipProfileModel`| `PublicWebsite.ts`| `leadership` | Management and leadership team profiles |
| `WebsiteEventModel` | `PublicWebsite.ts` | `website_events` | Public school calendar events |
| `AdmissionEnquiryModel`| `PublicWebsite.ts` | `admission_enquiries` | Inbound parent admission queries |
| `WebsiteContentModel`| `PublicWebsite.ts` | `website_content` | Landing page editorial content |
| `AuditLogModel` | `AuditLog.ts` | `audit_logs` | Security and change audit logs |
| `FileMetadataModel` | `FileMetadata.ts` | `file_metadata` | Cloudflare R2 file tracking and metadata |

#### 4.4 Persistent Storage Manager (`server/storage/persistentStorage.ts`)
Acts as a unified service coordinating MongoDB read/writes with Mongoose bulk operations (`bulkWrite`), pre-loading file metadata into an in-memory lookup cache, and executing clean data transforms.

---

### 5. Cloudflare R2 Object Storage Architecture

#### 5.1 Storage Implementation (`server/storage/R2StorageService.ts`)
* **Protocol:** S3-compatible API using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
* **Configuration:**
  - `R2_ENDPOINT`: Cloudflare S3 endpoint URL (`https://<account_id>.r2.cloudflarestorage.com`).
  - `R2_ACCESS_KEY`: S3 API Access Key ID.
  - `R2_SECRET_KEY`: S3 API Secret Access Key.
  - `R2_BUCKET`: Bucket name (`school-documents`).
  - `R2_REGION`: S3 region (`auto`).

#### 5.2 Key Generation & Security
* **Hierarchical Key Paths:**
  - School Logo: `school/school-logo/{uuid}.{ext}`
  - Student/Staff Photos: `school/{folder}/{year}/{month}/{uuid}.{ext}`
  - Documents & Study Materials: `school/{folder}/{year}/{uuid}.{ext}`
* **Validation & Constraints:**
  - Profile Photos & Logos: Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`. Maximum size: 5 MB.
  - Documents: Allowed MIME types: `application/pdf`, `image/*`, DOCX, XLSX. Maximum size: 25 MB.
  - Path traversal protection: Rejects paths containing `..`, `//`, or leading slashes.

#### 5.3 Cloudflare R2 Dual Upload Architecture & Serving Flows
1. **Dual Upload Paths (Direct Presigned vs. Server Stream Gateway):**
   - **Path A: Direct Presigned R2 Upload (`DIRECT_R2`):**
     - Client calls `POST /api/files/presign-upload` with file metadata (`fileName`, `contentType`, `fileSize`, `folder`).
     - If R2 S3 credentials and bucket CORS are verified via preflight check, the backend returns an AWS S3 presigned PUT URL (`uploadMode: 'DIRECT_R2'`, `expiresIn: 300`).
     - Browser directly streams the binary payload via HTTP PUT to Cloudflare R2 with standard `XMLHttpRequest` or `fetch` upload progress reporting.
   - **Path B: Server Stream Gateway Fallback (`SERVER_GATEWAY`):**
     - If bucket CORS is not configured, preflight fails, or in local development simulation, the backend automatically issues a streaming gateway route (`uploadUrl: '/api/files/stream-upload/:fileKey'`, `uploadMode: 'SERVER_GATEWAY'`).
     - Browser PUTs to this endpoint; the server pipes the raw incoming request stream directly to Cloudflare R2 using backend credentials, guaranteeing zero CORS blocking and zero client upload failures.
2. **Permanent Content Gateway (`GET /api/files/content?key=...`):**
   - Public and protected images/documents are served through a permanent backend gateway.
   - High-performance caching: Uses an in-memory fast cache (`Map<string, Buffer>`) for instant repeated downloads.
   - MongoDB Binary Backup: As a catastrophic failover mechanism, files can also be stored in the `file_binaries` collection in MongoDB.
4. **Metadata Recording:**
   - Upon upload completion, client calls `POST /api/files/confirm`.
   - Saves record to MongoDB `file_metadata` collection with original file name, size, MIME type, folder, and associated entity ID.

---

### 6. Email Subsystem Architecture (`server/services/emailService.ts`)

* **Provider:** Brevo Transactional Email API (REST v3: `POST https://api.brevo.com/v3/smtp/email`).
* **Protocol & Connection Standards:**
  - Standard RESTful HTTPS API over port 443 with 15-second timeout and `AbortController`.
  - Immune to cloud provider SMTP port blocks (such as port 465/25 blocking on Render or similar environments).
  - Diagnostic connectivity check backed by `GET https://api.brevo.com/v3/account`.
* **Configuration:**
  - `BREVO_API_KEY`: API key stored strictly in backend environment variables. Never exposed to frontend, GitHub, or public code.
  - `BREVO_SENDER_EMAIL`: Registered/verified sender email address.
  - `BREVO_SENDER_NAME`: Institutional sender name (default: `CHANAKYA PUBLIC SCHOOL & COACHING CENTRE`).
* **Supported Transactional Use Cases:**
  1. *Forgot Password:* Single-use cryptographic reset link expiring in 15 minutes. Plaintext passwords never sent.
  2. *Student Admission / Parent Credentials:* Automatic confirmation upon student enrollment with Admission Number / login ID and password instructions.
  3. *Staff Account Creation:* Automated welcome email dispatching Employee ID and temporary password with mandatory change-on-first-login notice.
  4. *Admin Password Reset:* Issued temporary password sent via Brevo only when explicitly requested; bcrypt hash updated in MongoDB immediately.
* **Branding & Templates:**
  - All emails rendered with institutional branding: **CHANAKYA PUBLIC SCHOOL & COACHING CENTRE**, address (`Kushahar Ward 07, Kushahar, Sheohar, Bihar - 843329`), secure action buttons, and official confidentiality footer.
* **Logging Sanitization:** All error messages and logs strip Brevo API keys, passwords, tokens, and authorization hashes before writing to stdout.
* **Dynamic Production Link Resolution:**
  - Password reset links are dynamically anchored to the canonical production frontend domain:
    `/reset-password?token={cleanToken}`
  - Never falls back to `localhost`, internal ports, or backend API domains in production.

#### 6.2 My Profile & Account Portal Dynamic Architecture
* **Endpoint Contract:**
  - `GET /api/auth/profile`: Authoritatively queries MongoDB (`StaffModel` and `UserModel`) based on the authenticated user's ID, employeeId, email, and phone. Returns the full dynamic profile document without static or mock data fallbacks. If a field has no database value, it resolves as empty string/undefined, rendered as "Not provided" in the UI.
  - `PUT /api/auth/profile`: Role-governed profile updates.
    - `SUPER_ADMIN` and `SCHOOL_ADMIN`: Can edit all permitted institutional and biographical fields.
    - Other staff roles (`TEACHER`, `PRINCIPAL`, `ACCOUNTANT`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`, `ACADEMIC_COORDINATOR`, `VICE_PRINCIPAL`): Can edit ONLY permitted personal and contact fields (`phone`, `alternatePhone`, `address`, `city`, `state`, `pincode`, `emergencyContact`, `bloodGroup`, `qualification`, `photo`, `documents`).
    - Administrative fields (`role`, `employeeId`, `designation`, `department`, `salary`, `accountStatus`, `loginEnabled`) are strictly protected and immutable to non-admin roles.
  - `POST /api/auth/change-password`: Validates current password, updates the authoritative bcrypt hash in `UserModel` and `StaffModel` in MongoDB, immediately invalidates the old password, and allows login with the new password.
* **Component View (`src/components/views/MyProfilePageView.tsx`):**
  - Renders the complete profile matching the Faculty Profile layout (`StaffFullProfileView.tsx`).
  - Five core tabs: Overview, Personal Info, Professional Info, Payroll & Compensation, Documents & Credentials.
  - Full document viewing integrated with secure Cloudflare R2 preview (`DocumentPreviewModal`).
  - Responsive header with identity badge, profile photo, contact chips, and dedicated "Change Account Password" modal.

#### 6.3 SMS Gateway & Idempotency Subsystem Architecture (`server/services/smsService.ts`)
* **Core Gateway Integration:**
  - Pluggable provider adapter supporting external gateways (Fast2SMS) and verified internal institutional gateway (`CPS_SMS_GATEWAY`) with sender ID `CPSKSH`.
  - Phone Normalization: Cleans incoming mobile numbers to standard 10-digit Indian numbers (`[6-9]\d{9}`), stripping international `+91`, prefixes, and spaces.
  - GSM Credit Calculation: 1 credit unit per 160 GSM characters (`Math.ceil(charCount / 160)`).
* **Strict Server-Side Idempotency Architecture:**
  - Idempotency key generated per dispatch event: `<triggerType>-<studentId>-<date/uniqueHash>`.
  - Compound unique index on `{ idempotencyKey: 1 }` in MongoDB Atlas `sms_logs` collection.
  - Pre-flight check queries existing log with status `SENT` or `DELIVERED`. If found, the message is immediately flagged as a duplicate and skipped, returning the existing dispatch metadata without re-calling the SMS provider.
  - Concurrent race condition safety: MongoDB `E11000 duplicate key error` is gracefully trapped and handled without crashing the server.
* **Persistent Audit History (`sms_logs`):**
  - Full audit tracking with `id`, `sentAt`, `date`, `triggerType`, `recipientPhone`, `recipientName`, `studentId`, `admissionNumber`, `className`, `section`, `message`, `characterCount`, `smsUnits`, `provider`, `providerMessageId`, `status` (`SENT`, `FAILED`), `errorReason`, `idempotencyKey`, and `sentBy`.
  - Indexed for sub-millisecond historical queries, dashboard telemetry, and date/status filtering.

---

### 7. End-to-End Data Flows

#### 7.1 Frontend -> Backend -> MongoDB (Standard Entity Mutation)

```
[User Action in React UI]
           |
           v
[src/services/api.ts Call]
   e.g. api.collectFeePayment(paymentData)
           |
           v
[HTTP Request via fetch]
   POST https://your-backend.example/api/fee-ledgers/:id/collect
   Headers: { "Content-Type": "application/json", "Authorization": "Bearer <jwt>" }
           |
           v
[Express Route Handler (server.ts)]
   1. Validates JWT via requireAuth
   2. Validates user role via requireRole(['SUPER_ADMIN', 'ACCOUNTANT', ...])
   3. Validates request body fields (amount, paymentMode, transactionId)
           |
           v
[Database Persistence]
   1. FeeLedgerModel.updateOne({ id }, { $set: { status: 'PAID', paidAmount, ... } })
   2. FeePaymentModel.create({ invoiceNumber, amount, date, studentId, ... })
   3. AuditLogModel.create({ action: 'FEE_COLLECTION', performedBy, ... })
           |
           v
[Live Real-time Broadcast]
   broadcastRealtimeEvent('FEE_PAYMENT', 'CREATED', paymentDoc)
   -> Dispatched to all active SSE client streams (/api/realtime/events)
           |
           v
[HTTP Response]
   Returns HTTP 200 OK with { success: true, payment: paymentDoc }
           |
           v
[Client UI Reaction]
   1. Updates local api.ts cache
   2. Displays PrintableReceiptModal with receipt details
   3. All other open tabs update their balances via SSE
```

#### 7.2 Frontend -> Backend -> Cloudflare R2 (Document / Photo Upload)

```
[User selects file in FileUploadComponent.tsx]
           |
           v
[Step 1: Request Presigned URL]
   POST /api/files/presign-upload
   Body: { fileName: "photo.jpg", contentType: "image/jpeg", fileSize: 184200, folder: "students/photos" }
           |
           v
[R2StorageService.ts]
   1. Validates MIME type and size (<= 5MB for photos)
   2. Generates sanitized key: school/students/photos/2026/09/{uuid}.jpg
   3. Checks CORS or selects direct/gateway mode
   4. Returns { uploadUrl, fileKey, uploadMode }
           |
           v
[Step 2: Direct Binary Upload]
   If DIRECT_R2:
      HTTP PUT to uploadUrl (Cloudflare R2 pre-signed S3 endpoint)
   If SERVER_GATEWAY:
      HTTP PUT to /api/files/stream-upload/{fileKey} (Backend streams to R2)
           |
           v
[Step 3: Confirm & Record Metadata]
   POST /api/files/confirm
   Body: { fileKey, fileName, fileSize, contentType, folder, associatedEntity: { type: 'STUDENT', id: 'st-101' } }
           |
           v
[Backend Updates]
   1. Writes to FileMetadataModel in MongoDB
   2. Updates StudentModel: { photoFileKey: fileKey, photo: `/api/files/content?key=${fileKey}` }
           |
           v
[Step 4: Image Served via Permanent Gateway]
   <img src="/api/files/content?key=school/students/photos/2026/09/{uuid}.jpg" />
   Served with ETag, Cache-Control, and in-memory buffer acceleration
```

#### 7.3 Communication Center & SMS Broadcast Gateway Architecture

```
[Trigger Source]
(Attendance Absentees / Overdue Fees / Exam Schedules / Admit Cards / Result Declarations / Custom SMS)
                                |
                                v
                [Quick Trigger / Custom Dispatch]
                  POST /api/sms/quick-triggers/dispatch
                  POST /api/sms/send
                                |
                                v
                [server.ts & smsService.ts Validation]
     1. Validates JWT & User Role (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, ...)
     2. Validates 10-digit Indian Mobile Numbers (/^[6-9]\d{9}$/)
     3. Computes Deterministic Idempotency Key (e.g. absentee-{id}-{date})
                                |
                                v
                [MongoDB Atlas Atomic Idempotency Check]
        SmsLogModel.findOne({ idempotencyKey })
        -> If found (already SENT): Gracefully skip recipient (duplicate prevention)
        -> If not found: Proceed to Gateway Dispatch
                                |
                                v
                [SMS Gateway Adapter (Fast2SMS / Gateway)]
        Dispatches HTTP POST to SMS Provider with institutional Sender ID (CPSKSH)
        Parses gateway response & message ID
                                |
                                v
                [MongoDB Atlas Persistence]
        SmsLogModel.create({
          idempotencyKey, recipientPhone, recipientName,
          message, status: 'SENT' | 'FAILED', triggerType, providerMessageId
        })
                                |
                                v
                [Live SSE Broadcast]
        broadcastRealtimeEvent('SMS_LOG', 'CREATE', smsLogDoc)
```

#### 7.4 Automated Fee Generation, Overdue Late Fee Engine & Admission Payment Architecture

```
[Student Admission Intake]
         |
         v
[Step 4: Fee Structure Configuration]
  - 6 Default Checked Heads: Admission Fee, School Fee, Exam Fee, Uniform / Dress Code, Books & Stationery, ID Card Fee
  - Optional Heads: Tuition, Computer, Sports, Medical, Transport, Hostel
  - Class Fee Structure dynamically loaded from MongoDB `fee_configurations`
         |
         v
[Admission Submit: POST /api/students]
  1. Persists Student record with configured `feeProfile`
  2. Generates deterministic Admission Invoice for all selected ONE-TIME charges
  3. "Pay Admission Fee" action presented immediately in admission workflow
  4. Payment processed via POST /api/fee-ledgers/:id/collect -> updates ledger & creates FeePayment record in MongoDB
         |
         v
[Automated Monthly Fee & Late Fee Engine: runAutomatedMonthlyFeeGeneration]
  - Timezone: Asia/Kolkata
  - Next-Month Billing Cycle Rule:
      * Enrollment Month is NOT charged as a full monthly fee
      * First monthly installment begins in the subsequent month (e.g., enrolled 11 Sep -> first monthly installment Oct 2026)
  - Due Window:
      * Monthly bill payable from 1st through 10th of each applicable month (Due Date: YYYY-MM-10)
  - Late Fee Rule:
      * Starting on 11th: if unpaid or pending balance > 0, adds configurable ₹50 late fee once (lateFeeApplied: true)
      * Fully paid invoices never receive late fee; partial payments correctly calculate remaining balance
      * Idempotent: repeated runs or page reloads never duplicate penalties
```

---

### 8. Environment Variables Reference

Defined in `/.env.example` and configured in production:

| Variable Name | Environment | Purpose | Security Classification |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Backend | MongoDB Atlas connection string (includes cluster, user, password) | **CRITICAL SECRET** (Never expose to client) |
| `JWT_SECRET` | Backend | Cryptographic secret for signing and verifying auth tokens | **CRITICAL SECRET** (Never expose to client) |
| `R2_ENDPOINT` | Backend | Cloudflare S3 endpoint URL | Backend Secret |
| `R2_ACCESS_KEY`| Backend | Cloudflare R2 S3 Access Key | Backend Secret |
| `R2_SECRET_KEY`| Backend | Cloudflare R2 S3 Secret Key | **CRITICAL SECRET** |
| `R2_BUCKET` | Backend | S3 Bucket name (`school-documents`) | Backend Config |
| `R2_REGION` | Backend | Cloudflare S3 region (`auto`) | Backend Config |
| `BREVO_API_KEY` | Backend | Brevo Transactional Email REST API Key | **CRITICAL SECRET** (Never expose to client) |
| `BREVO_SENDER_EMAIL` | Backend | Verified sender email for Brevo | Backend Config |
| `BREVO_SENDER_NAME` | Backend | Institutional sender name (`CHANAKYA PUBLIC SCHOOL & COACHING CENTRE`) | Backend Config |
| `EMAIL_FROM` | Backend | Fallback display sender header | Backend Config |
| `SMS_PROVIDER` | Backend | Active SMS provider gateway (`fast2sms` or `mock`) | Backend Config |
| `FAST2SMS_API_KEY` | Backend | Fast2SMS / Gateway API Key | Backend Secret |
| `SMS_SENDER_ID` | Backend | DLT registered sender ID (default `CPSKSH`) | Backend Config |
| `FRONTEND_URL` | Backend | Canonical frontend URL (`https://your-school-domain.example`)| Backend Config |
| `APP_URL` | Backend | General application domain reference | Backend Config |
| `VITE_API_URL` | Frontend | Remote backend API URL for static frontend builds | Public Config |
| `GEMINI_API_KEY` | Backend | Server-side Gemini AI key (reserved for server capabilities) | Backend Secret |

---

### 9. Render Deployment Architecture

The production environment on Render is configured via `/render.yaml`:

#### 9.1 Frontend Service (Static Site)
* **Service Name:** `chanakyapublicschool`
* **Live Domain:** `https://your-school-domain.example`
* **Type:** Static Site (`runtime: static`)
* **Build Command:** `npm run build`
* **Publish Directory:** `./dist`
* **SPA Rewrite Rule:**
  ```yaml
  routes:
    - type: rewrite
      source: /*
      destination: /index.html
  ```
  *Crucial:* Guarantees that refreshing the page on deep routes (`/students`, `/fees/collection`, `/reset-password?token=...`) serves `index.html` instead of returning a Render 404 error.

#### 9.2 Backend Service (Node.js Web Service)
* **Service Name:** `chanakyapublicschool`
* **Live Domain:** `https://your-backend.example`
* **Type:** Web Service (`runtime: node`, `plan: free`)
* **Build Command:** `npm run build`
* **Start Command:** `npm start` (executes `node dist/server.cjs`)
* **Environment Variables:** `NODE_ENV=production`, along with MongoDB, R2, JWT, and Gmail SMTP secrets.

---

### 10. Actual Repository File Structure

```
/
├── .env.example                               # Production environment variable blueprint
├── .gitignore                                 # Git exclusions (node_modules, dist, .env)
├── Architecture.md                            # SYSTEM ARCHITECTURE DOCUMENTATION (this file)
├── Design.md                                  # DESIGN SYSTEM & BRANDING MANUAL
├── index.html                                 # HTML5 entry with Outfit & Plus Jakarta Sans fonts
├── Memory.md                                  # LIVING PROJECT MEMORY & AUDIT LOG
├── metadata.json                              # Applet identity and major capabilities
├── package.json                               # npm dependencies and build scripts
├── Phases.md                                  # PHASED DEVELOPMENT ROADMAP
├── PRD.md                                     # PRODUCT REQUIREMENTS DOCUMENT
├── render.yaml                                # Render multi-service deployment configuration
├── tsconfig.json                              # TypeScript strict configuration
├── vite.config.ts                             # Vite configuration with Tailwind CSS v4
├── data/                                      # Historical JSON seeds (migrated to MongoDB)
│   ├── adminAccounts.json
│   ├── admissionEnquiries.json
│   ├── attendance.json
│   ├── classes.json
│   ├── feeConfigurations.json
│   ├── feeLedgers.json
│   ├── feePayments.json
│   ├── feeStructures.json
│   ├── notices.json
│   ├── schoolSettings.json
│   ├── staff.json
│   ├── students.json
│   ├── subjects.json
│   └── websiteContent.json
├── scripts/                                   # Verification & Migration Scripts
│   ├── e2e-verification.ts                    # End-to-end multi-role HTTP & SSE tester
│   ├── migrate-json-to-mongodb.ts             # Migration script from JSON to MongoDB Atlas
│   └── verify-mongodb-crud.ts                 # Real MongoDB CRUD verification test
├── server.ts                                  # Primary Express application & REST API server
├── server/
│   ├── db/
│   │   └── mongo.ts                           # Native MongoDB driver service & URI sanitizer
│   ├── models/                                # 33 Mongoose database models
│   │   ├── Attendance.ts
│   │   ├── AuditLog.ts
│   │   ├── Class.ts
│   │   ├── Exam.ts
│   │   ├── Fee.ts
│   │   ├── FileMetadata.ts
│   │   ├── Homework.ts
│   │   ├── Hostel.ts
│   │   ├── index.ts                           # Barrel export of all Mongoose models
│   │   ├── Notice.ts
│   │   ├── PublicWebsite.ts
│   │   ├── SchoolSettings.ts
│   │   ├── Staff.ts
│   │   ├── Student.ts
│   │   ├── StudyMaterial.ts
│   │   ├── Subject.ts
│   │   ├── Timetable.ts
│   │   ├── Transport.ts
│   │   └── User.ts
│   ├── services/
│   │   └── emailService.ts                    # Brevo Transactional Email REST API service
│   └── storage/
│       ├── persistentStorage.ts               # Centralized Mongoose storage manager
│       ├── R2StorageService.ts                # Cloudflare R2 S3 SDK client & streaming
│       └── StorageService.ts                  # Storage interfaces and contracts
└── src/
    ├── App.tsx                                # Root application router and layout shell
    ├── index.css                              # Tailwind v4 import, color tokens & print CSS
    ├── main.tsx                               # React DOM bootstrapping
    ├── components/
    │   ├── Navbar.tsx                         # Header with identity, session, and profile
    │   ├── Sidebar.tsx                        # Role-based collapsible navigation drawer
    │   ├── academics/                         # Academic sessions, sections, and grading
    │   ├── auth/                              # LoginView and ResetPasswordPage
    │   ├── common/                            # Reusable file upload, status modals, ID cards
    │   ├── fees/                              # Ledgers, category tabs, transport slabs
    │   ├── modals/                            # Admission, payments, bills, certificates, receipts
    │   │   └── admission/                     # Multi-step admission wizard
    │   ├── public/                            # Public website sections, carousels, result checker
    │   ├── teachers/                          # Faculty directory, onboarding, staff profiles
    │   └── views/                             # Primary module view containers (Students, Fees, etc.)
    │       └── public-website/                # CMS tabs for hero slider, leadership, gallery, etc.
    ├── constants/                             # Admission constants and school logo
    ├── hooks/
    │   └── useRealtime.ts                     # React hook for real-time SSE subscriptions
    ├── services/
    │   ├── api.ts                             # Client-side API service with in-memory caching
    │   ├── apiConfig.ts                       # Backend URL resolution & JWT header injection
    │   ├── authService.ts                     # Client authentication and session manager
    │   ├── fileUploadService.ts               # File compression & R2 upload coordinator
    │   ├── imageCompressionService.ts         # Client-side canvas image downsampling
    │   ├── realtimeService.ts                 # SSE stream client with polling fallback
    │   └── routerService.ts                   # Custom HTML5 History SPA router
    ├── types/
    │   ├── index.ts                           # Comprehensive TypeScript type definitions
    │   └── realtime.ts                        # Realtime event types and payloads
    └── utils/
        ├── idCardPdfExporter.ts               # Multi-card batch PDF generator
        ├── qrcodeHelper.ts                    # QR code data URL generator
        └── timetablePdf.ts                    # Master timetable PDF generator
```

---

## 11. Class Teacher Assignment & Dynamic Attendance Architecture

```
[Admin / Principal]
       │
       ▼ (PUT /api/teachers/:id)
┌─────────────────────────────────────────────────────────────┐
│ Express Server & Persistent Storage Layer                   │
│ 1. Updates Staff in MongoDB `staff` collection:             │
│    - classTeacherOf: "Class 1-A"                            │
│    - teachingProfile: { assignedClassId, assignedSection }   │
│    - assignedClasses: ["Class 1-A"]                         │
│ 2. Cascades to `classes` collection in MongoDB:             │
│    - class.classTeacherId / detailedSections.classTeacherId  │
│ 3. Broadcasts SSE: TEACHER & STAFF UPDATE events            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼ Realtime SSE Event
┌─────────────────────────────────────────────────────────────┐
│ Client Attendance Module (AttendanceView.tsx)                │
│ 1. `api.getAssignedClassesForAttendance()` resolves:        │
│    - `defaultClassId`, `defaultSection` automatically       │
│    - `classes`: strictly active classes & sections          │
│ 2. Queries `/api/students?classId=...&section=...`:         │
│    - Dynamically renders active student roster              │
│ 3. Queries `/api/attendance?classId=...&date=...`:          │
│    - Populates existing marked statuses (no duplicates)      │
│ 4. `POST /api/attendance`:                                  │
│    - Enforces teacher assignment validation (RBAC)          │
│    - Upserts records atomically to MongoDB Atlas            │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Security & Data Integrity Highlights:
1. **Strict Active-Only Filtering:** Inactive classes (e.g. `c-archived-sample`) and inactive sections are excluded from dropdowns and assignment options.
2. **Atomic Upsert Mechanics:** Prevents duplicate rows for the same `classId + section + date` combination by matching student identifiers and replacing matching rows atomically.
3. **RBAC Boundary:** `/api/attendance` validates that teachers can only view and mutate attendance for classes and sections explicitly assigned via `classTeacherOf`, `teachingProfile`, or timetable assignments, returning HTTP 403 Forbidden for unauthorized requests.

---

## 12. Institutional Certificate & TC PDF Rendering Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Data Ingestion & Preloading Layer (PrintableCertificateModal.tsx)   │
│    - Dynamic Student Retrieval: api.fetchStudentDirect(student.id)     │
│    - School Settings Sync: api.syncSettings()                          │
│    - Asset Preloader: preloadDocumentAssets() / resolveStudentPhoto()   │
│      * DOM Canvas Extraction: #certificate-student-photo-{id}          │
│      * Cloudflare R2 / Local Storage: /api/files/content?key=...       │
│      * Remote CDN Safe Proxy: /api/files/image-proxy?url=...           │
│      * Pre-Rasterization to standard JPEG/PNG Base64                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Vector PDF Generation Engine (certificatePdfExporter.ts)            │
│    - Canvas: 210mm x 297mm (Standard A4 Portrait), Margin 8mm          │
│    - Double Outer Institutional Border: 1.2mm slate-900 / 0.4mm inner  │
│    - Header Block: School Crest + School Title + Affiliation + Badge   │
│    - Student Profile Photo: 24mm x 30mm Passport Box                   │
│      * Aspect Ratio Preserved: Natural fit centered inside box         │
│      * Zero Distortion / Stretching                                    │
│                                                                        │
│    A. Transfer Certificate (TC):                                       │
│       - 17 itemized CBSE-standard particulars with dynamic spacing     │
│       - Values highlighted with subtle underline                       │
│       - Verified registration note                                     │
│                                                                        │
│    B. Character & Bonafide Certificates:                               │
│       - Custom `renderJustifiedParagraph` Word Distribution:           │
│         * Natural line-wrapping (splitTextToSize)                      │
│         * Standard inter-word spacing on intermediate lines            │
│         * Last line strictly naturally left-aligned (no stretching)    │
│       - Balanced Vertical Space Allocation:                            │
│         * Dynamic gaps between paragraphs                              │
│         * Dual-column Institutional Record Verification Box (32mm)     │
│         * Embossed Official Seal Stamp Placeholder Area                │
│                                                                        │
│    - 3-Column Signatures: Prepared By | Checked By | Principal         │
│      * Embedded Principal Signature Image (if present)                 │
│    - Single-Page Guarantee: Truncates extraneous page buffers          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Client Export & Print Isolation                                     │
│    - Download: Direct vector file download (doc.save(filename))        │
│    - Print CSS: body.certificate-modal-active isolates sheet container │
│      * @media print: A4 portrait, 0 margin, background app hidden      │
└────────────────────────────────────────────────────────────────────────┘
```


---

## 13. Login Rate Limiting, Audit Trail Policy & Exam Schedule (mobile)

### 13.1 Login rate limiting (`server/services/loginThrottle.ts`)
One endpoint serves the website and the mobile app: `POST /api/auth/login`. A middleware (`createLoginGuard`) runs before any password check.
* Only **failed** sign-ins (HTTP 400/401/403/404 with an identifier) count; a correct sign-in clears that account's counter. 503 (database offline) and 429 are never counted, so legitimate users and a whole school behind one Wi-Fi are not locked out.
* Limits (15-minute window): 5 failures per account+network → 1 min cooldown; 20 failures on one account from any network → 5 min; 30 failures from one network → 5 min; 120 requests/min from one network → 30 s. Cooldowns double on every repeat (caps 15 / 30 min).
* Response: `429` with `Retry-After`, `{ code: 'LOGIN_RATE_LIMITED', retryAfterSeconds, error: "...Please wait N seconds..." }`; the mobile app already shows `error` text.
* Network address = last `X-Forwarded-For` hop (the nearest proxy), so extra spoofed hops are ignored. State is in memory (resets on restart; with several server instances each keeps its own counters).
* The older `forgot-password`, `change-password` and `reset-password` limiters (`AttemptLimiter`) are unchanged.

### 13.2 Audit trail policy (`server/services/auditPolicy.ts`, `logAudit` / `audit(req, …)` in `server.ts`)
* **Not recorded:** routine activity — `USER_LOGIN`, `USER_LOGOUT`, `SWITCH_CHILD`, `REPORT_VIEWED`, scan-based attendance, own-profile edits, draft marks saves, bootstrap events. Repeated `LOGIN_FAILED` / `LOGIN_BLOCKED` / `PASSWORD_CHANGE_FAILED` collapse to one entry per person per 10 minutes.
* **Recorded (with actor = the signed-in user from the session, IP, timestamp, entity, entityId):** all deletions; fee structure/configuration create/update/delete; fee collection, refund, waiver, invoice edit and bill creation; exam create/update/delete, status/admit-card/results publishing, results approval; marks submitted or corrected; plus existing student/staff/user/settings/hostel/transport actions. Hard-coded actor names were replaced by the real session user.
* `metadata` on every entry: `category` (`DATA_DELETION`, `FINANCE`, `EXAM`, `ACADEMIC`, `SECURITY`, `ADMINISTRATION`), `severity` (`critical` for deletion/finance/exam), `actorId`, and where relevant `before`, `after`, `changes { field: { from, to } }`. Exam snapshots hold name, type, dates, status and the timetable (subject, date, time, room).
* **Secrets:** keys that look like password/token/secret/hash/otp/api key are replaced by `[redacted]` before storing and again when reading; `password=…` pairs in free text are masked.
* `POST /api/audit-logs` (browser-reported) is kept for compatibility but uses the session identity, is stored with `metadata.source = 'client'`, and is ignored (`202`) when routine or when the server already logged the same record within 2 minutes.
* **Read access:** `GET /api/audit-logs` needs `audit_logs.view` (Super Admin, School Admin, Principal); students/parents/teachers/accountants get 403. Entries are append-only; existing history is not deleted.

### 13.3 Mobile exam schedule
* Pure model `mobile/src/utils/examScheduleModel.ts` (class/section papers, drafts hidden, duplicates collapsed, type & month filters, day grouping, duration, today/upcoming/completed).
* One shared view `components/exam/ExamScheduleBody.tsx` (summary card, filter chips, papers grouped by date, detail sheet, loading skeleton / empty / error with retry; wraps on narrow phones).
* Staff & teachers: `screens/ExamScheduleScreen.tsx` (class + section picker; teachers see only their classes). Parents: `parent/screens/ParentExamScheduleScreen.tsx` (route `exams`, from Home "View all" and More). Students: the same screen via the menu and the Home "Next Exam" card. All use `GET /api/exams`; the server already hides drafts from students/parents.
* Parent login no longer shows "Forgot password?" (mobile only); staff keeps it, the website is unchanged.

## 14. Hostel Warden Portal & Support Staff (Phase 46)
* **Mobile:** `mobile/src/warden/` — `WardenPortal.tsx` (tabs Home / Students / Attendance / More + stack: student, leaves, mess, alerts, history, messages, profile), `wardenApi.ts` (all calls through `apiService.request`; writes never auto-retry), `wardenRules.ts` (pure, tested), `wardenUi.tsx` (navy header, stat tiles, P/A/L/O picker, prompt sheet). Reuses parent `ui.tsx` (Screen with pull-to-refresh, skeleton, state blocks), `ChatInbox` (with `loadPickerStudents`), `ChangePasswordCard`, `NotificationsCard`.
* **Server:** `registerHostelWardenRoutes(app, deps)` in `server/routes/hostelWardenRoutes.ts`, registered after the engagement routes (it reads their student-leave store; engagement reads its `hostelStudentIdsFor` for warden access). Data via `Store` (`server/services/memoryStore.ts`: in-memory + MongoDB write-through). A per-hostel+night `KeyedMutex` plus a unique index prevent duplicate roll-call.
* **Access matrix:** HOSTEL_WARDEN — own hostel(s) only: dashboard view, students view, night attendance mark + correct (2 days, audited), alerts raise/resolve, mess manage, leave view + forward. Admin tier — all hostels, same plus older corrections; approval stays in `PUT /api/student-leaves/:id/status`. Everyone else — 403.
* **Support staff:** `SUPPORT_STAFF` in `PortalStaffRole`, `UserRole` (web + mobile), `ROLE_HIERARCHY` (5), no permissions; login refused in the login route, `getAuthContext` and `isAuthEntityDisabled`.

