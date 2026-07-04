import { Schema, model, Document } from 'mongoose';

export interface IJob extends Document {
  title: string;
  normalizedTitle: string;
  /** Optional; analyze uses the client `jobDescription` body field, not this. */
  description?: string;
  metadata?: Record<string, unknown>;
}

const JobSchema = new Schema<IJob>({
  title: { type: String, required: true },
  normalizedTitle: { type: String, required: true },
  description: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed },
});

// Catalog of supported canonical roles (title selectors), seeded from the DS model's
// /titles endpoint. Distinct from the scraper's `jobs` DB of raw postings.
export const Job = model<IJob>('Job', JobSchema, 'roles');
