import mongoose, { Schema } from 'mongoose';

/** One phone or browser that agreed to receive notifications, owned by one login. */
const PushDeviceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ['EXPO', 'FCM', 'WEB'], required: true },
    userId: { type: String, required: true, index: true },
    role: { type: String },
    studentIds: { type: [String], default: [] },
    staffId: { type: String },
    token: { type: String },
    subscription: { type: Schema.Types.Mixed },
    platform: { type: String },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { collection: 'push_devices' }
);

export const PushDeviceModel: mongoose.Model<any> =
  mongoose.models.PushDevice || mongoose.model('PushDevice', PushDeviceSchema);
