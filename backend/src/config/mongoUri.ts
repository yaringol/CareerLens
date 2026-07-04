type MongoEnvVar = 'MONGODB_URI' | 'JOBS_MONGO_URI';

export function requireMongoUri(envVar: MongoEnvVar): string {
  const value = process.env[envVar]?.trim();
  if (value) {
    return value;
  }

  throw new Error(
    `${envVar} is required. Copy backend/.env.example to backend/.env and set your MongoDB connection string.`,
  );
}
