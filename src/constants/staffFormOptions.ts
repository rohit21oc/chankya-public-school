import { PortalStaffRole } from './staffRoles';

/**
 * HIGHEST ACADEMIC QUALIFICATION OPTIONS
 */
export const ACADEMIC_QUALIFICATIONS: string[] = [
  '10th / Matriculation',
  '12th / Intermediate',
  'ITI',
  'Diploma',
  'BA',
  'BSc',
  'BCom',
  'BBA',
  'BCA',
  'BTech',
  'BE',
  'LLB',
  'MBBS',
  'BEd',
  'Other Undergraduate Degree',
  'MA',
  'MSc',
  'MCom',
  'MBA',
  'MCA',
  'MTech',
  'ME',
  'MEd',
  'LLM',
  'PhD',
  'Other Postgraduate / Doctoral Qualification',
  'Other',
];

/**
 * SCHOOL DEPARTMENTS & WINGS
 */
export const SCHOOL_DEPARTMENTS: string[] = [
  'Academics',
  'Administration',
  'Accounts & Finance',
  'Human Resources',
  'Primary Section',
  'Middle Section',
  'Secondary Section',
  'Senior Secondary Section',
  'Examination',
  'Student Affairs',
  'Hostel',
  'Transport',
  'Library',
  'Laboratory',
  'Sports & Physical Education',
  'IT / Computer',
  'Admissions',
  'Office',
  'Other',
];

/**
 * Filter / prioritize departments according to portal role
 */
export function getDepartmentsForRole(role: PortalStaffRole): string[] {
  switch (role) {
    case 'ACCOUNTANT':
      return [
        'Accounts & Finance',
        'Administration',
        'Office',
        'Admissions',
        'Other',
      ];
    case 'HR_STAFF':
      return [
        'Human Resources',
        'Administration',
        'Office',
        'Other',
      ];
    case 'HOSTEL_WARDEN':
      return [
        'Hostel',
        'Student Affairs',
        'Administration',
        'Other',
      ];
    case 'TRANSPORT_MANAGER':
      return [
        'Transport',
        'Administration',
        'Office',
        'Other',
      ];
    case 'TEACHER':
    case 'PRINCIPAL':
    case 'VICE_PRINCIPAL':
    case 'ACADEMIC_COORDINATOR':
      return [
        'Academics',
        'Primary Section',
        'Middle Section',
        'Secondary Section',
        'Senior Secondary Section',
        'Examination',
        'Student Affairs',
        'Sports & Physical Education',
        'IT / Computer',
        'Library',
        'Laboratory',
        'Administration',
        'Other',
      ];
    case 'SCHOOL_ADMIN':
    case 'SUPER_ADMIN':
    default:
      return SCHOOL_DEPARTMENTS;
  }
}

/**
 * Get default department for a role
 */
export function getDefaultDepartmentForRole(role: PortalStaffRole): string {
  switch (role) {
    case 'ACCOUNTANT':
      return 'Accounts & Finance';
    case 'HR_STAFF':
      return 'Human Resources';
    case 'HOSTEL_WARDEN':
      return 'Hostel';
    case 'TRANSPORT_MANAGER':
      return 'Transport';
    case 'SCHOOL_ADMIN':
    case 'SUPER_ADMIN':
      return 'Administration';
    case 'TEACHER':
    case 'PRINCIPAL':
    case 'VICE_PRINCIPAL':
    case 'ACADEMIC_COORDINATOR':
    default:
      return 'Academics';
  }
}

/**
 * CERTIFICATIONS & ADDITIONAL CREDENTIALS
 */
export const CERTIFICATION_OPTIONS: string[] = [
  'CTET',
  'STET',
  'TET',
  'BEd',
  'DElEd',
  'Diploma in Education',
  'NET',
  'SET',
  'PhD',
  'Computer Certification',
  'First Aid Certification',
  'Sports Certification',
  'NCC',
  'Scout & Guide',
  'NIS / Sports Qualification',
  'Other',
];

/**
 * HOUSES & CLUBS
 */
export const SCHOOL_HOUSES: string[] = [
  'Red House',
  'Blue House',
  'Green House',
  'Yellow House',
];

export const SCHOOL_CLUBS: string[] = [
  'Science Club',
  'Mathematics Club',
  'Literary Club',
  'English Club',
  'Hindi Club',
  'Computer / IT Club',
  'Robotics & AI Club',
  'Eco Club',
  'Cultural Club',
  'Art & Craft Club',
  'Music Club',
  'Sports Club',
  'Quiz Club',
  'Debate Club',
  'Reading Club',
  'Health & Wellness Club',
];

export const ALL_HOUSE_CLUB_OPTIONS: { category: string; options: string[] }[] = [
  { category: 'School Houses', options: SCHOOL_HOUSES },
  { category: 'Co-Curricular Clubs', options: SCHOOL_CLUBS },
  { category: 'Other', options: ['No House / Club Responsibility', 'Other'] },
];

/**
 * STAFF DOCUMENT TYPES
 */
export const STAFF_DOCUMENT_TYPES: { id: string; label: string }[] = [
  { id: 'AADHAAR', label: 'Aadhaar / ID Proof' },
  { id: 'PAN_CARD', label: 'PAN Card' },
  { id: '10TH_CERTIFICATE', label: '10th Certificate' },
  { id: '12TH_CERTIFICATE', label: '12th Certificate' },
  { id: 'GRADUATION', label: 'Graduation Certificate' },
  { id: 'POST_GRADUATION', label: 'Post-Graduation Certificate' },
  { id: 'BED_DELED', label: 'BEd / DElEd Certificate' },
  { id: 'PROFESSIONAL_QUAL', label: 'Professional Qualification' },
  { id: 'EXPERIENCE', label: 'Experience Certificate' },
  { id: 'CTET_STET_TET', label: 'CTET / STET / TET Certificate' },
  { id: 'APPOINTMENT', label: 'Joining / Appointment Letter' },
  { id: 'MEDICAL', label: 'Medical Certificate' },
  { id: 'POLICE_VERIFICATION', label: 'Police Verification' },
  { id: 'OTHER', label: 'Other' },
];
