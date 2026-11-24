import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 4000);
const app = createApp();
if (process.env.NODE_ENV !== 'test') {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not configured. Add it to .env before starting PCMAX.');
    process.exit(1);
  } else if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  ) {
    console.error('Production requires a SESSION_SECRET of at least 32 characters.');
    process.exit(1);
  } else
    mongoose
      .connect(process.env.MONGODB_URI)
      .then(() => app.listen(port, () => console.log(`PCMAX API listening on ${port}`)))
      .catch((error) => {
        console.error('Database connection failed:', error.message);
        process.exit(1);
      });
}
export default app;
