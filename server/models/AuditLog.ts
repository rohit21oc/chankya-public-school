import mongoose, { Schema } from 'mongoose';

const AuditLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    timestamp: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    userName: { type: String, required: true, index: true },
    userRole: { type: String, index: true },
    role: { type: String, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, default: 'System', index: true },
    entityId: { type: String, default: 'general', index: true },
    details: { type: String, required: true },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
    strict: false,
  }
);

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ entity: 1, action: 1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLogModel: mongoose.Model<any> =
  mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
