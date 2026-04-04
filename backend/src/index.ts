import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT ?? 3000;

async function main() {
  console.log('Starting server...');

  try {
    await connectDB();
    console.log('DB connected');
  } catch (err) {
    console.warn('MongoDB connection failed, starting server without DB:', err);
  }

  console.log('Starting Express...');

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});