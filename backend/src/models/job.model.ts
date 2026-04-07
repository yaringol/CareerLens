import { Schema, model, Document } from 'mongoose';

export interface IJob extends Document {
  title: string;
  normalizedTitle: string;
  /** Stored JD snippet for POC dynamic skill extraction when the client only sends jobId */
  description?: string;
  metadata?: Record<string, unknown>;
}

const JobSchema = new Schema<IJob>({
  title: { type: String, required: true },
  normalizedTitle: { type: String, required: true },
  description: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed },
});

export const Job = model<IJob>('Job', JobSchema, 'job-PocOnly');
