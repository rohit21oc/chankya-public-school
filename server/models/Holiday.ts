import mongoose, { Schema } from 'mongoose';

const HolidaySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    endDate: { type: String }, // Optional YYYY-MM-DD
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ['NATIONAL', 'FESTIVAL', 'SCHOOL', 'VACATION', 'STATE', 'OTHER'],
      default: 'FESTIVAL',
    },
    academicSession: { type: String, index: true },
    createdBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'holidays',
  }
);

HolidaySchema.index({ date: 1, academicSession: 1 });

export const HolidayModel: mongoose.Model<any> =
  mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema);
