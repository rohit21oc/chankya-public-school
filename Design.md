# Design System & Institutional Branding Manual

## CHANAKYA PUBLIC SCHOOL & COACHING CENTRE
**Institutional Design Language, Visual Tokens & Component Architecture**

---

### 1. Institutional Identity & Official Brand Assets

* **Official Institution Name:** CHANAKYA PUBLIC SCHOOL & COACHING CENTRE
* **Campus Address:** Kushahar Ward 07, Kushahar, Sheohar, Bihar - 843329
* **CBSE Affiliation Code:** 10034104008
* **School Code:** CPS-7821
* **Affiliated Board:** Central Board of Secondary Education (CBSE), New Delhi
* **Institutional Email:** cpskushahar@gmail.com
* **Primary Mobile Contacts:** +91 8207870192, +91 8207870192
* **Office & Landline Contacts:** +91 8207870192, 06222-796505
* **Official Crest / Logo Key in Cloudflare R2:** `school/school-logo/logo.png`

---

### 2. Design Philosophy & Tone

The application delivers two harmonious yet distinct experiences:
1. **The Public Digital Campus (Marketing & Community Showcase):**
   - Welcoming, prestigious, trustworthy, and inspirational.
   - Rich editorial typography, hero photography, warm gold accents, high-contrast dark navy footers, and intuitive mobile enquiry access.
2. **The ERP Administrative Portal (High-Density Operational Workspace):**
   - Precise, clean, modern, and uncluttered.
   - High information density, clear visual hierarchy, accessible contrast, scannable data tables, responsive modal dialogues, and print-isolated document workflows.
   - **Zero-Pill Discipline:** Avoids cartoonish SaaS aesthetics, floating pill menus, or gratuitous neon gradients in favor of structured cards with subtle borders (`border-slate-200`) and rounded radii (`rounded-xl` / `rounded-2xl`).

---

### 3. Color Token System

Configured via CSS custom properties in `src/index.css` and Tailwind CSS v4:

```css
:root {
  --primary: #0B1F4B;          /* Deep Institutional Navy */
  --primary-dark: #051437;     /* Midnight Navy (Top bars, deep headers) */
  --primary-royal: #123B8C;    /* Royal Academic Blue (Active states, brand accents) */
  --primary-bright: #1D5FD1;   /* Vibrant Blue (Primary buttons, link interactions) */
  --accent-gold: #D9A441;      /* Heritage Gold (CBSE insignia, honors, highlights) */
  --accent-gold-light: #F3D27A;/* Soft Gold Tint (Badges, sub-headings) */
  --surface: #FFFFFF;          /* Pure White (Cards, modals, data tables) */
  --surface-soft: #F7F9FC;     /* Off-White Slate (Application background) */
  --text-main: #101828;        /* Slate 900 (High contrast primary text) */
  --text-muted: #667085;       /* Slate 500 (Labels, timestamps, secondary copy) */
  --border-color: #E4E7EC;     /* Slate 200 (Clean divider lines) */
  --success: #16803C;          /* Forest Emerald (Paid status, present attendance) */
}
```

#### Functional Palette & Semantic Tokens
* **Primary Actions:** `bg-blue-600 hover:bg-blue-700 text-white shadow-xs`
* **Destructive Actions:** `bg-red-50 text-red-700 hover:bg-red-100 border border-red-200`
* **Success / Paid Badges:** `bg-emerald-50 text-emerald-700 border border-emerald-200`
* **Warning / Overdue Badges:** `bg-amber-50 text-amber-700 border border-amber-200`
* **Neutral / Draft Badges:** `bg-slate-100 text-slate-700 border border-slate-200`
* **Institutional Badges:** `bg-blue-50 text-blue-900 border border-blue-200`

---

### 4. Typography Standards

Loaded via Google Fonts in `/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap" rel="stylesheet" />
```

