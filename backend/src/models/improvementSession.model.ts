import mongoose, { Schema, Document } from 'mongoose';

interface ISkillImprovement {
  skill: string;
  score: number;
  proficiency: string;
  sectionId: string | null;
  originalText: string | null;
  suggestedText: string;
  finalText: string;
  found: boolean;
  skipped: boolean;
}

export interface IImprovementSession extends Document {
  userId: mongoose.Types.ObjectId;
  jobTitle: string;
  analysisId: string;
  originalCvText: string;
  finalCvText: string;
  improvements: ISkillImprovement[];
  createdAt: Date;
}

const SkillImprovementSchema = new Schema<ISkillImprovement>(
  {
    skill: { type: String, required: true },
    score: { type: Number, required: true },
    proficiency: { type: String, required: true },
    sectionId: { type: String, default: null },
    originalText: { type: String, default: null },
    suggestedText: { type: String, default: '' },
    finalText: { type: String, default: '' },
    found: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },
  },
  { _id: false }
);

const ImprovementSessionSchema = new Schema<IImprovementSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobTitle: { type: String, required: true },
    analysisId: { type: String, required: true },
    originalCvText: { type: String, required: true },
    finalCvText: { type: String, required: true },
    improvements: [SkillImprovementSchema],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const ImprovementSession = mongoose.model<IImprovementSession>(
  'ImprovementSession',
  ImprovementSessionSchema
);
