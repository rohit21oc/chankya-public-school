import mongoose, { Schema } from 'mongoose';

const FileMetadataSchema = new Schema(
  {
    fileKey: { type: String, required: true, unique: true, index: true },
    originalFileName: { type: String, required: true },
    contentType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storageProvider: {
      type: String,
      enum: ['CLOUDFLARE_R2', 'LOCAL_DISK', 'MEMORY'],
      default: 'CLOUDFLARE_R2',
      index: true,
    },
    uploadedAt: { type: String, required: true },
    folder: { type: String, default: 'documents', index: true },
    isTemporary: { type: Boolean, default: false },
    // User id that requested the upload slot (who may attach or delete it).
    uploadedBy: { type: String, index: true },
    customMetadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'file_metadata',
    bufferCommands: false,
    bufferTimeoutMS: 0,
  }
);

export const FileMetadataModel: mongoose.Model<any> =
  mongoose.models.FileMetadata || mongoose.model('FileMetadata', FileMetadataSchema);
