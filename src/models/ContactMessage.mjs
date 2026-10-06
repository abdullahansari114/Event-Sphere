import { Schema, model } from 'mongoose'

// Public "Contact Us" form submissions se aane wala message — koi login zaroori nahi.
// Admin dashboard isi collection ko list karta hai.
const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, trim: true, default: '' },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false }, // admin ne dekh liya ya nahi
  },
  { timestamps: true },
)

export default model('ContactMessage', contactMessageSchema)
