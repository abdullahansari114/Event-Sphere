import mongoose from 'mongoose'
import Event from '../models/Event.mjs'
import EventRequest from '../models/EventRequest.mjs'
import FloorPlan from '../models/FloorPlan.mjs'
import Booth from '../models/Booth.mjs'
import Product from '../models/Product.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// GET /api/v1/event-public/:eventId   (PUBLIC — attendee event page ke tabs ke liye)
// Ek hi call me: is event ke approved exhibitors, floor plan (booths) aur counts.
// Private cheezein (email, phone) yahan nahi bheji jaati.
export const getEventPublicInfo = asyncHandler(async (req, res) => {
  const { eventId } = req.params
  if (!mongoose.isValidObjectId(eventId)) {
    res.status(400)
    throw new Error('Invalid event id')
  }

  const event = await Event.findById(eventId).select('_id')
  if (!event) {
    res.status(404)
    throw new Error('Event not found')
  }

  const [requests, floorPlan, booths, products] = await Promise.all([
    EventRequest.find({ event: eventId, status: 'approved' }).populate(
      'exhibitor',
      'name companyName category description avatar',
    ),
    FloorPlan.findOne({ event: eventId }).lean(),
    Booth.find({ event: eventId }).populate('exhibitor', 'name companyName').sort({ row: 1, col: 1 }).lean(),
    Product.find({ event: eventId }).select('exhibitor').lean(),
  ])

  // Har exhibitor ke kitne products hain
  const productCount = new Map()
  products.forEach((p) => productCount.set(String(p.exhibitor), (productCount.get(String(p.exhibitor)) || 0) + 1))

  // Har exhibitor ki booth numbers (sirf occupied)
  const boothsByExhibitor = new Map()
  booths.forEach((b) => {
    if (b.status !== 'occupied' || !b.exhibitor) return
    const key = String(b.exhibitor._id)
    if (!boothsByExhibitor.has(key)) boothsByExhibitor.set(key, [])
    boothsByExhibitor.get(key).push(b.boothNumber)
  })

  const byId = new Map()
  requests.forEach((r) => {
    if (!r.exhibitor) return
    const key = String(r.exhibitor._id)
    byId.set(key, {
      _id: r.exhibitor._id,
      profileId: r._id, // /exhibitors/:id (public profile) isi id se khulta hai
      name: r.exhibitor.name,
      companyName: r.exhibitor.companyName || r.exhibitor.name,
      category: r.exhibitor.category || '',
      description: r.exhibitor.description || '',
      avatar: r.exhibitor.avatar || '',
      booths: (boothsByExhibitor.get(key) || []).sort(),
      productCount: productCount.get(key) || 0,
    })
  })
  const exhibitors = [...byId.values()].sort((a, b) => a.companyName.localeCompare(b.companyName))

  const gridBooths = booths.map((b) => ({
    _id: b._id,
    row: b.row,
    col: b.col,
    boothNumber: b.boothNumber,
    status: b.status,
    exhibitor:
      b.status === 'occupied' && b.exhibitor
        ? { _id: b.exhibitor._id, companyName: b.exhibitor.companyName || b.exhibitor.name }
        : null,
  }))

  res.json({
    exhibitors,
    floorPlan: { rows: floorPlan?.rows || 0, cols: floorPlan?.cols || 0, booths: gridBooths },
    stats: {
      exhibitors: exhibitors.length,
      totalBooths: gridBooths.length,
      occupiedBooths: gridBooths.filter((b) => b.status === 'occupied').length,
      availableBooths: gridBooths.filter((b) => b.status === 'available').length,
    },
  })
})
