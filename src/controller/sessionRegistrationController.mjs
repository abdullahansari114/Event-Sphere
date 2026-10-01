import Session from '../models/Session.mjs'
import SessionRegistration from '../models/SessionRegistration.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// POST /api/v1/session-registration  (logged-in attendee) — seat request bhejna
export const registerForSession = asyncHandler(async (req, res) => {
  const { sessionId, name, email, phone } = req.body

  if (!sessionId || !name || !email) {
    res.status(400)
    throw new Error('sessionId, name and email are required')
  }

  const session = await Session.findById(sessionId)
  if (!session) {
    res.status(404)
    throw new Error('Session not found')
  }

  const existing = await SessionRegistration.findOne({
    session: sessionId,
    attendee: req.user._id,
    status: { $in: ['pending', 'approved'] },
  })
  if (existing) {
    res.status(400)
    throw new Error('You have already requested a seat for this session')
  }

  const approvedCount = await SessionRegistration.countDocuments({ session: sessionId, status: 'approved' })
  if (approvedCount >= session.totalSeats) {
    res.status(400)
    throw new Error('Sorry, this session is fully booked')
  }

  const registration = await SessionRegistration.create({
    session: sessionId,
    attendee: req.user._id,
    name,
    email,
    phone,
  })

  const populated = await registration.populate('session')
  res.status(201).json(populated)
})

// GET /api/v1/session-registration/mine  (logged-in attendee) — apni sab seat requests
export const getMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await SessionRegistration.find({ attendee: req.user._id })
    .populate('session')
    .sort({ createdAt: -1 })
  res.json(registrations)
})

// GET /api/v1/session-registration  (admin only) — sab seat requests
export const getAllRegistrations = asyncHandler(async (req, res) => {
  const registrations = await SessionRegistration.find()
    .populate('session')
    .sort({ createdAt: -1 })
  res.json(registrations)
})

// PUT /api/v1/session-registration/:id  (admin only) — approve/reject
export const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400)
    throw new Error('status must be approved or rejected')
  }

  const registration = await SessionRegistration.findById(req.params.id)
  if (!registration) {
    res.status(404)
    throw new Error('Registration not found')
  }

  if (status === 'approved') {
    const session = await Session.findById(registration.session)
    const approvedCount = await SessionRegistration.countDocuments({
      session: registration.session,
      status: 'approved',
    })
    if (approvedCount >= session.totalSeats) {
      res.status(400)
      throw new Error('No seats left for this session')
    }
  }

  registration.status = status
  await registration.save()

  const populated = await registration.populate('session')
  res.json(populated)
})

// DELETE /api/v1/session-registration/:id  (owner ya admin) — request cancel
export const cancelRegistration = asyncHandler(async (req, res) => {
  const registration = await SessionRegistration.findById(req.params.id)
  if (!registration) {
    res.status(404)
    throw new Error('Registration not found')
  }

  const isOwner = registration.attendee.toString() === req.user._id.toString()
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not authorized to cancel this registration')
  }

  await registration.deleteOne()
  res.json({ success: true, id: req.params.id })
})
