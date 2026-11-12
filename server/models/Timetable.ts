import mongoose, { Schema } from 'mongoose';

const TimetableSlotSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String },
    section: { type: String, required: true, index: true },
    dayOfWeek: {
      type: String,
      required: true,
      index: true,
    },
    day: { type: String, index: true },
    periodNumber: { type: Number, required: true, index: true },
    period: { type: Number },
    periodId: { type: String },
    subjectId: { type: String, ref: 'Subject', required: true },
    subjectName: { type: String, required: true },
    teacherId: { type: String, ref: 'Staff', required: true, index: true },
    teacherName: { type: String, required: true },
    startTime: { type: String, default: '08:00 AM' },
    endTime: { type: String, default: '08:45 AM' },
    roomNumber: { type: String, default: 'Room 204' },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'timetable',
  }
);

TimetableSlotSchema.index({ classId: 1, section: 1, dayOfWeek: 1, periodNumber: 1 });
TimetableSlotSchema.index({ teacherId: 1, dayOfWeek: 1, periodNumber: 1 });

const TimetablePeriodSchema = new Schema(
  {
    periodNumber: { type: Number, required: true, unique: true, index: true },
    name: { type: String },
    label: { type: String },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isBreak: { type: Boolean, default: false },
    breakType: { type: String },
    breakLabel: { type: String },
  },
  {
    timestamps: true,
    collection: 'timetable_periods',
  }
);

export const TimetableSlotModel: mongoose.Model<any> =
  mongoose.models.TimetableSlot || mongoose.model('TimetableSlot', TimetableSlotSchema);
export const TimetablePeriodModel: mongoose.Model<any> =
  mongoose.models.TimetablePeriod || mongoose.model('TimetablePeriod', TimetablePeriodSchema);
