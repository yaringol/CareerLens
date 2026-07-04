import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { logStartup } from './utils/logger';

const PORT = Number(process.env.PORT) || 8000;

async function main() {
  logStartup();
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
