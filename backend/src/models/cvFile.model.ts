import { Schema, model, Document, Types } from 'mongoose';

export interface ICvFile extends Document {
  userId: Types.ObjectId;
  fileName: string;
  cvText: string;
  headerText?: string;
  uploadedAt: Date;
  fileSizeBytes: number;
  isFavorite: boolean;
}

const CvFileSchema = new Schema<ICvFile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    cvText: { type: String, required: true },
    // Original (unflattened) first few lines, preserved separately from cvText
    // for title detection - absent on CVs saved before this field existed.
    headerText: { type: String, required: false },
    fileSizeBytes: { type: Number, required: true },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

export const CvFile = model<ICvFile>('CvFile', CvFileSchema);
