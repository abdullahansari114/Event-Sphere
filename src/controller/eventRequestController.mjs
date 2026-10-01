import EventRequest from '../models/EventRequest.mjs'
import Event from '../models/Event.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// POST /api/v1/event-request  (exhibitor only)
export const createEventRequest = asyncHandler(async (req, res) => {
  const { eventId, message } = req.body

  if (!eventId) {
    res.status(400)
    throw new Error('eventId is required')
  }

  const event = await Event.findById(eventId)
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }

  const existing = await EventRequest.findOne({
    event: eventId,
    exhibitor: req.user._id,
    status: { $in: ['pending', 'approved'] },
  })
  if (existing) {
    res.status(400)
    throw new Error('You already have a request for this event')
  }

  const request = await EventRequest.create({
    event: eventId,
    exhibitor: req.user._id,
    message: message || '',
  })

  const populated = await request.populate('event', 'title date location banner')
  res.status(201).json(populated)
})

// GET /api/v1/event-request/mine  (exhibitor only)
export const getMyEventRequests = asyncHandler(async (req, res) => {
  const requests = await EventRequest.find({ exhibitor: req.user._id })
    .populate('event', 'title date location banner status')
    .sort({ createdAt: -1 })
  res.json(requests)
})

// GET /api/v1/event-request  (admin only)
export const getAllEventRequests = asyncHandler(async (req, res) => {
  const requests = await EventRequest.find()
    .populate('event', 'title date location')
    .populate('exhibitor', 'name email')
    .sort({ createdAt: -1 })
  res.json(requests)
})

// GET /api/v1/event-request/public  (public — powers the Exhibitors Directory page)
// Ek approved EventRequest hi ek "exhibitor directory" entry hai — same data jo
// admin ke "Exhibitors" (join requests) page mein dikhti hai, bas status=approved
// tak limited aur company profile fields ke sath.
export const getPublicExhibitors = asyncHandler(async (req, res) => {
  const { search, category } = req.query

  let requests = await EventRequest.find({ status: 'approved' })
    .populate(
      'exhibitor',
      'name email companyName category description website phone address boothNumber products',
    )
    .populate('event', 'title date location venue banner')
    .sort({ createdAt: -1 })

  if (search) {
    const q = search.toLowerCase()
    requests = requests.filter((r) =>
      (r.exhibitor?.companyName || r.exhibitor?.name || '').toLowerCase().includes(q),
    )
  }
  if (category && category !== 'All') {
    requests = requests.filter((r) => r.exhibitor?.category === category)
  }

  res.json(requests)
})

// GET /api/v1/event-request/public/:id  (public — single exhibitor profile page)
export const getPublicExhibitorById = asyncHandler(async (req, res) => {
  const request = await EventRequest.findOne({ _id: req.params.id, status: 'approved' })
    .populate(
      'exhibitor',
      'name email companyName category description website phone address boothNumber products',
    )
    .populate('event', 'title date location venue banner')

  if (!request) {
    res.status(404)
    throw new Error('Exhibitor not found')
  }
  res.json(request)
})
export const updateEventRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400)
    throw new Error('Status must be approved or rejected')
  }

  const request = await EventRequest.findById(req.params.id)
  if (!request) {
    res.status(404)
    throw new Error('Request not found')
  }

  const wasApproved = request.status === 'approved'
  request.status = status
  await request.save()

  if (status === 'approved' && !wasApproved) {
    await Event.findByIdAndUpdate(request.event, { $inc: { exhibitorCount: 1 } })
  }
  if (status === 'rejected' && wasApproved) {
    await Event.findByIdAndUpdate(request.event, { $inc: { exhibitorCount: -1 } })
  }

  await request.populate('event', 'title date location')
  await request.populate('exhibitor', 'name email')

  res.json(request)
})