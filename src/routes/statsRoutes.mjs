import express from 'express'
import { getPublicStats, getAdminStats } from '../controller/statsController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const statsRouter = express.Router()

// public — home page ka Live Analytics section
statsRouter.get('/public', getPublicStats)

// admin only — admin Analytics page
statsRouter.get('/admin', protect, authorize('admin'), getAdminStats)

export default statsRouter
