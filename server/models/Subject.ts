import mongoose, { Schema } from 'mongoose';

const SubjectSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    type: {
      type: String,
      enum: ['CORE', 'ELECTIVE', 'OPTIONAL', 'ACTIVITY'],
      default: 'CORE',
      index: true,
    },
    classIds: [{ type: String, ref: 'Class', index: true }],
    maxMarks: { type: Number, default: 100 },
    passMarks: { type: Number, default: 33 },
    theoryMarks: { type: Number },
    practicalMarks: { type: Number },
    credits: { type: Number },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    department: { type: String },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'subjects',
  }
);

export const SubjectModel: mongoose.Model<any> = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
