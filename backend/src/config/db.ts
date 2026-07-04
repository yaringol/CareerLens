import mongoose from 'mongoose';
import { requireMongoUri } from './mongoUri';

export async function connectDB(): Promise<void> {
  const uri = requireMongoUri('MONGODB_URI');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
}
