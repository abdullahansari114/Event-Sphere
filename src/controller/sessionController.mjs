import Session from '../models/Session.mjs'
import SessionRegistration from '../models/SessionRegistration.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// Ek session document ke sath uski live seat info jod deta hai
const withSeatInfo = async (sessionDoc) => {
  const approvedCount = await SessionRegistration.countDocuments({
    session: sessionDoc._id,
    status: 'approved',
  })
  const obj = sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc
  return {
    ...obj,
    bookedSeats: approvedCount,
    availableSeats: Math.max(0, obj.totalSeats - approvedCount),
  }
}

// POST /api/v1/session  (admin only)
export const createSession = asyncHandler(async (req, res) => {
  const { title, speaker, speakerTitle, hall, location, date, startTime, endTime, totalSeats, description } = req.body

  if (!title || !speaker || !hall || !date || !startTime || !totalSeats) {
    res.status(400)
    throw new Error('title, speaker, hall, date, startTime and totalSeats are required')
  }

  const session = await Session.create({
    title,
    speaker,
    speakerTitle,
    hall,
    location,
    date,
    startTime,
    endTime,
    totalSeats,
    description,
  })

  res.status(201).json(await withSeatInfo(session))
})

// PUT /api/v1/session/:id  (admin only)
export const updateSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
  if (!session) {
    res.status(404)
    throw new Error('Session not found')
  }

  const fields = ['title', 'speaker', 'speakerTitle', 'hall', 'location', 'date', 'startTime', 'endTime', 'totalSeats', 'description']
  fields.forEach((f) => {
    if (req.body[f] !== undefined) session[f] = req.body[f]
  })

  await session.save()
  res.json(await withSeatInfo(session))
})

// DELETE /api/v1/session/:id  (admin only)
export const deleteSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
  if (!session) {
    res.status(404)
    throw new Error('Session not found')
  }

  await SessionRegistration.deleteMany({ session: session._id })
  await session.deleteOne()

  res.json({ success: true, id: req.params.id })
})

// GET /api/v1/session/:id  (public) — ek session ki poori detail, seat info ke sath
export const getSessionById = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
  if (!session) {
    res.status(404)
    throw new Error('Session not found')
  }
  res.json(await withSeatInfo(session))
})

// GET /api/v1/session  (admin only) — sab sessions (Admin Sessions page ke liye)
export const getAllSessionsAdmin = asyncHandler(async (req, res) => {
  const sessions = await Session.find().sort({ date: 1, startTime: 1 })
  const withSeats = await Promise.all(sessions.map(withSeatInfo))
  res.json(withSeats)
})

// GET /api/v1/session/public/all  (public) — poori public Schedule page ke liye
export const getAllSessionsPublic = asyncHandler(async (req, res) => {
  const sessions = await Session.find().sort({ date: 1, startTime: 1 })
  const withSeats = await Promise.all(sessions.map(withSeatInfo))
  res.json(withSeats)
})

// GET /api/v1/session/speakers  (public) — ab tak jitne bhi speakers likhe gaye hain, unki distinct list
// Admin ke "Add Session" form mein dropdown/autocomplete ke liye
export const getSpeakerSuggestions = asyncHandler(async (req, res) => {
  const speakers = await Session.distinct('speaker')
  res.json(speakers.filter(Boolean).sort())
})
