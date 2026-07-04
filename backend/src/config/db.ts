import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri =
    process.env.MONGODB_URI ??
    'mongodb://root:secretpassword@82.70.215.125:27017/careerlens?authSource=admin';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
}
