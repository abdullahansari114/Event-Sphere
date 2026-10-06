import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary-v2'

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'eventsphere/products',
    allowed_formats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'],
    public_id: (req) => `${req.user._id}-${Date.now()}`,
    // Bohat bari image ho to chhoti kar do, aspect ratio wahi rehta hai
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('Only image files (jpeg, png, webp, gif) are allowed'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max
})

// Multer ke errors (file bari, galat type) 500 ki jagah 400 ban ke jayein
export const uploadProductImage = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400)
      return next(err)
    }
    next()
  })
}

export default uploadProductImage
