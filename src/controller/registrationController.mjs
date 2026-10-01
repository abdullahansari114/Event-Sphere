import Registration from '../models/Registration.mjs'
import Event from '../models/Event.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// POST /api/v1/registration  (logged-in user)
export const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId, name, email, phone } = req.body

  if (!eventId) {
    res.status(400)
    throw new Error('eventId is required')
  }
  if (!name || !email || !phone) {
    res.status(400)
    throw new Error('Name, email and phone are required')
  }

  const event = await Event.findById(eventId)
  if (!event || event.status !== 'published') {
    res.status(404)
    throw new Error('Event not found')
  }

  const already = await Registration.findOne({ event: eventId, attendee: req.user._id })
  if (already) {
    res.status(400)
    throw new Error('You are already registered for this event')
  }

  const capacityFilter =
    event.maxAttendees > 0
      ? { _id: eventId, $expr: { $lt: ['$registeredAttendees', '$maxAttendees'] } }
      : { _id: eventId }

  const updatedEvent = await Event.findOneAndUpdate(
    capacityFilter,
    { $inc: { registeredAttendees: 1 } },
    { new: true },
  )

  if (!updatedEvent) {
    res.status(400)
    throw new Error('Sorry, this event is fully booked. No seats left.')
  }

  try {
    const registration = await Registration.create({
      event: eventId,
      attendee: req.user._id,
      name,
      email,
      phone,
    })
    const populated = await registration.populate('event', 'title date location banner')
    res.status(201).json({ registration: populated, event: updatedEvent })
  } catch (err) {
    // Registration create fail hui to seat wapis kar do
    await Event.findByIdAndUpdate(eventId, { $inc: { registeredAttendees: -1 } })
    throw err
  }
})

// GET /api/v1/registration/mine  (logged-in user) — apni registrations
export const getMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ attendee: req.user._id })
    .populate('event', 'title date location banner status')
    .sort({ createdAt: -1 })
  res.json(registrations)
})

// GET /api/v1/registration  (admin only) — sab registrations
export const getAllRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find()
    .populate('event', 'title date')
    .sort({ createdAt: -1 })
  res.json(registrations)
})

// GET /api/v1/registration/event/:eventId  (logged-in — admin ya us event ka approved exhibitor)
export const getRegistrationsCountByEvent = asyncHandler(async (req, res) => {
  const count = await Registration.countDocuments({ event: req.params.eventId })
  res.json({ eventId: req.params.eventId, count })
})

// DELETE /api/v1/registration/:id  (owner ya admin) — cancel registration
export const cancelRegistration = asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id)
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
  await Event.findByIdAndUpdate(registration.event, { $inc: { registeredAttendees: -1 } })

  res.json({ success: true, id: req.params.id })
})