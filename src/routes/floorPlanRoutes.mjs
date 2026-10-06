import express from 'express'
import { getGrid, generateGrid } from '../controller/floorPlanController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const floorPlanRouter = express.Router()

floorPlanRouter.get('/:eventId', protect, authorize('admin', 'exhibitor'), getGrid)
floorPlanRouter.put('/:eventId/grid', protect, authorize('admin'), generateGrid)

export default floorPlanRouter