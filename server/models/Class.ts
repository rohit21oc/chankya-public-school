import mongoose, { Schema } from 'mongoose';

const AcademicSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    maxCapacity: { type: Number, default: 40 },
    classTeacherId: { type: String, ref: 'Staff' },
    classTeacherName: { type: String },
    roomNumber: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { _id: false }
);

const ClassSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    numericOrder: { type: Number, required: true, index: true },
    sections: [{ type: String }],
    detailedSections: [AcademicSectionSchema],
    classTeacherId: { type: String, ref: 'Staff' },
    classTeacherName: { type: String },
    classTeacher: { type: String },
    maxCapacity: { type: Number, default: 40 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    academicSession: { type: String, index: true },
    description: { type: String },
  },
  {
    timestamps: true,
    collection: 'classes',
  }
);

export const ClassModel: mongoose.Model<any> = mongoose.models.Class || mongoose.model('Class', ClassSchema);
