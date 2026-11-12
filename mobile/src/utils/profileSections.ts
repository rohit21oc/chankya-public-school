/**
 * Pure builders that turn raw student / staff records into labelled profile sections.
 * A missing value is shown as "Not recorded"; nothing is guessed or defaulted.
 */
export const NOT_RECORDED = 'Not recorded';

export interface ProfileRow { label: string; value: string }
export interface ProfileSection { key: string; title: string; rows: ProfileRow[] }

const clean = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(clean).filter(Boolean).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v).trim();
};
const val = (v: any): string => clean(v) || NOT_RECORDED;
const row = (label: string, v: any): ProfileRow => ({ label, value: val(v) });

export const maskAadhaar = (v?: string): string => {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : NOT_RECORDED;
};

export const formatDate = (v?: string): string => {
  const s = String(v || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return clean(v) || NOT_RECORDED;
  return new Date(`${s}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const isHostelResident = (s: any): boolean => !!s?.hostelRequired && s?.hostelStatus !== 'VACATED';

const joinAddress = (s: any): string =>
  clean([s.address, s.city, s.state, s.pincode].map(clean).filter(Boolean).join(', '));

export function buildStudentSections(s: any): ProfileSection[] {
  const sections: ProfileSection[] = [
    {
      key: 'personal',
      title: 'Personal details',
      rows: [
        row('Full name', s.name),
        row('Date of birth', s.dob ? formatDate(s.dob) : ''),
        row('Gender', s.gender),
        row('Blood group', s.bloodGroup),
        row('Category', s.category),
        row('Religion', s.religion),
        { label: 'Aadhaar', value: maskAadhaar(s.aadhaarNumber) },
        row('Identification mark', s.identificationMark),
      ],
    },
    {
      key: 'class',
      title: 'Class & admission',
      rows: [
        row('Admission no.', s.admissionNumber),
        row('Registration no.', s.registrationNumber),
        row('Class', s.className),
        row('Section', s.section),
        row('Roll no.', s.rollNumber),
        row('Academic session', s.academicSession),
        row('Admission date', s.admissionDate ? formatDate(s.admissionDate) : ''),
        row('Status', s.status),
        row('Previous school', s.previousSchool),
        row('Previous class', s.previousClassPassed || s.previousClass),
      ],
    },
    {
      key: 'guardian',
      title: 'Parent / guardian',
      rows: [
        row('Father', s.fatherName || s.parentName),
        row('Father mobile', s.fatherMobile || s.parentPhone),
        row('Father occupation', s.fatherOccupation || s.parentOccupation),
        row('Mother', s.motherName),
        row('Mother mobile', s.motherMobile),
        row('Guardian', s.guardianName),
        row('Guardian mobile', s.guardianMobile),
        row('Emergency contact', [s.emergencyContactName, s.emergencyContact].map(clean).filter(Boolean).join(' • ')),
        row('Parent email', s.parentEmail || s.fatherEmail),
      ],
    },
    {
      key: 'contact',
      title: 'Address & contact',
      rows: [row('Address', joinAddress(s)), row('Student mobile', s.mobile), row('Email', s.email)],
    },
  ];
  if (isHostelResident(s)) {
    sections.push({
      key: 'hostel',
      title: 'Hostel',
      rows: [
        row('Hostel', s.hostelName),
        row('Floor', s.hostelFloor),
        row('Bed', s.hostelBedNumber),
        row('Warden', s.hostelWarden),
        row('Allocated on', s.hostelAllocationDate ? formatDate(s.hostelAllocationDate) : ''),
      ],
    });
  }
  if (s.transportRequired) {
    sections.push({
      key: 'transport',
      title: 'Transport',
      rows: [row('Pickup point', s.pickupPoint || s.transportStopName), row('Vehicle', s.vehicleNumber), row('Driver', s.driverName)],
    });
  }
  sections.push({
    key: 'medical',
    title: 'Health',
    rows: [row('Allergies', s.allergies), row('Medical conditions', s.medicalConditions), row('Doctor', s.doctorName)],
  });
  return sections;
}

export const STAFF_TEACHING_ROLES = ['TEACHER'];

export function isTeachingStaff(s: any): boolean {
  const des = String(s?.designation || '').toLowerCase();
  return s?.role === 'TEACHER' || s?.systemRole === 'TEACHER' || des.includes('teacher') || des.includes('faculty') || !!s?.alsoPerformsTeaching;
}

export function buildStaffSections(s: any, opts: { canSeeFinancial: boolean }): ProfileSection[] {
  const sections: ProfileSection[] = [
    {
      key: 'job',
      title: 'Employment',
      rows: [
        row('Employee ID', s.employeeId),
        row('Designation', s.designation),
        row('Department', s.department),
        row('Type', isTeachingStaff(s) ? 'Teaching' : 'Non-teaching'),
        row('Status', s.status),
        row('Joined', s.joiningDate ? formatDate(s.joiningDate) : ''),
        row('Qualification', s.qualification),
        row('Experience', s.experienceYears !== undefined && s.experienceYears !== '' ? `${s.experienceYears} years` : ''),
      ],
    },
    {
      key: 'personal',
      title: 'Personal details',
      rows: [
        row('Date of birth', s.dob ? formatDate(s.dob) : ''),
        row('Gender', s.gender),
        row('Blood group', s.bloodGroup),
        row("Father's / mother's name", s.fatherOrMotherName || s.fatherName || s.motherName),
        row('Emergency contact', s.emergencyContact),
      ],
    },
    {
      key: 'contact',
      title: 'Contact',
      rows: [
        row('Phone', s.phone),
        row('Alternate phone', s.alternatePhone),
        row('Email', s.email),
        row('Address', [s.currentAddress || s.address, s.currentCity || s.city, s.currentState || s.state, s.currentPincode || s.pincode].map(clean).filter(Boolean).join(', ')),
      ],
    },
    {
      key: 'teaching',
      title: 'Teaching',
      rows: [
        row('Subjects', s.subjects?.length ? s.subjects : s.assignedPrimarySubject),
        row('Class teacher of', s.classTeacherOf),
        row('Assigned classes', s.assignedClasses),
        row('Can teach classes', s.classesQualifiedToTeach || s.qualifiedClasses),
      ],
    },
  ];
  if (opts.canSeeFinancial) {
    const acct = String(s.bankAccountNo || '').replace(/\s/g, '');
    sections.push({
      key: 'bank',
      title: 'Bank & payroll (restricted)',
      rows: [
        row('Bank', s.bankName),
        row('Account no.', acct ? `••••${acct.slice(-4)}` : ''),
        row('IFSC', s.ifscCode),
        row('Monthly salary', typeof s.monthlySalary === 'number' ? `₹${s.monthlySalary.toLocaleString('en-IN')}` : ''),
      ],
    });
  }
  return sections;
}

export interface DocumentItem { key: string; title: string; type: string; status: string; fileKey?: string }
export function listDocuments(record: any): DocumentItem[] {
  const all = [...(Array.isArray(record?.documents) ? record.documents : []), ...(Array.isArray(record?.attachedDocuments) ? record.attachedDocuments : [])];
  return all
    .filter((d) => d && typeof d === 'object')
    .map((d: any, i: number) => ({
      key: String(d.id || d.fileKey || i),
      title: clean(d.title || d.originalFileName || d.name || d.documentType) || 'Document',
      type: clean(d.documentType || d.type),
      status: clean(d.verificationStatus),
      fileKey: clean(d.fileKey) || undefined,
    }));
}
