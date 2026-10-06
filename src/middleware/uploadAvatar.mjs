import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary-v2'

// Config idempotent hai — dobara call karna safe hai (same singleton instance)
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eventsphere/avatars',
    allowed_format: ['png', 'jpg', 'jpeg', 'gif', 'jfif', 'webp', 'avif'],
    public_id: (req, file) => `${req.user._id}-${Date.now()}`,
    // Chehra center mein rakh ke square crop — profile avatar ke liye behtar dikhta hai
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files (jpeg, png, webp, gif) are allowed'), false)
  }
}

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
})

export default uploadAvatar
