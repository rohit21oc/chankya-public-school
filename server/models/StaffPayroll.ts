import mongoose, { Schema } from 'mongoose';

const StaffPayrollSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, uppercase: true, trim: true, index: true },
    uanNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    month: { type: String, required: true, index: true }, // e.g. "September 2026"
    payrollMonth: { type: String, required: true, index: true }, // e.g. "2026-09"
    year: { type: Number, required: true, index: true },
    salaryPeriodStart: { type: String }, // e.g. "2026-09-01"
    salaryPeriodEnd: { type: String }, // e.g. "2026-09-30"

    // Salary Configuration & Rates
    monthlySalary: { type: Number, required: true, min: 0 },
    dailySalary: { type: Number, required: true, min: 0 }, // monthlySalary / 30
    workingDaysInMonth: { type: Number, default: 30 },

    // Attendance & Days breakdown
    presentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    approvedPaidLeaveDays: { type: Number, default: 0 },
    leaveDaysTaken: { type: Number, default: 0 },
    waivedLeaveDays: { type: Number, default: 0 },
    chargeableLeaveDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    weeklyOffDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    notMarkedDays: { type: Number, default: 0 }, // working days with no attendance mark

    // Deductions breakdown
    lateDeduction: { type: Number, default: 0 }, // (monthlySalary / 30) * 0.25 * lateDays
    unpaidLeaveDeduction: { type: Number, default: 0 }, // (monthlySalary / 30) * unpaidLeaveDays
    notMarkedDeduction: { type: Number, default: 0 }, // (monthlySalary / 30) * notMarkedDays
    notEmployedDays: { type: Number, default: 0 }, // days of the month before the salary start date
    notEmployedDeduction: { type: Number, default: 0 }, // monthlySalary * notEmployedDays / days in month
    otherDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },

    // Earnings
    basicSalary: { type: Number, default: 0 },
    allowances: {
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      ta: { type: Number, default: 0 },
      special: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    deductions: {
      pf: { type: Number, default: 0 },
      tds: { type: Number, default: 0 },
      insurance: { type: Number, default: 0 },
      leaveDeduction: { type: Number, default: 0 },
      notMarkedDeduction: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    totalAllowances: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    netSalary: { type: Number, required: true, min: 0 },

    // Payment Lifecycle
    paymentStatus: {
      type: String,
      enum: ['GENERATED', 'PENDING', 'PAID', 'FAILED', 'PROCESSING'],
      default: 'PENDING',
      index: true,
    },
    paymentDate: { type: String },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'CHEQUE', 'UPI', 'CASH'],
      default: 'BANK_TRANSFER',
    },
    transactionReference: { type: String, trim: true },
    salarySlipNumber: { type: String, trim: true },
    paidBy: { type: String },
    paidByName: { type: String },
    remarks: { type: String, trim: true },
    auditLog: [
      {
        action: { type: String },
        performedBy: { type: String },
        timestamp: { type: String },
        details: { type: String },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'staff_payroll',
  }
);

StaffPayrollSchema.index({ staffId: 1, payrollMonth: 1 }, { unique: true });
StaffPayrollSchema.index({ employeeId: 1, payrollMonth: 1 }, { unique: true });

export const StaffPayrollModel: mongoose.Model<any> =
  mongoose.models.StaffPayroll || mongoose.model('StaffPayroll', StaffPayrollSchema);
