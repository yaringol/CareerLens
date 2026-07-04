import { Schema, model, Document } from 'mongoose';

export type RecommendationMode = 'stable' | 'balanced' | 'trending' | 'custom';

/**
 * Saved Personalization-screen Recommendation Balance — the full weight triple plus
 * the chosen mode, so the screen can be restored EXACTLY on the next visit. The single
 * stable/trending scalar the model actually filters on (see computeStabilityPreference)
 * is derived from these weights at analyze time, not persisted — storing the object
 * avoids the lossy 3-weights → 1-scalar collapse (personalMatch/mode would be lost).
 */
export interface PersonalizationPreference {
  mode: RecommendationMode;
  stable: number;
  trending: number;
  personalMatch: number;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: Date;
  personalizationPreference?: PersonalizationPreference | null;
}

const PersonalizationPreferenceSchema = new Schema<PersonalizationPreference>(
  {
    mode: { type: String, enum: ['stable', 'balanced', 'trending', 'custom'], required: true },
    stable: { type: Number, min: 0, max: 100, required: true },
    trending: { type: Number, min: 0, max: 100, required: true },
    personalMatch: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user', required: true },
    personalizationPreference: { type: PersonalizationPreferenceSchema, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const User = model<IUser>('User', UserSchema);
