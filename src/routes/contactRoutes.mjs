// src/routes/contactRoutes.mjs
import express from 'express'
import {
  createContactMessage,
  getContactMessages,
  markContactMessageRead,
  deleteContactMessage,
} from '../controller/contactController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const contactRouter = express.Router()

// Public — website ke Contact page ka form isi route par POST karta hai
contactRouter.post('/', createContactMessage)

// Admin only — dashboard mein saare contact messages dekhna/manage karna
contactRouter.get('/', protect, authorize('admin'), getContactMessages)
contactRouter.patch('/:id/read', protect, authorize('admin'), markContactMessageRead)
contactRouter.delete('/:id', protect, authorize('admin'), deleteContactMessage)

export default contactRouter