| Element | Font Family | Tailwind Class | Weight | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- |
| **Institutional Titles (H1, H2)** | `Outfit`, sans-serif | `font-heading font-bold` | 700 / 800 | `-0.02em` (Tight) |
| **Section Headings (H3, H4)** | `Outfit`, sans-serif | `font-heading font-semibold` | 600 | `-0.01em` |
| **Modal / Card Titles** | `Outfit`, sans-serif | `font-heading font-semibold` | 600 | Normal |
| **Body & UI Text** | `Plus Jakarta Sans`, sans-serif | `font-sans` | 400 (Regular) | Normal |
| **Form Labels & Table Headers** | `Plus Jakarta Sans`, sans-serif | `font-sans font-medium text-xs` | 500 / 600 | `0.02em` (Uppercase) |
| **Numeric Data / IDs / Codes** | System Monospace | `font-mono` | 500 | Normal |

---

### 5. UI Component Hierarchy & Patterns

#### 5.1 Top Navigation (`src/components/Navbar.tsx`)
* **Height:** 64px (`h-16`).
* **Background:** Dark Navy (`bg-slate-900` / `#051437`) with bottom border `border-slate-800`.
* **Left Section:** School logo image, school name in Outfit (`font-heading font-bold text-white text-base`), and active academic session chip (`bg-slate-800 text-blue-300`).
* **Right Section:** Quick action buttons (View Public Website, API Docs, Settings), notification bell, and user profile pill with avatar and role chip.

#### 5.2 Responsive Navigation Drawer (`src/components/Sidebar.tsx`)
* **Desktop Expanded:** Width `w-64` (256px), background `bg-slate-900 text-slate-300 border-r border-slate-800`.
* **Desktop Collapsed:** Width `w-20` (80px) displaying centered Lucide icons with instant hover tooltips. Toggleable via chevron button or `Ctrl+B` shortcut.
* **Mobile Drawer:** Fixed drawer with backdrop overlay (`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs`), slide-in transition from left, and close touch button (`X`).
* **Nav Item Styling:**
  - Active: `bg-blue-600 text-white font-semibold shadow-xs`
  - Inactive: `text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors`

#### 5.3 Data Tables
* **Wrapper:** `bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs`
* **Table Element:** Full width with horizontal scroll container (`overflow-x-auto min-w-full`).
* **Header (`<thead>`):** `bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider`.
* **Row (`<tr>`):** `hover:bg-slate-50/75 transition-colors border-b border-slate-100 last:border-b-0`.
* **Cell Padding:** `px-4 py-3.5 text-sm text-slate-800`.

#### 5.4 Form Controls & Input Fields
* **Input Box:** `w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400`
* **Select Dropdown:** Styled native `<select>` with matching border and custom chevron.
* **Label:** `block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5`
* **Error Message:** `text-xs text-red-600 mt-1 flex items-center gap-1`

#### 5.5 Modals & Dialogues
* **Backdrop:** `fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto`
* **Modal Card:** `bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl my-auto overflow-hidden`
* **Modal Header:** `px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50`
* **Modal Body:** `p-6 max-h-[80vh] overflow-y-auto`
* **Modal Footer:** `px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3`

#### 5.6 Authentication & Login Experience (`src/components/auth/LoginView.tsx`)
* **Layout:** Centered card over deep institutional gradient (`from-slate-900 via-slate-800 to-indigo-950`) with subtle ambient radial glow accents.
* **Header Branding:** Official school crest / logo (`w-16 h-16 rounded-xl`), school name in Outfit (`font-heading font-bold text-2xl text-white`), CBSE affiliation tag.
* **Three Consolidated Experiences (Tabs):**
  - **Staff / Admin Tab:** Purple brand accent (`bg-purple-600`), icon `ShieldCheck`. Single common login for all 10 roles (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `ACADEMIC_COORDINATOR`, `ACCOUNTANT`, `TEACHER`, `HOSTEL_WARDEN`, `TRANSPORT_MANAGER`, `HR_STAFF`). No role picker.
  - **Student Tab:** Royal Blue brand accent (`bg-blue-600`), icon `GraduationCap`. Inputs: Admission / Registration Number + Date of Birth (`font-mono`).
  - **Parent Tab:** Warm Amber brand accent (`bg-amber-600`), icon `Users`. Inputs: Registered Mobile Number + Child's Date of Birth.
