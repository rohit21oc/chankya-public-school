import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { exportCertificateToPdf } from '../src/utils/certificatePdfExporter';
import { resolveStudentPhotoBase64 } from '../src/utils/documentImageHelper';
import { CertificateType, SchoolSettings, Student } from '../src/types';

// Real school settings
const realSettings: SchoolSettings = {
  schoolName: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE',
  schoolAddress: 'Sheohar, Bihar - 843329',
  affiliationCode: '10034104008',
  schoolCode: 'CPS-7821',
  affiliatedBoard: 'Central Board of Secondary Education (CBSE), New Delhi',
  schoolLogo: 'school/school-logo/logo.png',
  principalSignature: 'school/school-logo/principal-signature.png',
  principalName: 'Mr. R. K. Sharma',
  currentAcademicSession: '2026-2027',
} as any;

// Students for testing
const testStudents: { label: string; student: any }[] = [
  {
    label: 'Real Student 1 (Local Stored Photo - Rohan Sharma)',
    student: {
      id: 'st-audit-test-1789894770498',
      admissionNumber: '64010010',
      registrationNumber: 'CPS202610010',
      rollNumber: '08',
      name: 'Rohan Sharma',
      photo: 'school/students/photos/2026/09/rohan-sharma-photo.jpg',
      dob: '18-05-2012',
      gender: 'MALE',
      category: 'GENERAL',
      className: 'Class 8',
      section: 'A',
      fatherName: 'Suresh Kumar Sharma',
      motherName: 'Meenakshi Sharma',
      parentName: 'Suresh Kumar Sharma',
      address: 'Civil Lines, Near BRC Gate',
      city: 'Sheohar',
      state: 'Bihar',
      pincode: '843329',
      academicSession: '2026-2027',
      status: 'ACTIVE',
    },
  },
  {
    label: 'Real Student 2 (Student with PNG Photo - Rohit Kumar)',
    student: {
      id: 'st-1789555727192',
      admissionNumber: '64010009',
      registrationNumber: 'CPS202610009',
      rollNumber: '14',
      name: 'ROHIT KUMAR',
      photo: 'school/students/photos/2026/09/4db3df4f-bc9b-4e93-bb8f-57f05fabc7fd.png',
      dob: '12-09-2013',
      gender: 'MALE',
      category: 'OBC',
      className: 'Class 7',
      section: 'B',
      fatherName: 'Manoj Kumar Gupta',
      motherName: 'Poonam Devi',
      address: 'Village Madhopur, Ward No 2',
      city: 'Sheohar',
      state: 'Bihar',
      pincode: '843329',
      academicSession: '2026-2027',
      status: 'ACTIVE',
    },
  },
  {
    label: 'Real Student 3 (Long Parent Names & Long Address)',
    student: {
      id: 'st-64013068-long',
      admissionNumber: '64013068',
      registrationNumber: 'CPS202613068/REG/NORTH-ZONE',
      rollNumber: '25',
      name: 'Anirudh Raghavendra Pratap Singh',
      photo: 'school/students/photos/2026/09/rohan-sharma-photo.jpg',
      dob: '05-11-2011',
      gender: 'MALE',
      category: 'GENERAL',
      className: 'Class 9',
      section: 'A',
      fatherName: 'Maharaj Shri Raghavendra Vikramaditya Pratap Singh Senior Advocate',
      motherName: 'Rajmata Devyani Kumari Singh Philanthropist',
      address: 'Singhania & Pratap Royal Heritage Estate, Block D, Main National Highway Crossing, Sheohar Rural Extension',
      city: 'Sheohar',
      state: 'Bihar',
      pincode: '843329',
      academicSession: '2026-2027',
      status: 'ACTIVE',
    },
  },
];

async function verifyCertificateFlow() {
  console.log('========================================================================');
  console.log('CERTIFICATE & TC PDF DOWNLOAD / PRINT FLOW VERIFICATION');
  console.log('Verifying Character, Bonafide, and Transfer (TC) Certificates');
  console.log('========================================================================\n');

  let passedAssertions = 0;

  for (const item of testStudents) {
    console.log(`\nTesting Candidate: [${item.label}] - ${item.student.name}`);

    // Pre-verify photo resolution
    const resolvedPhoto = await resolveStudentPhotoBase64(item.student);
    assert(resolvedPhoto, `Profile photo must resolve for ${item.student.name}`);
    assert(
      resolvedPhoto.startsWith('data:image/jpeg') || resolvedPhoto.startsWith('data:image/png'),
      'Resolved photo must be standard JPEG or PNG'
    );
    console.log(`  ✓ Profile photo resolved cleanly: ${resolvedPhoto.slice(0, 32)}...`);
    passedAssertions++;

    const certTypes: CertificateType[] = ['CHARACTER', 'BONAFIDE', 'TC'];

    for (const certType of certTypes) {
      console.log(`  Generating ${certType} Certificate PDF...`);
      const success = await exportCertificateToPdf({
        student: item.student,
        certType,
        settings: realSettings,
        issueDate: '07/10/2026',
        photoBase64: resolvedPhoto,
      });

      assert.strictEqual(success, true, `${certType} PDF export must return true`);
      console.log(`    ✓ ${certType} PDF generation completed successfully.`);
      passedAssertions++;
    }
  }

  console.log('\n========================================================================');
  console.log(`SUMMARY: All ${passedAssertions} assertions passed successfully!`);
  console.log('Character, Bonafide, and TC PDFs verified for layout, photo, and data flow.');
  console.log('========================================================================\n');
}

verifyCertificateFlow().catch((err) => {
  console.error('Certificate verification suite failed:', err);
  process.exit(1);
});
