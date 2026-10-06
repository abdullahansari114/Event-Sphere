import mongoose from 'mongoose';
import 'dotenv/config';

// Connection cache — Vercel (serverless) mein har request par naya connection
// na bane, isliye pehla connection reuse hota hai.
let connectionPromise = null;

export default async function main() {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
      .then(() => {
        console.log('MongoDB Connected Successfully');
      })
      .catch((err) => {
        connectionPromise = null; // agli request par dobara try ho
        console.log('MongoDB Connection Error:', err.message);
        throw err;
      });
  }

  await connectionPromise;
}
