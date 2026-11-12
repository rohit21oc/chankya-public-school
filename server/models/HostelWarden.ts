import mongoose, { Schema } from 'mongoose';

/**
 * Hostel warden records. These are NOT school attendance: night roll-call lives in `hostel_attendance`
 * and never reads from or writes to the `attendance` (classroom) collection.
 */

const HostelAttendanceHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    remarks: { type: String },
    reason: { type: String },
    at: { type: String, required: true },
    byId: { type: String },
    byName: { type: String },
    byRole: { type: String },
  },
  { _id: false }
);

const HostelAttendanceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    hostelId: { type: String, required: true, index: true },
    hostelName: { type: String },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String },
    admissionNumber: { type: String },
    className: { type: String },
    section: { type: String },
    roomNumber: { type: String },
    bedNumber: { type: String },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (India) of the night
    session: { type: String, enum: ['NIGHT'], default: 'NIGHT' },
    status: { type: String, enum: ['PRESENT', 'ABSENT', 'ON_LEAVE', 'OUTSIDE'], required: true },
    remarks: { type: String },
    markedAt: { type: String, required: true },
    markedById: { type: String },
    markedByName: { type: String },
    corrected: { type: Boolean, default: false },
    history: [HostelAttendanceHistorySchema],
  },
  { timestamps: true, collection: 'hostel_attendance' }
);
// One night record per student per date: a second submission is a correction, never a duplicate.
HostelAttendanceSchema.index({ studentId: 1, date: 1, session: 1 }, { unique: true });

const MealSchema = new Schema(
  {
    meal: { type: String, enum: ['BREAKFAST', 'LUNCH', 'DINNER'], required: true },
    time: { type: String },
    items: [{ type: String }],
  },
  { _id: false }
);

const HostelMessMenuSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    hostelId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    meals: [MealSchema],
    notice: { type: String },
    updatedById: { type: String },
    updatedByName: { type: String },
    updatedAt: { type: String },
  },
  { collection: 'hostel_mess_menus' }
);
HostelMessMenuSchema.index({ hostelId: 1, date: 1 }, { unique: true });

/** The weekly mess menu: one entry per hostel per weekday (1 = Monday … 7 = Sunday), repeated every week. */
const HostelWeeklyMenuSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    hostelId: { type: String, required: true, index: true },
    weekday: { type: Number, required: true, min: 1, max: 7 },
    meals: [MealSchema],
    notice: { type: String },
    updatedById: { type: String },
    updatedByName: { type: String },
    updatedAt: { type: String },
  },
  { collection: 'hostel_weekly_menus' }
);
HostelWeeklyMenuSchema.index({ hostelId: 1, weekday: 1 }, { unique: true });

const HostelAlertSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    hostelId: { type: String, required: true, index: true },
    hostelName: { type: String },
    type: { type: String, enum: ['ABSENT_AT_NIGHT', 'EMERGENCY'], required: true },
    studentId: { type: String, index: true },
    studentName: { type: String },
    date: { type: String, index: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN', index: true },
    createdAt: { type: String, required: true },
    createdById: { type: String },
    createdByName: { type: String },
    resolvedAt: { type: String },
    resolvedByName: { type: String },
    resolution: { type: String },
  },
  { collection: 'hostel_alerts' }
);

export const HostelAttendanceModel: mongoose.Model<any> =
  mongoose.models.HostelAttendance || mongoose.model('HostelAttendance', HostelAttendanceSchema);
export const HostelMessMenuModel: mongoose.Model<any> =
  mongoose.models.HostelMessMenu || mongoose.model('HostelMessMenu', HostelMessMenuSchema);
export const HostelWeeklyMenuModel: mongoose.Model<any> =
  mongoose.models.HostelWeeklyMenu || mongoose.model('HostelWeeklyMenu', HostelWeeklyMenuSchema);
export const HostelAlertModel: mongoose.Model<any> =
  mongoose.models.HostelAlert || mongoose.model('HostelAlert', HostelAlertSchema);
