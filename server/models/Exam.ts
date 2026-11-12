import mongoose, { Schema } from 'mongoose';

const ExamScheduleItemSchema = new Schema(
  {
    id: { type: String },
    classId: { type: String, ref: 'Class' },
    className: { type: String },
    section: { type: String, default: 'ALL' },
    subjectId: { type: String, ref: 'Subject', required: true },
    subjectName: { type: String, required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    maxMarks: { type: Number, required: true, default: 100 },
    passMarks: { type: Number, required: true, default: 33 },
    roomNumber: { type: String },
    instructions: { type: String },
  },
  { _id: false }
);

const ExamSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    title: { type: String, trim: true },
    term: { type: String },
    examType: { type: String, default: 'MID_TERM' },
    academicSession: { type: String, required: true, index: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    classIds: [{ type: String, ref: 'Class' }],
    section: { type: String, default: 'ALL' },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'COMPLETED', 'UPCOMING', 'ONGOING'],
      default: 'DRAFT',
      index: true,
    },
    admitCardStatus: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED'],
      default: 'DRAFT',
      index: true,
    },
    resultsStatus: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED'],
      default: 'DRAFT',
      index: true,
    },
    isApprovedByPrincipal: { type: Boolean, default: false },
    instructions: { type: String },
    roomVenue: { type: String },
    schedule: [ExamScheduleItemSchema],
    description: { type: String },
  },
  {
    timestamps: true,
    collection: 'exams',
  }
);

const ExamMarkSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    examId: { type: String, ref: 'Exam', required: true, index: true },
    studentId: { type: String, ref: 'Student', required: true, index: true },
    studentName: { type: String, required: true },
    admissionNumber: { type: String, required: true },
    rollNumber: { type: String, required: true },
    classId: { type: String, ref: 'Class', required: true, index: true },
    section: { type: String, required: true },
    subjectId: { type: String, ref: 'Subject', required: true, index: true },
    subjectName: { type: String, required: true },
    marksObtained: { type: Number, required: true, default: 0 },
    maxMarks: { type: Number, required: true, default: 100 },
    passMarks: { type: Number, required: true, default: 33 },
    isAbsent: { type: Boolean, default: false },
    grade: { type: String },
    gradePoint: { type: Number },
    remarks: { type: String },
    remark: { type: String },
    status: { type: String, enum: ['PASS', 'FAIL', 'ABSENT', 'N/A'], default: 'PASS' },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'exam_marks',
  }
);

ExamMarkSchema.index({ examId: 1, studentId: 1, subjectId: 1 }, { unique: true });

export const ExamModel: mongoose.Model<any> =
  mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
export const ExamMarkModel: mongoose.Model<any> =
  mongoose.models.ExamMark || mongoose.model('ExamMark', ExamMarkSchema);
