import express from 'express'
import {
  getEventProducts,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controller/productController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'
import { uploadProductImage } from '../middleware/uploadProductImage.mjs'

const productRouter = express.Router()

// public — attendee ke event details page par products dikhane ke liye
productRouter.get('/event/:eventId', getEventProducts)

// exhibitor
productRouter.get('/mine', protect, authorize('exhibitor'), getMyProducts)
productRouter.post('/', protect, authorize('exhibitor'), uploadProductImage, createProduct)

// owner exhibitor (admin bhi moderate kar sakta hai)
productRouter.put('/:id', protect, authorize('exhibitor', 'admin'), uploadProductImage, updateProduct)
productRouter.delete('/:id', protect, authorize('exhibitor', 'admin'), deleteProduct)

export default productRouter
