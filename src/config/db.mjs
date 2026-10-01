import mongoose from 'mongoose';
import 'dotenv/config';

export default async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.log("MongoDB Connection Error:", err.message);
    process.exit(1);
  }
}
