import mongoose, { Schema } from 'mongoose';

const HomeworkSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    section: { type: String, required: true, index: true },
    subjectId: { type: String, ref: 'Subject', required: true, index: true },
    subjectName: { type: String, required: true },
    assignedDate: { type: String, required: true },
    dueDate: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    instructions: { type: String },
    teacherId: { type: String, ref: 'Staff', required: true },
    teacherName: { type: String, required: true },
    attachmentUrl: { type: String },
    attachmentFileKey: { type: String },
    attachmentName: { type: String },
    attachmentSize: { type: Number },
    status: { type: String, enum: ['ASSIGNED', 'SUBMITTED', 'GRADED'], default: 'ASSIGNED' },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'homework',
  }
);

export const HomeworkModel: mongoose.Model<any> =
  mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);
