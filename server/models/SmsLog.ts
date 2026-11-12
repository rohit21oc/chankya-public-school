import mongoose, { Schema } from 'mongoose';

export type SmsTriggerType =
  | 'DAILY_ABSENTEE'
  | 'FEE_REMINDER'
  | 'EXAM_ANNOUNCEMENT'
  | 'ADMIT_CARD_PUBLISHED'
  | 'RESULT_PUBLISHED'
  | 'EMERGENCY_CIRCULAR'
  | 'CUSTOM';

export type SmsStatus =
  | 'QUEUED'
  | 'SUBMITTED'
  | 'SENT'
  | 'DELIVERED'
  | 'SEEN'
  | 'FAILED'
  | 'UNKNOWN';

const SmsLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    sentAt: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    deliveredAt: { type: String },
    seenAt: { type: String },
    seen: { type: Boolean, default: false, index: true },
    seenBy: { type: String },
    portalNoticeId: { type: String, index: true },
    triggerType: {
      type: String,
      enum: [
        'DAILY_ABSENTEE',
        'FEE_REMINDER',
        'EXAM_ANNOUNCEMENT',
        'ADMIT_CARD_PUBLISHED',
        'RESULT_PUBLISHED',
        'EMERGENCY_CIRCULAR',
        'CUSTOM',
      ],
      required: true,
      index: true,
    },
    recipientPhone: { type: String, required: true, index: true },
    recipientName: { type: String, required: true },
    recipientRole: {
      type: String,
      enum: ['PARENT', 'STUDENT', 'STAFF'],
      default: 'PARENT',
      index: true,
    },
    studentId: { type: String, index: true },
    studentName: { type: String },
    admissionNumber: { type: String, index: true },
    className: { type: String },
    section: { type: String },
    message: { type: String, required: true },
    characterCount: { type: Number, default: 0 },
    smsUnits: { type: Number, default: 1 },
    provider: { type: String, default: 'CPS_SMS_GATEWAY' },
    providerMessageId: { type: String, index: true },
    status: {
      type: String,
      enum: ['QUEUED', 'SUBMITTED', 'SENT', 'DELIVERED', 'FAILED', 'UNKNOWN'],
      default: 'SUBMITTED',
      index: true,
    },
    errorReason: { type: String },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    sentBy: { type: String, default: 'System' },
    sentByUserId: { type: String },
  },
  {
    timestamps: true,
    collection: 'sms_logs',
  }
);

// High performance compound indexes for analytics, logs, and duplicate checks
SmsLogSchema.index({ idempotencyKey: 1 }, { unique: true });
SmsLogSchema.index({ sentAt: -1, status: 1 });
SmsLogSchema.index({ recipientPhone: 1, date: -1 });
SmsLogSchema.index({ triggerType: 1, date: -1 });
SmsLogSchema.index({ studentId: 1, triggerType: 1 });

export const SmsLogModel: mongoose.Model<any> =
  mongoose.models.SmsLog || mongoose.model('SmsLog', SmsLogSchema);
