// src/routes/exhibitorRoutes.mjs
import express from 'express'
import {
  getExhibitors,
  getExhibitorById,
  createExhibitor,
  updateExhibitor,
  deleteExhibitor,
} from '../controller/exhibitorController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const exhibitorRouter = express.Router()

// public routes — koi bhi directory aur profile dekh sake
exhibitorRouter.get('/', getExhibitors)
exhibitorRouter.get('/:id', getExhibitorById)

// admin only routes
exhibitorRouter.post('/', protect, authorize('admin'), createExhibitor)
exhibitorRouter.put('/:id', protect, authorize('admin'), updateExhibitor)
exhibitorRouter.delete('/:id', protect, authorize('admin'), deleteExhibitor)

export default exhibitorRouter
