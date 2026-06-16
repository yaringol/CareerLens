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

interface ISectionUpdate {
  sectionId: string;
  label: string;
  originalText: string;
  finalText: string;
  order: number;
  version: number;
}

export interface IImprovementSession extends Document {
  userId: mongoose.Types.ObjectId;
  displayName: string;
  status: 'completed';
  jobTitle: string;
  analysisId: string;
  originalCvText: string;
  finalCvText: string;
  improvements: ISkillImprovement[];
  sectionUpdates: ISectionUpdate[];
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

const SectionUpdateSchema = new Schema<ISectionUpdate>(
  {
    sectionId: { type: String, required: true },
    label: { type: String, default: '' },
    originalText: { type: String, required: true },
    finalText: { type: String, required: true },
    order: { type: Number, required: true },
    version: { type: Number, default: 0 },
  },
  { _id: false }
);

const ImprovementSessionSchema = new Schema<IImprovementSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    status: { type: String, enum: ['completed'], default: 'completed', required: true },
    jobTitle: { type: String, required: true },
    analysisId: { type: String, required: true },
    originalCvText: { type: String, required: true },
    finalCvText: { type: String, required: true },
    improvements: [SkillImprovementSchema],
    sectionUpdates: [SectionUpdateSchema],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const ImprovementSession = mongoose.model<IImprovementSession>(
  'ImprovementSession',
  ImprovementSessionSchema
);
