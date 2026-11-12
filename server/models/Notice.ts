import mongoose, { Schema } from 'mongoose';

export type NoticeType =
  | 'GENERAL'
  | 'ACADEMIC'
  | 'EXAM'
  | 'RESULT'
  | 'HOLIDAY'
  | 'EVENT'
  | 'FEE'
  | 'ADMISSION'
  | 'EMERGENCY';

export type NoticeAudience =
  | 'ALL'
  | 'STUDENTS'
  | 'PARENTS'
  | 'STAFF'
  | 'CLASS'
  | 'SECTION'
  | 'INDIVIDUAL';

export type NoticePriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type NoticeStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED';

const NoticeSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, index: true },
    content: { type: String, required: true },
    noticeType: {
      type: String,
      enum: ['GENERAL', 'ACADEMIC', 'EXAM', 'RESULT', 'HOLIDAY', 'EVENT', 'FEE', 'ADMISSION', 'EMERGENCY', 'OFFICIAL_SMS', 'MESSAGE', 'CIRCULAR'],
      default: 'GENERAL',
      index: true,
    },
    category: {
      type: String,
      default: 'GENERAL',
      index: true,
    },
    targetAudience: {
      type: String,
      enum: ['ALL', 'STUDENTS', 'PARENTS', 'STAFF', 'CLASS', 'SECTION', 'INDIVIDUAL', 'TEACHERS', 'All', 'Students', 'Teachers', 'Parents', 'Staff'],
      default: 'ALL',
      index: true,
    },
    targetClass: { type: String, default: '' },
    targetClassId: { type: String, default: '' },
    targetSection: { type: String, default: '' },
    targetStudentIds: [{ type: String }],
    targetPhone: { type: String, index: true },
    date: { type: String, required: true, index: true },
    publishDate: { type: String, required: true, index: true },
    publishedDate: { type: String, index: true },
    expiryDate: { type: String, default: '', index: true },
    publishedBy: { type: String, default: 'Principal Secretariat' },
    author: { type: String, required: true, default: 'Administration' },
    authorId: { type: String, default: '' },
    authorRole: { type: String, default: 'SUPER_ADMIN' },
    priority: {
      type: String,
      enum: ['NORMAL', 'IMPORTANT', 'URGENT'],
      default: 'NORMAL',
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'EXPIRED'],
      default: 'PUBLISHED',
      index: true,
    },
    isUrgent: { type: Boolean, default: false },
    isImportant: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false, index: true },
    showOnHomepage: { type: Boolean, default: true },
    showInTicker: { type: Boolean, default: false },
    attachmentUrl: { type: String, default: '' },
    attachmentFileKey: { type: String, default: '' },
    attachmentName: { type: String, default: '' },
    academicSession: { type: String, index: true },
    // Read & Seen Receipts Tracking
    seenBy: [
      {
        userId: { type: String },
        userName: { type: String },
        role: { type: String },
        studentId: { type: String },
        phone: { type: String },
        seenAt: { type: String },
      },
    ],
    seenCount: { type: Number, default: 0 },
    isSeen: { type: Boolean, default: false, index: true },
    seenAt: { type: String },
    smsLogId: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'notices',
    bufferCommands: false,
    bufferTimeoutMS: 0,
  }
);

// Indexes for high performance querying
NoticeSchema.index({ status: 1, publishDate: -1 });
NoticeSchema.index({ targetAudience: 1, status: 1 });
NoticeSchema.index({ noticeType: 1, status: 1 });
NoticeSchema.index({ expiryDate: 1 });

export const NoticeModel: mongoose.Model<any> =
  mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
