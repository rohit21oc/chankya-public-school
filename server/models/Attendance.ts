import mongoose, { Schema } from 'mongoose';

const AttendanceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    date: { type: String, required: true, index: true },
    classId: { type: String, ref: 'Class', required: true, index: true },
    section: { type: String, required: true, index: true },
    studentId: { type: String, ref: 'Student', required: true, index: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'EXCUSED', 'LEAVE', 'HOLIDAY'],
      index: true,
    },
    remarks: { type: String },
    markedBy: { type: String, ref: 'Staff' },
    markedAt: { type: String },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'attendance',
  }
);

AttendanceSchema.index({ classId: 1, section: 1, date: 1 });
AttendanceSchema.index({ studentId: 1, date: 1 });

const StaffAttendanceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    date: { type: String, required: true, index: true },
    staffId: { type: String, ref: 'Staff', required: true, index: true },
    staffName: { type: String, required: true },
    employeeId: { type: String, required: true, index: true },
    department: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'LEAVE', 'HOLIDAY', 'WEEK_OFF'],
      index: true,
    },
    checkInTime: { type: String },
    checkOutTime: { type: String },
    remarks: { type: String },
    markedBy: { type: String },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'staff_attendance',
  }
);

StaffAttendanceSchema.index({ staffId: 1, date: 1 });

export const AttendanceModel: mongoose.Model<any> =
  mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
export const StaffAttendanceModel: mongoose.Model<any> =
  mongoose.models.StaffAttendance || mongoose.model('StaffAttendance', StaffAttendanceSchema);
