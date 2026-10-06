import FloorPlan from '../models/FloorPlan.mjs'
import Booth from '../models/Booth.mjs'
import Event from '../models/Event.mjs'
import EventRequest from '../models/EventRequest.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

const isApprovedExhibitor = async (eventId, exhibitorId) => {
  const found = await EventRequest.findOne({ event: eventId, exhibitor: exhibitorId, status: 'approved' })
  return !!found
}

// GET /api/v1/floorplan/:eventId
export const getGrid = asyncHandler(async (req, res) => {
  const { eventId } = req.params

  const event = await Event.findById(eventId)
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }

  if (req.user.role === 'exhibitor') {
    const approved = await isApprovedExhibitor(eventId, req.user._id)
    if (!approved) {
      res.status(403)
      throw new Error('Aap is event ke approved exhibitor nahi hain')
    }
  }

  const floorPlan = await FloorPlan.findOne({ event: eventId })
  const booths = await Booth.find({ event: eventId }).populate('exhibitor', 'name email').sort({ row: 1, col: 1 })

  res.json({ rows: floorPlan?.rows || 0, cols: floorPlan?.cols || 0, booths })
})

// PUT /api/v1/floorplan/:eventId/grid  (admin only) — grid generate/resize karta hai
export const generateGrid = asyncHandler(async (req, res) => {
  const { eventId } = req.params
  const rows = Number(req.body.rows)
  const cols = Number(req.body.cols)

  if (!rows || !cols || rows < 1 || cols < 1 || rows > 50 || cols > 50) {
    res.status(400)
    throw new Error('Rows/Cols 1 se 50 ke beech honi chahiye')
  }

  const event = await Event.findById(eventId)
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }

  const existing = await Booth.find({ event: eventId })

  // Jo booths naye grid ke bahar chali jayengi, agar wo reserved/occupied hain to
  // pehle admin ko unassign karna hoga — data loss se bachne ke liye
  const outOfBounds = existing.filter((b) => b.row > rows || b.col > cols)
  const blocked = outOfBounds.filter((b) => b.status !== 'available')
  if (blocked.length) {
    res.status(400)
    throw new Error(`${blocked.length} booth(s) reserved/occupied hain jo naye grid se bahar aa rahi hain. Pehle unhe unassign karein.`)
  }
  if (outOfBounds.length) {
    await Booth.deleteMany({ _id: { $in: outOfBounds.map((b) => b._id) } })
  }

  // Grid ke andar jo booths missing hain unhe create karo
  const existingKeys = new Set(existing.filter((b) => b.row <= rows && b.col <= cols).map((b) => `${b.row}-${b.col}`))
  const toCreate = []
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (!existingKeys.has(`${r}-${c}`)) {
        toCreate.push({ event: eventId, row: r, col: c, boothNumber: `R${r}-C${c}` })
      }
    }
  }
  if (toCreate.length) await Booth.insertMany(toCreate)

  await FloorPlan.findOneAndUpdate(
    { event: eventId },
    { rows, cols },
    { upsert: true, returnDocument: 'after' },
  )

  const booths = await Booth.find({ event: eventId }).populate('exhibitor', 'name email').sort({ row: 1, col: 1 })
  res.json({ rows, cols, booths })
})