import mongoose, { Schema } from 'mongoose';

const AttachedDocumentSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    fileKey: { type: String, required: true },
    originalFileName: { type: String, required: true },
    contentType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedAt: { type: String, required: true },
    documentType: {
      type: String,
      default: 'OTHER',
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
    },
    verifiedBy: { type: String },
    verifiedAt: { type: String },
    verificationRemark: { type: String },
  },
  { _id: false }
);

const StudentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    schoolId: { type: String },
    admissionNumber: { type: String, required: true, unique: true, index: true, trim: true },
    registrationNumber: { type: String, unique: true, sparse: true, index: true, trim: true },
    rollNumber: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    firstName: { type: String, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    photo: { type: String },
    photoFileKey: { type: String },
    documents: [AttachedDocumentSchema],
    dob: { type: String, required: true },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], required: true },
    bloodGroup: { type: String },
    aadhaarNumber: { type: String, sparse: true, index: true },
    apaarId: { type: String },
    fatherAadhaar: { type: String },
    motherAadhaar: { type: String },
    category: {
      type: String,
      enum: ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'],
      default: 'GENERAL',
    },
    religion: { type: String },
    address: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    mobile: { type: String, required: true, index: true },
    email: { type: String, lowercase: true, trim: true, sparse: true, index: true },
    admissionDate: { type: String, required: true },
    enrollmentDate: { type: String },
    feeStartDate: { type: String },
    portalEntryDate: { type: String },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    section: { type: String, required: true, index: true },
    academicSession: { type: String, required: true, index: true },
    status: {
      type: String,
      default: 'ACTIVE',
      index: true,
    },
    // Parent info
    parentName: { type: String, required: true },
    fatherName: { type: String },
    motherName: { type: String },
    guardianName: { type: String },
    parentPhone: { type: String, required: true, index: true },
    fatherMobile: { type: String },
    motherMobile: { type: String },
    guardianMobile: { type: String },
    parentEmail: { type: String },
    fatherEmail: { type: String },
    motherEmail: { type: String },
    parentOccupation: { type: String },
    fatherOccupation: { type: String },
    motherOccupation: { type: String },
    guardianRelationship: { type: String },
    // Emergency contact
    emergencyContact: { type: String },
    emergencyContactName: { type: String },
    emergencyRelationship: { type: String },
    secondaryEmergencyContact: { type: String },
    secondaryEmergencyName: { type: String },
    // Previous school
    previousSchool: { type: String },
    previousClassPassed: { type: String },
    previousClass: { type: String },
    previousMarks: { type: String },
    previousSession: { type: String },
    // Hostel
    hostelRequired: { type: Boolean, default: false },
    hostelId: { type: String, ref: 'Hostel' },
    hostelRoomId: { type: String, ref: 'HostelRoom' },
    hostelFloor: { type: Number },
    hostelBedNumber: { type: String },
    hostelName: { type: String },
    hostelWarden: { type: String },
    hostelAllocationDate: { type: String },
    hostelStatus: { type: String, enum: ['ACTIVE', 'VACATED'], default: 'ACTIVE' },
    hostelMonthlyFee: { type: Number },
    messMonthlyFee: { type: Number },
    // Transport
    transportRequired: { type: Boolean, default: false },
    transportRouteId: { type: String, ref: 'TransportRoute' },
    transportStopName: { type: String },
    transportStopId: { type: String },
    transportSlabId: { type: String, ref: 'TransportSlab' },
    transportDistanceKm: { type: Number },
    transportMonthlyFee: { type: Number },
    pickupPoint: { type: String },
    vehicleNumber: { type: String },
    driverName: { type: String },
    driverContact: { type: String },
    // Extra options
    dressCodeSelected: { type: Boolean, default: false },
    booksSelected: { type: Boolean, default: false },
    // Medical & Special care
    identificationMark: { type: String },
    allergies: { type: String },
    medicalConditions: { type: String },
    medications: { type: String },
    doctorName: { type: String },
    doctorContact: { type: String },
    specialMedicalInstructions: { type: String },
    // Histories
    academicHistory: [Schema.Types.Mixed],
    activityHistory: [Schema.Types.Mixed],
    // Portal Auth
    loginEnabled: { type: Boolean, default: true },
    accountStatus: { type: String, default: 'ACTIVE' },
    passwordHash: { type: String },
    lastLoginAt: { type: String },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Number },
    passwordResetToken: { type: String },
    passwordResetTokenHash: { type: String },
    passwordResetExpires: { type: Number },
    // Fee Profile
    feeProfile: { type: Schema.Types.Mixed },
    // Admission workflow
    admittedBy: { type: String },
    admissionLetterEmail: { type: Schema.Types.Mixed }, // last admission-letter email: status, time, provider message id
  },
  {
    timestamps: true,
    collection: 'students',
  }
);

StudentSchema.index({ classId: 1, section: 1, rollNumber: 1 });
StudentSchema.index({ academicSession: 1, status: 1 });

export const StudentModel: mongoose.Model<any> = mongoose.models.Student || mongoose.model('Student', StudentSchema);
