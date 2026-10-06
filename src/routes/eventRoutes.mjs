// src/routes/eventRoutes.mjs
import express from 'express'
import {
  getEvents,
  getFeaturedEvents,
  getUpcomingEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controller/eventController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'
// ⚠️ Ye path apni cloudinary config file ke hisaab se adjust kar lena
import { parser } from '../config/cloudinary.mjs'

const eventrouter = express.Router()

// public routes — koi bhi dekh sake
eventrouter.get('/', getEvents)
eventrouter.get('/featured', getFeaturedEvents)
eventrouter.get('/upcoming', getUpcomingEvents)
eventrouter.get('/:id', getEventById)

// admin only routes
eventrouter.post('/', protect, authorize('admin'), parser.single('banner'), createEvent)
eventrouter.put('/:id', protect, authorize('admin'), parser.single('banner'), updateEvent)
eventrouter.delete('/:id', protect, authorize('admin'), deleteEvent)

export default eventrouter