import { Schema, model, Document, Types } from 'mongoose';

interface SkillScore {
  skill: string;
  score: number;
}

export interface ICvAnalysis extends Document {
  cvFileName: string;
  cvTextExtracted: string;
  jobId: Types.ObjectId;
  jobTitle: string;
  extractedSkills: string[];
  scores: SkillScore[];
  matchScore: number;
  cvOnlyMode?: boolean;
  isEstimated?: boolean;
  createdAt: Date;
  rawAgentOutput: string;
}

const SkillScoreSchema = new Schema<SkillScore>(
  { skill: { type: String, required: true }, score: { type: Number, required: true } },
  { _id: false }
);

const CvAnalysisSchema = new Schema<ICvAnalysis>(
  {
    cvFileName: { type: String, required: true },
    cvTextExtracted: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    jobTitle: { type: String, required: true },
    extractedSkills: [{ type: String }],
    scores: [SkillScoreSchema],
    matchScore: { type: Number, required: true },
    cvOnlyMode: { type: Boolean, default: false },
    isEstimated: { type: Boolean, default: false },
    rawAgentOutput: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CvAnalysis = model<ICvAnalysis>('CvAnalysis', CvAnalysisSchema);
