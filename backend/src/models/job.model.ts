import { Schema, model, Document } from 'mongoose';

export interface IJob extends Document {
  title: string;
  normalizedTitle: string;
  metadata?: Record<string, unknown>;
}

const JobSchema = new Schema<IJob>({
  title: { type: String, required: true },
  normalizedTitle: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
});

export const Job = model<IJob>('Job', JobSchema, 'job-PocOnly');
