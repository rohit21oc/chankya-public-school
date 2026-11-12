import mongoose, { Schema } from 'mongoose';

const StaffLeaveSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, uppercase: true, trim: true, index: true },
    leaveType: {
      type: String,
      enum: ['CASUAL', 'SICK', 'MATERNITY', 'EARNED', 'DUTY', 'OTHER', 'UNPAID', 'LWP'],
      required: true,
      default: 'CASUAL',
    },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    daysCount: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    appliedAt: { type: String, required: true },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: String },
    remarks: { type: String, trim: true },
    document: { type: String, trim: true },
    documentName: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'staff_leaves',
  }
);

export const StaffLeaveModel: mongoose.Model<any> =
  mongoose.models.StaffLeave || mongoose.model('StaffLeave', StaffLeaveSchema);
