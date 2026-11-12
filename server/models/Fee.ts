import mongoose, { Schema } from 'mongoose';

const FeeHeadSchema = new Schema(
  {
    headName: { type: String, required: true },
    amount: { type: Number, required: true },
    frequency: { type: String, default: 'MONTHLY' },
    isOptional: { type: Boolean, default: false },
    description: { type: String },
  },
  { _id: false }
);

const FeeStructureSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    academicSession: { type: String, required: true, index: true },
    totalAmount: { type: Number, required: true },
    tuitionFee: { type: Number, default: 0 },
    admissionFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    computerFee: { type: Number, default: 0 },
    libraryFee: { type: Number, default: 0 },
    developmentFee: { type: Number, default: 0 },
    sportsFee: { type: Number, default: 0 },
    annualCharges: { type: Number, default: 0 },
    heads: [FeeHeadSchema],
    frequency: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME'],
      default: 'MONTHLY',
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  {
    timestamps: true,
    collection: 'fee_structures',
  }
);

const ClassFeeConfigSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    academicSession: { type: String, required: true, index: true },
    monthlyTuitionFee: { type: Number, default: 0 },
    admissionFee: { type: Number, default: 0 },
    annualCharges: { type: Number, default: 0 },
    examFeePerTerm: { type: Number, default: 0 },
    labFee: { type: Number, default: 0 },
    libraryFee: { type: Number, default: 0 },
    sportsFee: { type: Number, default: 0 },
    computerFee: { type: Number, default: 0 },
    developmentFee: { type: Number, default: 0 },
    defaultMessFee: { type: Number, default: 0 },
    defaultHostelFee: { type: Number, default: 0 },
    breakdowns: [Schema.Types.Mixed],
  },
  {
    timestamps: true,
    collection: 'fee_configurations',
  }
);

const FeePaymentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, ref: 'Student', required: true, index: true },
    studentName: { type: String, required: true },
    admissionNumber: { type: String, required: true, index: true },
    rollNumber: { type: String },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    section: { type: String, required: true },
    academicSession: { type: String, required: true, index: true },
    feeStructureId: { type: String, ref: 'FeeStructure' },
    feeHead: { type: String },
    month: { type: String },
    amount: { type: Number, required: true },
    paidAmount: { type: Number },
    discountAmount: { type: Number, default: 0 },
    fineAmount: { type: Number, default: 0 },
    netAmount: { type: Number },
    paymentMode: {
      type: String,
      required: true,
      enum: ['CASH', 'CHEQUE', 'ONLINE', 'UPI', 'BANK_TRANSFER', 'CARD'],
      index: true,
    },
    transactionId: { type: String },
    chequeNumber: { type: String },
    bankName: { type: String },
    paymentDate: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['SUCCESS', 'PENDING', 'FAILED', 'REVERSED'],
      default: 'SUCCESS',
      index: true,
    },
    collectedBy: { type: String },
    remarks: { type: String },
    receiptUrl: { type: String },
    receiptFileKey: { type: String },
  },
  {
    timestamps: true,
    collection: 'fee_payments',
    strict: false,
  }
);

FeePaymentSchema.index({ studentId: 1, paymentDate: 1 });
FeePaymentSchema.index({ receiptNumber: 1 });

const FeeLedgerSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, ref: 'Student', required: true, index: true },
    studentName: { type: String, required: true },
    admissionNumber: { type: String, required: true, index: true },
    classId: { type: String, ref: 'Class' },
    className: { type: String },
    section: { type: String },
    academicSession: { type: String, index: true },
    month: { type: String },
    feeMonth: { type: String, index: true },
    monthYear: { type: String },
    billingPeriod: { type: String },
    feeType: { type: String },
    dueDate: { type: String },
    tuitionFee: { type: Number, default: 0 },
    hostelFee: { type: Number, default: 0 },
    messFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    annualCharges: { type: Number, default: 0 },
    otherFee: { type: Number, default: 0 },
    amount: { type: Number },
    discount: { type: Number, default: 0 },
    fine: { type: Number, default: 0 },
    total: { type: Number },
    totalDue: { type: Number },
    paidAmount: { type: Number, default: 0 },
    concessionAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number },
    balance: { type: Number },
    status: {
      type: String,
      default: 'PENDING',
      index: true,
    },
    paymentDate: { type: String },
    lastPaymentDate: { type: String },
    receiptNumber: { type: String, index: true },
    invoiceNumber: { type: String, index: true },
    paymentMethod: { type: String },
    transactionReference: { type: String },
    collectedBy: { type: String },
    remarks: { type: String },
    breakdown: [Schema.Types.Mixed],
    paymentIds: [{ type: String }],
  },
  {
    timestamps: true,
    collection: 'fee_ledgers',
    strict: false,
  }
);

FeeLedgerSchema.index({ studentId: 1, academicSession: 1 });

export const FeeStructureModel: mongoose.Model<any> =
  mongoose.models.FeeStructure || mongoose.model('FeeStructure', FeeStructureSchema);
export const ClassFeeConfigModel: mongoose.Model<any> =
  mongoose.models.ClassFeeConfig || mongoose.model('ClassFeeConfig', ClassFeeConfigSchema);
export const FeePaymentModel: mongoose.Model<any> =
  mongoose.models.FeePayment || mongoose.model('FeePayment', FeePaymentSchema);
export const FeeLedgerModel: mongoose.Model<any> =
  mongoose.models.FeeLedger || mongoose.model('FeeLedger', FeeLedgerSchema);
