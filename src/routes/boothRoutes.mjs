import express from 'express'
import { assignBooth, unassignBooth, getBoothStats } from '../controller/boothController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const boothRouter = express.Router()

boothRouter.get('/stats/summary', protect, authorize('admin'), getBoothStats)
boothRouter.put('/:id/assign', protect, authorize('admin'), assignBooth)
boothRouter.put('/:id/unassign', protect, authorize('admin'), unassignBooth)

export default boothRouter
