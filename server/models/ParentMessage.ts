import mongoose, { Schema } from 'mongoose';

/**
 * Parent ↔ staff chat. One thread per student and staff member
 * (threadId = "<studentId>::<staffId>"); every parent linked to the child sees it.
 * Older messages used threadId = studentId (the "School office" thread). FEE_DUE messages carry the dues snapshot they were sent with.
 */
const ParentMessageSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    threadId: { type: String, required: true, index: true },
    staffId: { type: String, index: true },
    staffName: { type: String, trim: true },
    staffTitle: { type: String, trim: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, trim: true },
    className: { type: String, trim: true },
    section: { type: String, trim: true },
    senderSide: { type: String, enum: ['SCHOOL', 'PARENT'], required: true },
    senderId: { type: String },
    senderName: { type: String, trim: true },
    senderRole: { type: String },
    kind: { type: String, enum: ['TEXT', 'FEE_DUE', 'EMERGENCY'], default: 'TEXT' },
    text: { type: String, required: true },
    feeDue: {
      totalPending: { type: Number },
      overdue: { type: Number },
      items: [{ label: String, amount: Number, dueDate: String }],
    },
    createdAt: { type: String, required: true, index: true },
    readByParentAt: { type: String },
    readBySchoolAt: { type: String },
  },
  { collection: 'parent_messages' }
);

ParentMessageSchema.index({ threadId: 1, createdAt: 1 });

export const ParentMessageModel: mongoose.Model<any> =
  mongoose.models.ParentMessage || mongoose.model('ParentMessage', ParentMessageSchema);
