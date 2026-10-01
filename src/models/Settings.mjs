import mongoose from 'mongoose'

// Ye collection hamesha sirf EK document rakhega (site-wide settings).
// Naye settings add karne hon (jaise footer text, logo, waghera) to bas
// yahan naya field add kar dena — alag document banane ki zaroorat nahi.
const settingsSchema = new mongoose.Schema(
  {
    heroImage: {
      type: String, // Cloudinary secure_url
      default: '',
    },
  },
  { timestamps: true }
)

export default mongoose.model('Settings', settingsSchema)
