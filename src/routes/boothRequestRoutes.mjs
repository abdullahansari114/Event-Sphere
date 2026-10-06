import express from 'express'
import {
  createBoothRequest,
  getMyBoothRequests,
  getAllBoothRequests,
  updateBoothRequestStatus,
} from '../controller/boothRequestController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const boothRequestRouter = express.Router()

boothRequestRouter.post('/', protect, authorize('exhibitor'), createBoothRequest)
boothRequestRouter.get('/mine', protect, authorize('exhibitor'), getMyBoothRequests)
boothRequestRouter.get('/', protect, authorize('admin'), getAllBoothRequests)
boothRequestRouter.put('/:id', protect, authorize('admin'), updateBoothRequestStatus)

export default boothRequestRouter