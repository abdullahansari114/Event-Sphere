import express from 'express'
import {
  createEventRequest,
  getMyEventRequests,
  getAllEventRequests,
  updateEventRequestStatus,
  getPublicExhibitors,
  getPublicExhibitorById,
} from '../controller/eventRequestController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const eventRequestRouter = express.Router()

// public — powers the /exhibitors directory + profile pages
eventRequestRouter.get('/public', getPublicExhibitors)
eventRequestRouter.get('/public/:id', getPublicExhibitorById)

eventRequestRouter.post('/', protect, authorize('exhibitor'), createEventRequest)
eventRequestRouter.get('/mine', protect, authorize('exhibitor'), getMyEventRequests)
eventRequestRouter.get('/', protect, authorize('admin'), getAllEventRequests)
eventRequestRouter.put('/:id', protect, authorize('admin'), updateEventRequestStatus)

export default eventRequestRouter