* **Password Field:** Integrated Lucide `Eye`/`EyeOff` visibility toggle button.
* **Forgot Password Flow:** Inline transition to single-input reset request; on success, renders clean confirmation card with zero token/link exposure.
* **Public Registration:** Strictly omitted; zero "Register / Create Account" CTAs.

#### 5.7 Public Management Team Carousel (`src/components/public/PublicManagementTeamSection.tsx`)
* **Display Structure:** Smooth horizontal sliding carousel presenting member cards in a single overflow-hidden row.
* **Responsive Card Viewport:**
  - Desktop (`lg:`, $\ge 1024$px): 3 cards visible side-by-side (`gap-6`, 24px gap).
  - Tablet (`sm:` to `md:`, 640px - 1023px): 2 cards visible (`gap-6`, 24px gap).
  - Mobile (`< 640`px): 1 card visible (`gap-4`, 16px gap).
* **Card Anatomy:**
  - Portrait photo container with 4:5 aspect ratio (`aspect-[4/5]`) and subtle zoom-on-hover transition (`duration-500 hover:scale-105`).
  - Designation pill badge in upper-left corner with `Sparkles` icon (`bg-white/95 text-[#123B8C] font-black uppercase text-xs`).
  - Optional italic quote overlay with gradient backdrop on hover.
  - Bold member name in `Outfit`, designation chip, qualification badge with `GraduationCap` icon, and 2-line clamped short bio.
  - Full-width "More Info" action button with `ArrowRight` icon triggering `PublicManagementProfileModal` or direct URL route `/management/:id`.
* **Motion & Interaction Tokens:**
  - Auto-slide: 3000ms automatic horizontal translation interval.
  - Transition timing: 500ms `cubic-bezier(0.25, 1, 0.5, 1)` with reduced-motion fallback.
  - Pause & Resume: Auto-slide pauses during hover, mouse drag, touch swipe, or dot interaction; automatically resumes after a 4-second delay.
  - Dynamic Pagination: Generates exactly $N$ clickable rounded dots (`w-2.5 bg-slate-300` inactive, `w-8 bg-[#123B8C]` active) centered beneath cards.
  - Circular Loop: Seamless infinite looping using boundary clone buffers without duplicate layout rendering.
* **Edge Cases:** 0 members gracefully hidden; 1 member rendered as centered static card; 2 members rendered responsively; 3 members stable on desktop; 4+ members active sliding carousel.

---

### 6. Official Printable Documents & Print Isolation Standards

Standardized printable documents are configured in `src/index.css` under `@media print`:

```css
@media print {
  @page {
    size: auto;
    margin: 6mm;
  }
  
  html, body, #root, #root > div, main {
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    background: #ffffff !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* When an ID card modal is active during print: isolate it completely */
  body.id-card-modal-active * {
    visibility: hidden !important;
  }
  body.id-card-modal-active #printable-id-card-view,
  body.id-card-modal-active #printable-id-card-view *,
  body.id-card-modal-active #bulk-cards-print-stage,
  body.id-card-modal-active #bulk-cards-print-stage * {
    visibility: visible !important;
  }

  /* When report card modal is active during print */
  body.report-card-modal-active * {
    visibility: hidden;
  }
  body.report-card-modal-active .report-card-modal-root,
  body.report-card-modal-active .report-card-modal-root * {
    visibility: visible;
  }

  .print\:hidden {
    display: none !important;
  }
}
```

#### 6.1 Standard Printable Formats

1. **Student & Teacher ID Cards:**
   - Standard ID-1 Form Factor: 85.6mm x 54mm (CR80 standard).
   - Card Front: School crest, school name, photo, student name, admission number, class & section, roll number, blood group, emergency contact.
   - Card Back: Permanent address, bus route stop / hostel room, institutional rules, principal's authorized signature, and dynamic verification QR code.
   - Batch Print Grid: 8 cards per A4 sheet (2 columns x 4 rows) with crisp cutting guides.

