import { buildStudentSections, buildStaffSections, maskAadhaar, isHostelResident, listDocuments, isTeachingStaff, NOT_RECORDED } from '../src/utils/profileSections';
let passed = 0, failed = 0;
const ok = (d: string, c: boolean) => { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.error(`  ❌ ${d}`); } };
const find = (secs: any[], k: string, label: string) => secs.find((s) => s.key === k)?.rows.find((r: any) => r.label === label)?.value;

const stu = { name: 'Aarav', dob: '2016-04-02', aadhaarNumber: '123456789012', className: 'Class 1', section: 'A', hostelRequired: true, hostelStatus: 'ACTIVE', hostelName: 'Boys Hostel', fatherName: 'Ramesh', fatherMobile: '9999999999', address: 'Main Rd', city: 'Sheohar', pincode: '843329' };
const s = buildStudentSections(stu);
ok('aadhaar is masked to the last 4 digits', find(s, 'personal', 'Aadhaar') === 'XXXX XXXX 9012' && !JSON.stringify(s).includes('123456789012'));
ok('missing values read "Not recorded"', find(s, 'personal', 'Blood group') === NOT_RECORDED && find(s, 'class', 'Roll no.') === NOT_RECORDED);
ok('address joined from parts', find(s, 'contact', 'Address') === 'Main Rd, Sheohar, 843329');
ok('hostel section only for residents', s.some((x) => x.key === 'hostel') && !buildStudentSections({ ...stu, hostelStatus: 'VACATED' }).some((x) => x.key === 'hostel'));
ok('hostel resident rule', isHostelResident(stu) && !isHostelResident({}) && !isHostelResident({ hostelRequired: true, hostelStatus: 'VACATED' }));
ok('invalid aadhaar → not recorded', maskAadhaar('12') === NOT_RECORDED && maskAadhaar(undefined) === NOT_RECORDED);
ok('dates formatted', /2016/.test(find(s, 'personal', 'Date of birth')));

const staff = { employeeId: 'CPS0014', name: 'T', designation: 'Maths Teacher', department: 'ACADEMICS', status: 'ACTIVE', bankAccountNo: '1234567890', ifscCode: 'SBIN0001', monthlySalary: 25000, subjects: ['Maths'] };
const a = buildStaffSections(staff, { canSeeFinancial: false });
const b = buildStaffSections(staff, { canSeeFinancial: true });
ok('no bank / salary section without payroll permission', !a.some((x) => x.key === 'bank') && !JSON.stringify(a).includes('1234567890') && !JSON.stringify(a).includes('25,000'));
ok('financial section masks the account number', find(b, 'bank', 'Account no.') === '••••7890' && find(b, 'bank', 'Monthly salary') === '₹25,000');
ok('teaching classification', isTeachingStaff(staff) && !isTeachingStaff({ designation: 'Accountant', role: 'ACCOUNTANT' }) && find(a, 'job', 'Type') === 'Teaching');
ok('documents list merges both arrays', listDocuments({ documents: [{ id: 'd1', title: 'TC', verificationStatus: 'VERIFIED' }], attachedDocuments: [{ fileKey: 'k', name: 'Aadhaar' }] }).length === 2);
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
