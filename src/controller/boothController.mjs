import Booth from '../models/Booth.mjs'
import BoothRequest from '../models/BoothRequest.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'


export const assignBooth = asyncHandler(async (req, res) => {
  const { exhibitorId } = req.body
  if (!exhibitorId) {
    res.status(400)
    throw new Error('exhibitorId is required')
  }

  const booth = await Booth.findById(req.params.id)
  if (!booth) {
    res.status(404)
    throw new Error('Booth not found')
  }

  booth.status = 'occupied'
  booth.exhibitor = exhibitorId
  await booth.save()

  await BoothRequest.updateMany(
    { booths: booth._id, status: 'pending' },
    { status: 'rejected' },
  )

  await booth.populate('exhibitor', 'name email')
  res.json(booth)
})

export const unassignBooth = asyncHandler(async (req, res) => {
  const booth = await Booth.findById(req.params.id)
  if (!booth) {
    res.status(404)
    throw new Error('Booth not found')
  }

  booth.status = 'available'
  booth.exhibitor = null
  await booth.save()

  res.json(booth)
})

export const getBoothStats = asyncHandler(async (req, res) => {
  const rows = await Booth.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])

  const stats = { available: 0, reserved: 0, occupied: 0 }
  rows.forEach((r) => {
    if (stats[r._id] !== undefined) stats[r._id] = r.count
  })

  res.json({ ...stats, total: stats.available + stats.reserved + stats.occupied })
})