2. **Official Fee Payment Receipts (`PrintableReceiptModal.tsx`):**
   - Format: A4 portrait or A5 voucher.
   - Header: School name, CBSE Affiliation Code 10034104008, campus address, receipt number, date, payment mode, transaction ID.
   - Table: Itemized fee ledger heads (Tuition, Transport, Hostel, Late Fine, Discount).
   - Footer: Total Amount Received in words, outstanding balance, cashier signature, authorized stamp.

3. **CBSE Academic Report Cards (`PrintableReportCardModal.tsx`):**
   - Format: Formal A4 Portrait with double border.
   - Top Header: School crest, full institutional title, affiliation code, student demographic matrix (DOB, Mother's Name, Father's Name, Roll No).
   - Scholastic Assessment Table: Periodic Test, Multiple Assessment, Portfolio, Subject Enrichment, Half-Yearly/Annual Marks, Total Marks, Letter Grade.
   - Co-Scholastic & Discipline Table: 3-point grading (A, B, C) for Work Education, Art Education, Health & Physical Education, Discipline.
   - Attendance Summary & Class Teacher Remarks.
   - Signatures: Class Teacher, Examination Controller, Principal.

4. **Transfer & Character Certificates (`PrintableCertificateModal.tsx`):**
   - Format: Official institutional certificate with watermarked school seal background.
   - Sequential Certificate Number, date of issue, student enrollment history, conduct remarks, and official signatures.

---

### 7. Responsive Breakpoints & Viewport Presence

| Breakpoint | Width | Behavior & Layout Adaptations |
| :--- | :--- | :--- |
| **Mobile (`< 640px`)** | Small phone screens | Top bar collapses details into hamburger icon; sidebar becomes full slide-out drawer; data tables scroll horizontally with sticky first columns; action buttons stack vertically. |
| **Tablet (`640px - 1024px`)** | iPads & Tablets | Sidebar collapses to icon rail (`w-20`); cards reflow to 2-column grids; modals maintain `max-w-2xl`. |
| **Desktop (`> 1024px`)** | Standard Monitors | Sidebar expands to `w-64`; multi-column dashboard analytics cards; large modal viewports. |
| **High-Res (`> 1440px`)** | Large displays | Main workspace centers inside `max-w-7xl mx-auto` to prevent excessive visual stretching. |

---

### 8. Visual Inconsistencies Normalization Guidelines

To maintain visual purity across the codebase, adhere to these normalization rules:
1. **Never use non-institutional primary blues:** Always use `bg-blue-600` or `bg-[#0B1F4B]`, not cyan, teal, or indigo.
2. **Never hardcode school name variations:** Always use `CHANAKYA PUBLIC SCHOOL & COACHING CENTRE` or bind dynamically to `settings.schoolName`.
3. **Modal Z-Index Uniformity:** Backdrops use `z-50`; nested tooltips or dropdowns use `z-60`. Never introduce arbitrary `z-[9999]`.
4. **Card Padding Uniformity:** Standard cards use `p-6`; compact list items use `p-4`.
5. **Border Consistency:** Standard card borders use `border border-slate-200`; dark theme top bars use `border-b border-slate-800`.
6. **Communication Center Clean UI Standards:**
   - **Zero Marketing Fluff:** Strictly omit explanatory slogans, decorative introductory paragraphs ("Broadcast institutional circulars...", "Omni-channel announcements..."), and instructional descriptions.
   - **Operational Compactness:** Prioritize clean metric chips, functional labels, clear status badges (`PUBLISHED`, `DRAFT`, `EXPIRED`, `SENT`, `FAILED`), and scannable tabular rows.
   - **Interactive Modals:** Ensure modal headers are concise ("Publish Circular", "Custom SMS Composer", "SMS Dispatch Details") with clear validation alerts, character counters, and confirmation buttons.

---

### 9. Class Teacher Assignment & Attendance UX/UI Design Specifications

1. **Teacher Assignment Controls (Staff Edit & Add Views):**
   - **Dynamic Selection Dropdown:** Populated directly from MongoDB active classes (`(c.status || 'ACTIVE') === 'ACTIVE'`). Shows clean badge indicator `(Active Only)`.
   - **Dependent Section Picker:** Automatically filters sections belonging to the selected class. Defaults to the first active section and disables cleanly if no class is selected.
   - **Incharge Toggle:** Emerald toggle (`peer-checked:bg-emerald-600`) with descriptive status subtitle confirming the exact class and section the teacher is designated to manage.

