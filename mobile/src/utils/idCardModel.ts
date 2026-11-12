/**
 * View model for the student and staff ID cards on mobile. Same design and
 * fields as the website cards (src/components/common/StudentIdCard.tsx and
 * TeacherIdCard.tsx).
 *
 * - Only real data: a missing value reads "Not recorded"; optional items
 *   (blood group, photo, signature) are left out.
 * - The QR shows the signed code from the server (qrToken). It holds only the
 *   card type, the record id and a signature: no name, date of birth or phone.
 *   Without a code from the server the card shows "QR not available".
 */
import { SCHOOL_INFO } from './branding';
import { NOT_CONFIGURED, getSchoolIdentity } from './schoolIdentityModel';

export const NOT_RECORDED = 'Not recorded';

export type IdCardKind = 'STUDENT' | 'STAFF';
export type IdCardRow = { label: string; value: string };

export interface IdCardModel {
  kind: IdCardKind;
  title: string;
  schoolName: string;
  schoolAddress: string;
  affiliationCode: string;
  /** Board the school is affiliated to (BSEB, CBSE …), from school settings; empty when not set. */
  board?: string;
  logoKey?: string;

  name: string;
  initials: string;
  /** Staff only: "Designation: ..." line under the name. */
  designation?: string;
  bloodGroup?: string;
  photoKey?: string;
  frontRows: IdCardRow[];
  backRows: IdCardRow[];

  signatureKey?: string;
  qrToken?: string;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const orNot = (v: unknown): string => clean(v) || NOT_RECORDED;

/** "2007-01-31" -> "31/01/2007"; other formats are shown as stored. */
export function formatCardDate(v: unknown): string {
  const s = clean(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : orNot(s);
}

/** "ACADEMICS" -> "Academics"; short codes ("IT") and mixed-case text are kept. */
export function titleCase(v: unknown): string {
  const s = clean(v);
  if (!s || s.length <= 3 || s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export function initialsOf(name: string): string {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Subjects for the staff card: expertise first, then assigned subjects, at most two. */
export function staffCardSubjects(staff: any): string {
  const list = [
    ...(Array.isArray(staff?.subjectExpertise) ? staff.subjectExpertise : []),
    ...(staff?.assignedPrimarySubject ? [staff.assignedPrimarySubject] : []),
    ...(Array.isArray(staff?.assignedSubjects) ? staff.assignedSubjects : []),
  ]
    .map(clean)
    .filter(Boolean);
  return Array.from(new Set(list)).slice(0, 2).join(', ');
}

function school(settings: any) {
  return {
    schoolName: clean(settings?.schoolName) || getSchoolIdentity().name || NOT_CONFIGURED,
    schoolAddress: clean(settings?.schoolAddress) || clean(settings?.address) || getSchoolIdentity().address || NOT_CONFIGURED,
    affiliationCode: clean(settings?.affiliationCode) || clean(settings?.affiliationNumber) || getSchoolIdentity().affiliationNo || NOT_CONFIGURED,
    board: clean(settings?.affiliatedBoard).toUpperCase() || undefined,
    logoKey: clean(settings?.schoolLogo) || clean(settings?.logoFileKey) || undefined,
    signatureKey: clean(settings?.principalSignature) || clean(settings?.principalSignatureFileKey) || clean(settings?.signatureFileKey) || undefined,
  };
}

export function buildStaffIdCardModel(staff: any, settings: any, user: { name?: string }, qrToken?: string): IdCardModel {
  const s = school(settings);
  const name = clean(staff?.name) || clean(user?.name);
  return {
    kind: 'STAFF',
    title: 'FACULTY / STAFF IDENTITY CARD',
    ...s,
    name: name || NOT_RECORDED,
    initials: initialsOf(name),
    designation: orNot(staff?.designation),
    bloodGroup: clean(staff?.bloodGroup) || undefined,
    photoKey: clean(staff?.photo) || clean(staff?.photoFileKey) || undefined,
    frontRows: [
      { label: 'Staff ID', value: orNot(staff?.employeeId) },
      { label: 'Subject', value: orNot(staffCardSubjects(staff)) },
      { label: 'DOB', value: formatCardDate(staff?.dob) },
    ],
    backRows: [
      { label: 'School Name', value: s.schoolName },
      { label: 'Department', value: orNot(titleCase(clean(staff?.customDepartment) || clean(staff?.department))) },
      { label: 'Mobile', value: orNot(staff?.phone) },
      { label: 'Email', value: orNot(staff?.email) },
    ],
    qrToken: clean(qrToken) || undefined,
  };
}

export function buildStudentIdCardModel(student: any, settings: any, qrToken?: string): IdCardModel {
  const s = school(settings);
  const name = clean(student?.name);
  const mobile =
    clean(student?.fatherMobile) || clean(student?.parentPhone) || clean(student?.guardianMobile) || clean(student?.motherMobile) || clean(student?.mobile);
  return {
    kind: 'STUDENT',
    title: 'STUDENT IDENTITY CARD',
    ...s,
    name: name || NOT_RECORDED,
    initials: initialsOf(name),
    bloodGroup: clean(student?.bloodGroup) || undefined,
    photoKey: clean(student?.photo) || clean(student?.photoFileKey) || undefined,
    frontRows: [
      { label: 'Student ID', value: orNot(student?.admissionNumber) },
      { label: 'Class', value: orNot(student?.className) },
      { label: 'Section', value: orNot(student?.section) },
      { label: 'Roll no', value: orNot(student?.rollNumber) },
      { label: 'DOB', value: formatCardDate(student?.dob) },
    ],
    backRows: [
      { label: 'School Name', value: s.schoolName },
      { label: "Father's Name", value: orNot(clean(student?.fatherName) || clean(student?.parentName)) },
      { label: 'Mobile', value: orNot(mobile) },
      { label: 'Address', value: orNot(student?.address) },
    ],
    qrToken: clean(qrToken) || undefined,
  };
}
