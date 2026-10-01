// src/controller/exhibitorController.mjs
import Exhibitor from '../models/Exhibitor.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// GET /api/v1/exhibitor
// Public directory listing — supports ?search= and ?category= query params
export const getExhibitors = asyncHandler(async (req, res) => {
  const { search, category } = req.query
  const filter = {}

  if (search) {
    filter.companyName = { $regex: search, $options: 'i' }
  }
  if (category && category !== 'All') {
    filter.category = category
  }

  const exhibitors = await Exhibitor.find(filter)
    .populate('event', 'title date location venue banner')
    .sort({ createdAt: -1 })

  res.json(exhibitors)
})

// GET /api/v1/exhibitor/:id
export const getExhibitorById = asyncHandler(async (req, res) => {
  const exhibitor = await Exhibitor.findById(req.params.id).populate(
    'event',
    'title date location venue banner',
  )
  if (!exhibitor) {
    res.status(404)
    throw new Error('Exhibitor not found')
  }
  res.json(exhibitor)
})

// POST /api/v1/exhibitor  (admin only)
export const createExhibitor = asyncHandler(async (req, res) => {
  const exhibitor = await Exhibitor.create(req.body)
  res.status(201).json(exhibitor)
})

// PUT /api/v1/exhibitor/:id  (admin only)
export const updateExhibitor = asyncHandler(async (req, res) => {
  const exhibitor = await Exhibitor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
  if (!exhibitor) {
    res.status(404)
    throw new Error('Exhibitor not found')
  }
  res.json(exhibitor)
})

// DELETE /api/v1/exhibitor/:id  (admin only)
export const deleteExhibitor = asyncHandler(async (req, res) => {
  const exhibitor = await Exhibitor.findByIdAndDelete(req.params.id)
  if (!exhibitor) {
    res.status(404)
    throw new Error('Exhibitor not found')
  }
  res.json({ success: true, id: req.params.id })
})
