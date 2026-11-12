import mongoose, { Schema } from 'mongoose';

/**
 * Leave applications for students. A student applies for themself, a parent for a
 * linked child, and an administrator can record leave for any student (optionally
 * already approved). Approval marks the working days as LEAVE in attendance.
 */
const StudentLeaveSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    admissionNumber: { type: String, trim: true, index: true },
    classId: { type: String, trim: true, index: true },
    className: { type: String, trim: true },
    section: { type: String, trim: true },
    leaveType: { type: String, enum: ['SICK', 'CASUAL', 'FAMILY', 'OTHER'], default: 'CASUAL' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    daysCount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING', index: true },
    appliedAt: { type: String, required: true },
    appliedById: { type: String },
    appliedByName: { type: String },
    appliedByRole: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: String },
    remarks: { type: String, trim: true },
  },
  { timestamps: true, collection: 'student_leaves' }
);

export const StudentLeaveModel: mongoose.Model<any> =
  mongoose.models.StudentLeave || mongoose.model('StudentLeave', StudentLeaveSchema);