2. **Attendance Register Workspace:**
   - **Auto-Default Banner:** Clearly indicates the teacher's active section assignment without requiring tedious manual dropdown hunting.
   - **Student Roster Layout:** Clean table with roll numbers, student names, admission numbers, quick status action pills (`PRESENT`, `ABSENT`, `LEAVE`, `LATE`), and inline remark inputs.
   - **Duplicate-Safe State Transition:** Replaces blank records seamlessly with existing saved records if a date has already been marked, indicating current saved status clearly with color-coded badges.
   - **Feedback & Feedback Alerts:** Prominent toast banners (`text-emerald-800 bg-emerald-50` for success; `text-rose-800 bg-rose-50` for validation/RBAC errors).

---

### 10. Institutional Certificate & Transfer Certificate (TC) Design Specifications

1. **A4 Sheet Geometry & Framing:**
   - **Canvas Dimensions:** Exact A4 portrait (210mm x 297mm).
   - **Margin System:** 8mm outer margin, 10.5mm inner margin creating a classical institutional double border (`1.2mm` outer slate-900 line, `0.4mm` inner fine line).
   - **Content Width:** 182mm (`contentX: 14mm`, `contentRight: 196mm`).

2. **Typography & Word Flow Hierarchy:**
   - **Institutional Heading:** Times New Roman Bold 15.5pt in Deep Navy (`#0F172A`), centered alongside the institutional crest.
   - **Affiliation & Address:** Helvetica 8.5pt/8pt in Slate-700 (`#334155`).
   - **Certificate Badge:** Centered title rectangle in `#F8FAFC` with `#0F172A` border and uppercase 8.5pt bold title text.
   - **Narrative Paragraphs (Character & Bonafide):**
     - Font: Times New Roman 12pt regular, Deep Slate (`#0F172A`).
     - Line Height: 6.8mm consistent line spacing.
     - Indentation: 8mm first-line paragraph indent matching portal preview.
     - Alignment: Justified on body lines with word spacing capped at 2.3x normal space; last line strictly left-aligned with natural letter/word spacing.

3. **Student Profile Photo Specifications (Transfer Certificate & Certificates):**
   - **Frame Dimensions:** Exactly 24mm width x 30mm height (authentic Indian passport photo proportion 4:5).
   - **Position:** Right-aligned within the meta row (`photoX: 172mm`, `photoY: 48mm`).
   - **Border & Fill:** 0.35mm slate-400 stroke over a clean white background `#FFFFFF`.
   - **Aspect Ratio Preservation:** Computes natural image aspect ratio; fits and centers the image within the container without vertical or horizontal stretching.

4. **Institutional Record Verification & Seal Component:**
   - **Geometry:** Full content width (182mm) x 32mm height, rounded corners (2mm radius), fill `#F8FAFC`, border 0.35mm `#CBD5E1`.
   - **Header:** Uppercase bold 8.5pt `INSTITUTIONAL RECORD VERIFICATION & OFFICIAL SEAL` centered above a fine divider.
   - **Grid:** Two balanced columns detailing Admission Register Volume, CBSE Affiliation Code, Institutional Status, and Authorizing Authority.
   - **Seal Watermark Guide:** Centered dotted ring (7.5mm radius, `#CBD5E1`, dash pattern `[1.5, 1.5]`) representing the official embossed institutional stamp zone.

5. **Signature Block Hierarchy:**
   - **Y-Target:** Solid divider at Y=252mm, dashed signature lines at Y=268mm.
   - **Trio Arrangement:**
     1. Left: `Prepared By (Admin)` (Helvetica bold 8pt)
     2. Center: `Checked by Registrar` (Helvetica bold 8pt)
     3. Right: Principal Signature image (28mm x 8.5mm) above dashed line + Principal Name (8.5pt bold) + `Principal / Head of Institution` (7pt slate-500).

---

### 11. Institutional Transactional Email Design System (Brevo API)

