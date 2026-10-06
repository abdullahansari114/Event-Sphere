// src/controller/settingsController.mjs
import Settings from '../models/Settings.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// Singleton document ko dhoondh kar wapis karta hai; agar abhi tak
// koi settings document bana hi nahi, to ek khaali document bana deta hai.
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne()
  if (!settings) {
    settings = await Settings.create({})
  }
  return settings
}

// GET /api/v1/settings  (public — home page isi se hero image uthata hai)
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings()
  res.json(settings)
})

// PUT /api/v1/settings/hero  (admin only)
// multipart/form-data, field name "heroImage" — Cloudinary upload multer-storage-cloudinary
// ke through pehle hi ho chuka hota hai, req.file.path mein secure Cloudinary URL milta hai.
export const updateHeroImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('Please upload an image')
  }

  const settings = await getOrCreateSettings()
  settings.heroImage = req.file.path
  await settings.save()

  res.json(settings)
})
