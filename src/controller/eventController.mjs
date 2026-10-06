// src/controllers/eventController.mjs
import Event from '../models/Event.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// GET /api/events
export const getEvents = asyncHandler(async (req, res) => {
  const events = await Event.find().sort({ date: 1 })
  res.json(events)
})

// GET /api/events/featured
export const getFeaturedEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ featured: true })
  res.json(events)
})

// GET /api/events/upcoming
export const getUpcomingEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: 'published' }).sort({ date: 1 }).limit(4)
  res.json(events)
})

// GET /api/events/:id
export const getEventById = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id)
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }
  res.json(event)
})

// POST /api/events  (admin only)
// Agar banner image bheji gayi hai (multipart/form-data, field name "banner"),
// to Cloudinary upload multer-storage-cloudinary ke through pehle hi ho chuka hota
// hai is point tak — req.file.path mein uska secure Cloudinary URL milta hai.
export const createEvent = asyncHandler(async (req, res) => {
  const eventData = { ...req.body, organizer: req.user._id }

  if (req.file) {
    eventData.banner = req.file.path // Cloudinary secure_url
  }

  const event = await Event.create(eventData)
  res.status(201).json(event)
})

// PUT /api/events/:id  (admin only)
// Naya banner bheja gaya ho to purana replace kar deta hai, warna jo pehle se
// database mein hai wahi rehne deta hai (kyunke req.body mein banner nahi aayega).
export const updateEvent = asyncHandler(async (req, res) => {
  const updateData = { ...req.body }

  if (req.file) {
    updateData.banner = req.file.path
  }

  const event = await Event.findByIdAndUpdate(req.params.id, updateData, {
    new: true, // updated document wapis bhejo
    runValidators: true,
  })
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }
  res.json(event)
})

// DELETE /api/events/:id  (admin only)
export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findByIdAndDelete(req.params.id)
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }
  res.json({ success: true, id: req.params.id })
})