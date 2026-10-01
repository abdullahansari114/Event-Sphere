import BoothRequest from '../models/BoothRequest.mjs'
import Booth from '../models/Booth.mjs'
import EventRequest from '../models/EventRequest.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// Check karta hai ke di gayi booths (row/col) aapas mein ek connected group banati hain
// (sirf sath-sath — upar/neeche/left/right — diagonal allow nahi)
const isContiguousGroup = (booths) => {
  if (booths.length <= 1) return true
  const keySet = new Set(booths.map((b) => `${b.row}-${b.col}`))
  const visited = new Set()
  const stack = [booths[0]]
  visited.add(`${booths[0].row}-${booths[0].col}`)

  while (stack.length) {
    const cur = stack.pop()
    const neighbors = [
      [cur.row - 1, cur.col], [cur.row + 1, cur.col],
      [cur.row, cur.col - 1], [cur.row, cur.col + 1],
    ]
    for (const [r, c] of neighbors) {
      const key = `${r}-${c}`
      if (keySet.has(key) && !visited.has(key)) {
        visited.add(key)
        stack.push({ row: r, col: c })
      }
    }
  }
  return visited.size === booths.length
}

// POST /api/v1/booth-request  (exhibitor only)
export const createBoothRequest = asyncHandler(async (req, res) => {
  const { boothIds, message } = req.body

  if (!Array.isArray(boothIds) || boothIds.length === 0) {
    res.status(400)
    throw new Error('Kam az kam 1 booth select karein')
  }

  const booths = await Booth.find({ _id: { $in: boothIds } })
  if (booths.length !== boothIds.length) {
    res.status(404)
    throw new Error('Kuch booths nahi mili')
  }

  const eventId = String(booths[0].event)
  if (booths.some((b) => String(b.event) !== eventId)) {
    res.status(400)
    throw new Error('Sab booths ek hi event ki honi chahiye')
  }

  if (booths.some((b) => b.status !== 'available')) {
    res.status(400)
    throw new Error('In mein se kuch booths ab available nahi hain')
  }

  if (!isContiguousGroup(booths)) {
    res.status(400)
    throw new Error('Selected booths aapas mein paas-paas (adjacent) honi chahiye')
  }

  const approvedEvent = await EventRequest.findOne({ event: eventId, exhibitor: req.user._id, status: 'approved' })
  if (!approvedEvent) {
    res.status(403)
    throw new Error('Pehle is event ki join request approve honi chahiye')
  }

  const request = await BoothRequest.create({
    event: eventId,
    booths: boothIds,
    exhibitor: req.user._id,
    message: message || '',
  })

  await Booth.updateMany({ _id: { $in: boothIds } }, { status: 'reserved' })

  await request.populate('booths')
  await request.populate('event', 'title date location')
  res.status(201).json(request)
})

export const getMyBoothRequests = asyncHandler(async (req, res) => {
  const requests = await BoothRequest.find({ exhibitor: req.user._id })
    .populate('booths')
    .populate('event', 'title date location')
    .sort({ createdAt: -1 })
  res.json(requests)
})

export const getAllBoothRequests = asyncHandler(async (req, res) => {
  const requests = await BoothRequest.find()
    .populate('booths')
    .populate('event', 'title date location')
    .populate('exhibitor', 'name email')
    .sort({ createdAt: -1 })
  res.json(requests)
})

export const updateBoothRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400)
    throw new Error('Status must be approved or rejected')
  }

  const request = await BoothRequest.findById(req.params.id)
  if (!request) {
    res.status(404)
    throw new Error('Request not found')
  }

  request.status = status
  await request.save()

  if (status === 'approved') {
    await Booth.updateMany(
      { _id: { $in: request.booths } },
      { status: 'occupied', exhibitor: request.exhibitor },
    )
    await BoothRequest.updateMany(
      { booths: { $in: request.booths }, status: 'pending', _id: { $ne: request._id } },
      { status: 'rejected' },
    )
  } else {
    await Booth.updateMany(
      { _id: { $in: request.booths }, status: 'reserved' },
      { status: 'available' },
    )
  }

  await request.populate('booths')
  await request.populate('exhibitor', 'name email')
  await request.populate('event', 'title date location')
  res.json(request)
})