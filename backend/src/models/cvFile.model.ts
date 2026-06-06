import { Schema, model, Document, Types } from 'mongoose';

export interface ICvFile extends Document {
  userId: Types.ObjectId;
  fileName: string;
  cvText: string;
  uploadedAt: Date;
  fileSizeBytes: number;
}

const CvFileSchema = new Schema<ICvFile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    cvText: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

export const CvFile = model<ICvFile>('CvFile', CvFileSchema);
