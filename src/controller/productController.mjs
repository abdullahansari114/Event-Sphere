import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import Product from '../models/Product.mjs'
import Event from '../models/Event.mjs'
import EventRequest from '../models/EventRequest.mjs'
import Booth from '../models/Booth.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

const TYPES = ['product', 'service']

// '' / undefined => null (Contact for price), warna number; galat value => NaN
const parsePrice = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

const destroyImage = async (publicId) => {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch {
    // image delete fail ho to bhi request fail nahi honi chahiye
  }
}

// Validation fail ho to jo image abhi upload hui thi wo bhi Cloudinary se hata do
const reject = async (req, res, status, message) => {
  if (req.file?.filename) await destroyImage(req.file.filename)
  res.status(status)
  throw new Error(message)
}

// ------------------------------------------------------------------
// GET /api/v1/product/event/:eventId   (PUBLIC — attendee event page)
// Sirf un exhibitors ke products jinki is event ki request approved hai.
// Har product ke sath exhibitor ki info + unki booth numbers bhi aati hain.
// ------------------------------------------------------------------
export const getEventProducts = asyncHandler(async (req, res) => {
  const { eventId } = req.params
  if (!mongoose.isValidObjectId(eventId)) {
    res.status(400)
    throw new Error('Invalid event id')
  }

  const requests = await EventRequest.find({ event: eventId, status: 'approved' }).populate(
    'exhibitor',
    'name companyName category avatar',
  )

  const infoByExhibitor = new Map()
  requests.forEach((r) => {
    if (!r.exhibitor) return
    infoByExhibitor.set(String(r.exhibitor._id), {
      _id: r.exhibitor._id,
      name: r.exhibitor.name,
      companyName: r.exhibitor.companyName || r.exhibitor.name,
      category: r.exhibitor.category || '',
      avatar: r.exhibitor.avatar || '',
      profileId: r._id, // /exhibitors/:id (public profile) isi id se khulta hai
      booths: [],
    })
  })

  const exhibitorIds = [...infoByExhibitor.keys()]
  if (exhibitorIds.length === 0) return res.json([])

  const [products, booths] = await Promise.all([
    Product.find({ event: eventId, exhibitor: { $in: exhibitorIds } })
      .select('-imagePublicId')
      .sort({ createdAt: -1 })
      .lean(),
    Booth.find({ event: eventId, exhibitor: { $in: exhibitorIds }, status: 'occupied' })
      .select('exhibitor boothNumber')
      .lean(),
  ])

  booths.forEach((b) => infoByExhibitor.get(String(b.exhibitor))?.booths.push(b.boothNumber))
  infoByExhibitor.forEach((info) => info.booths.sort())

  res.json(products.map((p) => ({ ...p, exhibitor: infoByExhibitor.get(String(p.exhibitor)) })))
})

// ------------------------------------------------------------------
// GET /api/v1/product/mine   (exhibitor)
// ------------------------------------------------------------------
export const getMyProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ exhibitor: req.user._id })
    .select('-imagePublicId')
    .populate('event', 'title date location banner')
    .sort({ createdAt: -1 })
  res.json(products)
})

// ------------------------------------------------------------------
// POST /api/v1/product   (exhibitor, multipart/form-data, image field: "image")
// ------------------------------------------------------------------
export const createProduct = asyncHandler(async (req, res) => {
  const { eventId, type = 'product', name, category, description } = req.body
  const price = parsePrice(req.body.price)

  if (!name || !name.trim()) return reject(req, res, 400, 'Product name is required')
  if (!TYPES.includes(type)) return reject(req, res, 400, 'Type must be product or service')
  if (Number.isNaN(price)) return reject(req, res, 400, 'Price must be a positive number')
  if (!eventId || !mongoose.isValidObjectId(eventId)) return reject(req, res, 400, 'Please select an event')
  if (description && description.length > 600) return reject(req, res, 400, 'Description can be max 600 characters')

  const event = await Event.findById(eventId)
  if (!event) return reject(req, res, 404, 'Event not found')

  // Sirf wo exhibitor products daal sake jiski is event ki request approve ho chuki hai
  const approved = await EventRequest.findOne({ event: eventId, exhibitor: req.user._id, status: 'approved' })
  if (!approved) return reject(req, res, 403, 'Pehle is event ki join request approve honi chahiye')

  const product = await Product.create({
    event: eventId,
    exhibitor: req.user._id,
    type,
    name,
    category: category || '',
    description: description || '',
    price,
    image: req.file?.path || '',
    imagePublicId: req.file?.filename || '',
  })

  await product.populate('event', 'title date location banner')
  const obj = product.toObject()
  delete obj.imagePublicId
  res.status(201).json(obj)
})

// ------------------------------------------------------------------
// PUT /api/v1/product/:id   (owner exhibitor ya admin)
// Event change nahi hota — event badalna ho to naya product banayein.
// ------------------------------------------------------------------
export const updateProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return reject(req, res, 404, 'Product not found')

  const product = await Product.findById(req.params.id)
  if (!product) return reject(req, res, 404, 'Product not found')

  const isOwner = String(product.exhibitor) === String(req.user._id)
  if (!isOwner && req.user.role !== 'admin') return reject(req, res, 403, 'Not allowed to edit this product')

  const { type, name, category, description } = req.body

  if (name !== undefined) {
    if (!name.trim()) return reject(req, res, 400, 'Product name is required')
    product.name = name
  }
  if (type !== undefined) {
    if (!TYPES.includes(type)) return reject(req, res, 400, 'Type must be product or service')
    product.type = type
  }
  if (category !== undefined) product.category = category
  if (description !== undefined) {
    if (description.length > 600) return reject(req, res, 400, 'Description can be max 600 characters')
    product.description = description
  }
  if (req.body.price !== undefined) {
    const price = parsePrice(req.body.price)
    if (Number.isNaN(price)) return reject(req, res, 400, 'Price must be a positive number')
    product.price = price
  }

  if (req.file) {
    await destroyImage(product.imagePublicId) // purani image hata do
    product.image = req.file.path
    product.imagePublicId = req.file.filename
  } else if (req.body.removeImage === 'true') {
    await destroyImage(product.imagePublicId)
    product.image = ''
    product.imagePublicId = ''
  }

  await product.save()
  await product.populate('event', 'title date location banner')
  const obj = product.toObject()
  delete obj.imagePublicId
  res.json(obj)
})

// ------------------------------------------------------------------
// DELETE /api/v1/product/:id   (owner exhibitor ya admin)
// ------------------------------------------------------------------
export const deleteProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404)
    throw new Error('Product not found')
  }

  const product = await Product.findById(req.params.id)
  if (!product) {
    res.status(404)
    throw new Error('Product not found')
  }

  const isOwner = String(product.exhibitor) === String(req.user._id)
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not allowed to delete this product')
  }

  await destroyImage(product.imagePublicId)
  await product.deleteOne()
  res.json({ success: true, id: req.params.id })
})