All transactional emails dispatched via Brevo adhere to the school's official visual brand identity:

1. **Brand Architecture & Color Palette:**
   - **Primary Banner:** Deep Institutional Navy Blue (`#1e3a8a` to `#0f172a` gradient).
   - **Accent Border:** School Gold (`#f59e0b` 4px accent divider).
   - **Background Frame:** `#f1f5f9` with centered 620px max-width card (`#ffffff`), subtle border (`#e2e8f0`), and soft shadow.
   - **Primary CTA Buttons:** Solid `#1e3a8a` with 8px radius, bold white text (`#ffffff`), 14px/36px padding, and 0.5px letter spacing.

2. **Institutional Header Block:**
   - **Title:** `CHANAKYA PUBLIC SCHOOL & COACHING CENTRE` (20px uppercase, font-weight 800).
   - **Address Subtitle:** `Kushahar Ward 07, Kushahar, Sheohar, Bihar - 843329` (13px `#cbd5e1`).
   - **Portal Badge:** `School Management ERP Portal` (12px `#93c5fd` uppercase tracking).

3. **Core Email Templates:**
   - **Password Reset:** Centered reset CTA button, direct link fallback in monospace font, warning box with 15-minute expiration and single-use security badge.
   - **Admission Confirmation:** Student name, admission number, class & section details, portal URL, and initial login guidance.
   - **Staff Welcome Credentials:** Employee ID, portal user ID, assigned role badge, temporary password container (`#fef08a`), and mandatory change password on first login instruction.
   - **Admin Password Reset:** Issued temporary password box with 24px monospace font, dashed golden border (`#ca8a04`), and direct portal sign-in button.

4. **Security Notice Boxes:**
   - Warning callouts use `#fefce8` background with `#eab308` left accent border and `#854d0e` text for critical expiration or change password requirements.
   - Success alerts use `#ecfdf5` background with `#10b981` border and `#065f46` text.

5. **Institutional Footer:**
   - Official contact details, school address, automated notification disclaimer ("Do not reply to this email"), and copyright notice.

---

### 12. Fee Structure, Student Admission & Fee Billing UI System

1. **Step 4 Fee Structure Selector (Admission Wizard):**
   - High-contrast checkbox table displaying fee heads, categories (`ONE_TIME`, `MONTHLY`, `YEARLY`, `EXAMINATION`, `FACILITY`), frequencies, amounts, and descriptions.
   - Six required default heads highlighted in checked state: Admission Fee, School Fee, Exam Fee, Uniform / Dress Code, Books & Stationery, ID Card Fee.
   - Live dynamic summary cards:
     - Blue Card: Payable at Admission (One-Time Initial Charges).
     - Emerald Card: Monthly Regular Payable.
     - Purple Card: Annual / Exam Dues.
     - Slate 900 Card: Total Applicable Annual Fee.
   - Reset Defaults action restoring class configuration; inline numeric amount adjustments for scholarships.

2. **Admission-Time Payment Station (`AdmissionSuccessPage.tsx`):**
   - Immediate bill status widget with live outstanding balance calculation.
   - High-contrast primary action: "Pay Admission Fee" button (`bg-emerald-600 hover:bg-emerald-700`).
   - Opens payment drawer/modal with payment method selectors (Cash, UPI, Bank Transfer, Cheque).
   - Generates official receipt with green confirmation card, receipt number, and instant printable receipt modal.

3. **Fee Ledger & Overdue Indicators (`MonthlyFeeLedgerPanel`, `StudentFeeProfile`):**
   - Invoice Month and Due Date clearly labeled (e.g. Due: `10 Oct 2026`).
   - Overdue Status Pill: `bg-rose-50 text-rose-700 border-rose-200` with ₹50 late fee chip when past the 10th.
   - Due Status Pill: `bg-amber-50 text-amber-700 border-amber-200` for active bills within 1st-10th window.
   - Fully Paid Status Pill: `bg-emerald-50 text-emerald-700 border-emerald-200` with zero fine.
   - Balance breakdown showing Base Fee, Late Fee, Concessions, Amount Paid, and Net Outstanding.


