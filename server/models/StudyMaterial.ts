import mongoose, { Schema } from 'mongoose';

const StudyMaterialSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String },
    classId: { type: String, ref: 'Class', required: true, index: true },
    className: { type: String, required: true },
    subjectId: { type: String, ref: 'Subject', required: true, index: true },
    subjectName: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    uploaderRole: { type: String },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },
    uploadedAt: { type: String, required: true },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'study_materials',
  }
);

export const StudyMaterialModel: mongoose.Model<any> =
  mongoose.models.StudyMaterial || mongoose.model('StudyMaterial', StudyMaterialSchema);
