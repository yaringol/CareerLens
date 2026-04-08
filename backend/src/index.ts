import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { logPocStartup } from './utils/pocLog';

const PORT = Number(process.env.PORT) || 8000;

async function main() {
  logPocStartup();
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
