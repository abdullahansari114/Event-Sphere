// src/routes/settingsRoutes.mjs
import express from 'express'
import { getSettings, updateHeroImage } from '../controller/settingsController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'
import { parser } from '../config/cloudinary.mjs'

const settingsRouter = express.Router()

// Public — home page hero banner isi se load hota hai
settingsRouter.get('/', getSettings)

// Admin only — hero banner image upload/replace
settingsRouter.put('/hero', protect, authorize('admin'), parser.single('heroImage'), updateHeroImage)

export default settingsRouter
