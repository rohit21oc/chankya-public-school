/**
 * Comprehensive Institutional Constants for Faculty & Staff Registration & Profile Management
 * Residential PDS Public School Sheohar
 */

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const INDIAN_UNION_TERRITORIES: string[] = [
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const ALL_INDIAN_STATES_AND_UTS: string[] = [
  ...INDIAN_STATES,
  ...INDIAN_UNION_TERRITORIES,
];

export const BIHAR_DISTRICTS: string[] = [
  'Araria',
  'Arwal',
  'Aurangabad',
  'Banka',
  'Begusarai',
  'Bhagalpur',
  'Bhojpur',
  'Buxar',
  'Darbhanga',
  'East Champaran',
  'Gaya',
  'Gopalganj',
  'Jamui',
  'Jehanabad',
  'Kaimur',
  'Katihar',
  'Khagaria',
  'Kishanganj',
  'Lakhisarai',
  'Madhepura',
  'Madhubani',
  'Munger',
  'Muzaffarpur',
  'Nalanda',
  'Nawada',
  'Patna',
  'Purnia',
  'Rohtas',
  'Saharsa',
  'Samastipur',
  'Saran',
  'Sheikhpura',
  'Sheohar',
  'Sitamarhi',
  'Siwan',
  'Supaul',
  'Vaishali',
  'West Champaran',
];

export const DEFAULT_BIHAR_DISTRICT = 'Sheohar';

/**
 * Common major districts/cities for neighboring and prominent Indian States
 * For state-aware city dropdown with manual fallback.
 */
export const STATE_POPULAR_DISTRICTS: Record<string, string[]> = {
  Jharkhand: [
    'Ranchi',
    'Jamshedpur',
    'Dhanbad',
    'Bokaro',
    'Deoghar',
    'Hazaribagh',
    'Giridih',
    'Ramgarh',
    'Dumka',
    'Chaibasa',
    'Palamu',
  ],
  'Uttar Pradesh': [
    'Lucknow',
    'Varanasi',
    'Gorakhpur',
    'Kanpur',
    'Prayagraj',
    'Agra',
    'Noida',
    'Ghaziabad',
    'Meerut',
    'Ballia',
    'Deoria',
    'Ayodhya',
  ],
  'West Bengal': [
    'Kolkata',
    'Howrah',
    'Siliguri',
    'Durgapur',
    'Asansol',
    'Kharagpur',
    'Malda',
    'Bardhaman',
  ],
  Delhi: [
    'Central Delhi',
    'East Delhi',
    'New Delhi',
    'North Delhi',
    'North East Delhi',
    'North West Delhi',
    'South Delhi',
    'South East Delhi',
    'South West Delhi',
    'West Delhi',
  ],
};

export const HIGHEST_ACADEMIC_QUALIFICATIONS: string[] = [
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

export const DEPARTMENT_WING_OPTIONS: string[] = [
  'Primary Wing',
  'Middle Wing',
  'Senior Wing',
  'Science Department',
  'Mathematics Department',
  'Humanities Department',
  'Commerce Department',
  'Computer Science / IT',
  'Languages',
  'Physical Education / Sports',
  'Arts & Culture / Music',
  'Administration',
  'Accounts & Finance',
  'Hostel Administration',
  'Transport Operations',
  'Library',
  'Examination Cell',
  'Support Services',
  'Other',
];

export const CERTIFICATION_OPTIONS: string[] = [
  'CTET Paper 1',
  'CTET Paper 2',
  'STET Paper 1',
  'STET Paper 2',
  'BTET (Bihar TET)',
  'CBSE Continuous Professional Development (CPD)',
  'NEP 2020 Pedagogical Training',
  'Cambridge CELTA / TESOL / TEFL',
  'Early Childhood Care & Education (ECCE)',
  'Montessori Certified',
  'Special Education (RCI Recognized)',
  'CBSE Capacity Building Programme (CBP)',
  'ICT in Education / Digital Pedagogy Certified',
  'First Aid & Emergency Response Certified',
  'Sports Coaching / NIS Certified',
  'Yoga Certification Board (YCB) Certified',
  'NCC / Scouting & Guiding Certified',
  'Other',
];

export const HOUSE_CLUB_OPTIONS: string[] = [
  'Ganga House (Red)',
  'Yamuna House (Blue)',
  'Saraswati House (Green)',
  'Kaveri House (Yellow)',
  'Tagore House',
  'Raman House',
  'Ashoka House',
  'Shivaji House',
  'Science & Innovation Club',
  'Mathematics Club',
  'Literary & Debate Society',
  'Eco / Nature & Green Club',
  'IT & Robotics Club',
  'Art & Craft / Creative Club',
  'Music & Cultural Club',
  'Sports & Athletics Club',
  'Drama & Theatre Club',
  'Photography & Media Club',
  'Social Service & Interact Club',
  'Health & Wellness Club',
  'Disaster Management / First Aid Club',
  'Other',
];

export const STAFF_DOCUMENT_TYPES = [
  { id: 'AADHAAR', label: 'Aadhaar / National ID Proof' },
  { id: 'QUALIFICATION', label: 'Qualification Degree / Marksheet' },
  { id: 'EXPERIENCE', label: 'Teaching / Work Experience Certificate' },
  { id: 'APPOINTMENT', label: 'Official Joining / Appointment Letter' },
  { id: 'BED_CTET', label: 'B.Ed / CTET / Eligibility Certificate' },
  { id: 'RELIEVING', label: 'Relieving / Transfer Certificate' },
  { id: 'POLICE_VERIFICATION', label: 'Character / Background Verification' },
  { id: 'OTHER', label: 'Other Official Document' },
];

/**
 * Resolves default department suggestion based on selected portal role
 */
export function getDefaultDepartmentForRole(role: string): string {
  switch (role) {
    case 'ACCOUNTANT':
      return 'Accounts & Finance';
    case 'HOSTEL_WARDEN':
      return 'Hostel Administration';
    case 'TRANSPORT_MANAGER':
      return 'Transport Operations';
    case 'HR_STAFF':
    case 'SCHOOL_ADMIN':
    case 'SUPER_ADMIN':
      return 'Administration';
    case 'ACADEMIC_COORDINATOR':
      return 'Examination Cell';
    case 'SUPPORT_STAFF':
      return 'Support Services';
    case 'PRINCIPAL':
    case 'VICE_PRINCIPAL':
      return 'Senior Wing';
    case 'TEACHER':
    default:
      return 'Senior Wing';
  }
}
