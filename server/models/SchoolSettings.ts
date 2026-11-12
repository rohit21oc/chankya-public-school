import mongoose, { Schema, Document } from 'mongoose';
import { SchoolSettings, AcademicSession, GradeDefinition } from '../../src/types/index.ts';

export interface SchoolSettingsDoc extends Document, Omit<SchoolSettings, 'gradingSystem' | 'academicSessions'> {
  gradingSystem: GradeDefinition[];
  academicSessions?: AcademicSession[];
  paymentOptions?: any;
  singleSchool: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolPaymentDetailsSchema = new Schema(
  {
    accountHolderName: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    branch: { type: String, default: '' },
    upiId: { type: String, default: '' },
    upiQrCode: { type: String, default: '' },
    upiQrCodeFileKey: { type: String, default: '' },
    instructions: { type: String, default: '' },
  },
  { _id: false }
);

const GradeDefinitionSchema = new Schema(
  {
    id: { type: String },
    grade: { type: String, required: true },
    minPercentage: { type: Number, required: true },
    maxPercentage: { type: Number, required: true },
    gradePoint: { type: Number, required: true },
    status: { type: String, enum: ['PASS', 'FAIL'], default: 'PASS' },
    description: { type: String, default: '' },
    academicSession: { type: String },
  },
  { _id: false }
);

const AcademicSessionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' },
    description: { type: String },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { _id: false }
);

const SchoolSettingsSchema = new Schema<SchoolSettingsDoc>(
  {
    singleSchool: { type: Boolean, default: true, unique: true },
    schoolName: { type: String, required: true, trim: true },
    schoolCode: { type: String, required: true, trim: true },
    affiliationNumber: { type: String, required: true, trim: true },
    affiliationCode: { type: String, trim: true },
    affiliatedBoard: { type: String, default: 'CBSE' },
    classesOffered: { type: String },
    headerContacts: [{ type: String }],
    footerContacts: [{ type: String }],
    helplineNumber: { type: String },
    schoolLogo: { type: String, default: '' },
    logoFileKey: { type: String },
    principalSignature: { type: String, default: '' },
    principalSignatureFileKey: { type: String },
    schoolAddress: { type: String, required: true },
    additionalAddress: { type: String },
    principalName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true },
    website: { type: String, default: '' },
    registrationNumber: { type: String, default: '' },
    currentAcademicSession: { type: String, default: '2026-2027' },
    currentSession: { type: String },
    academicSessions: [AcademicSessionSchema],
    schoolStartTime: { type: String },
    schoolEndTime: { type: String },
    timetableDays: [{ type: String }],
    schoolTiming: {
      startTime: { type: String, default: '08:00 AM' },
      endTime: { type: String, default: '02:00 PM' },
    },
    workingDays: [{ type: String }],
    gradingSystem: [GradeDefinitionSchema],
    plusCode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    googleMapsUrl: { type: String },
    paymentOptions: { type: SchoolPaymentDetailsSchema, default: () => ({}) },
    bankDetails: { type: SchoolPaymentDetailsSchema, default: () => ({}) },
    customExamTypes: [{ type: String }],
    // Mobile app "new update" popup: the app compares its own build number with latestVersionCode.
    mobileAppUpdate: {
      latestVersionCode: { type: Number },
      latestVersionName: { type: String },
      minVersionCode: { type: Number },
      message: { type: String },
      storeUrl: { type: String },
    },
    feeSettings: {
      lateFeeAmount: { type: Number, default: 50 },
      dueDayOfMonth: { type: Number, default: 10 },
      lateFeeStartDay: { type: Number, default: 11 },
    },
  },
  {
    timestamps: true,
    collection: 'school_settings',
  }
);

export const SchoolSettingsModel: mongoose.Model<any> =
  mongoose.models.SchoolSettings || mongoose.model('SchoolSettings', SchoolSettingsSchema);
