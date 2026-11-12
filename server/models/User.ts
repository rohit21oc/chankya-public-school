import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../../src/types/index.ts';

export interface UserDoc extends Document {
  id: string;
  username?: string;
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  dob?: string;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  fatherOrMotherName?: string;
  role: UserRole;
  permissions?: string[];
  deniedPermissions?: string[];
  passwordHash: string;
  employeeId?: string;
  studentId?: string;
  linkedStudentIds?: string[];
  activeStudentId?: string;
  avatar?: string;
  photo?: string;
  photoFileKey?: string;
  address?: string;
  permanentAddress?: string;
  currentAddress?: string;
  city?: string;
  permanentCity?: string;
  currentCity?: string;
  state?: string;
  permanentState?: string;
  currentState?: string;
  pincode?: string;
  permanentPincode?: string;
  currentPincode?: string;
  sameAsPermanentAddress?: boolean;
  qualification?: string;
  customQualification?: string;
  designation?: string;
  department?: string;
  customDepartment?: string;
  employmentType?: string;
  totalExperience?: string;
  experienceYears?: number;
  teachingWorkload?: number;
  classTeacherOf?: string;
  assignedPrimarySubject?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  houseClubResponsibility?: string;
  certifications?: string;
  documents?: any[];
  bankAccountNo?: string;
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;
  panNumber?: string;
  uanNumber?: string;
  salary?: any;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  loginEnabled: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  passwordResetToken?: string;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  userType: 'ADMIN' | 'STAFF' | 'STUDENT' | 'PARENT';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    username: { type: String, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    alternatePhone: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    bloodGroup: { type: String, trim: true },
    dob: { type: String },
    gender: { type: String },
    fatherName: { type: String, trim: true },
    motherName: { type: String, trim: true },
    fatherOrMotherName: { type: String, trim: true },
    role: {
      type: String,
      required: true,
      enum: [
        'SUPER_ADMIN',
        'SCHOOL_ADMIN',
        'PRINCIPAL',
        'ACCOUNTANT',
        'TEACHER',
        'HOSTEL_WARDEN',
        'TRANSPORT_MANAGER',
        'HR_STAFF',
        'ACADEMIC_COORDINATOR',
        'VICE_PRINCIPAL',
        'PARENT',
        'STUDENT',
      ],
      index: true,
    },
    permissions: [{ type: String }],
    deniedPermissions: [{ type: String }],
    passwordHash: { type: String, required: true },
    employeeId: { type: String, index: true },
    studentId: { type: String, index: true },
    linkedStudentIds: [{ type: String }],
    activeStudentId: { type: String },
    avatar: { type: String },
    photo: { type: String },
    photoFileKey: { type: String },
    address: { type: String },
    permanentAddress: { type: String },
    currentAddress: { type: String },
    city: { type: String },
    permanentCity: { type: String },
    currentCity: { type: String },
    state: { type: String },
    permanentState: { type: String },
    currentState: { type: String },
    pincode: { type: String },
    permanentPincode: { type: String },
    currentPincode: { type: String },
    sameAsPermanentAddress: { type: Boolean, default: false },
    qualification: { type: String },
    customQualification: { type: String },
    designation: { type: String },
    department: { type: String },
    customDepartment: { type: String },
    employmentType: { type: String },
    totalExperience: { type: String },
    experienceYears: { type: Number, default: 0 },
    teachingWorkload: { type: Number },
    classTeacherOf: { type: String },
    assignedPrimarySubject: { type: String },
    assignedClasses: [{ type: String }],
    assignedSubjects: [{ type: String }],
    houseClubResponsibility: { type: String },
    certifications: { type: String },
    documents: [Schema.Types.Mixed],
    bankAccountNo: { type: String },
    bankName: { type: String },
    bankBranch: { type: String },
    ifscCode: { type: String },
    panNumber: { type: String },
    uanNumber: { type: String },
    salary: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    loginEnabled: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
    passwordResetToken: { type: String },
    passwordResetTokenHash: { type: String },
    passwordResetExpires: { type: Date },
    lastLoginAt: { type: Date },
    userType: {
      type: String,
      enum: ['ADMIN', 'STAFF', 'STUDENT', 'PARENT'],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: false,
    collection: 'users',
  }
);

UserSchema.index({ email: 1, userType: 1 });
UserSchema.index({ phone: 1, userType: 1 });

export const UserModel: mongoose.Model<any> = mongoose.models.User || mongoose.model('User', UserSchema);
