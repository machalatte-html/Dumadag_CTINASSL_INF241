import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from '../server/app.js';

const app = createApp();
let connectionPromise;

function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }
  return connectionPromise;
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url, 'https://pcmax.invalid');
  const apiPath = requestUrl.searchParams.get('path');
  if (apiPath === null) {
    return res.status(404).json({ error: 'Not found' });
  }

  requestUrl.searchParams.delete('path');
  req.url = `/api/${apiPath}${requestUrl.search}`;

  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error('API initialization failed:', error.message);
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
}
