import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { ensureJobsAdminIndexes } from './config/ensureAdminIndexes';
import { logStartup } from './utils/logger';

const PORT = Number(process.env.PORT) || 8000;

async function main() {
  logStartup();
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    void ensureJobsAdminIndexes().catch((err) => {
      console.warn('Admin index setup skipped or partial:', err);
    });
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
