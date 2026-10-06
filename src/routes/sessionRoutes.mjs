import express from 'express'
import {
  createSession, updateSession, deleteSession,
  getSessionById, getAllSessionsAdmin, getAllSessionsPublic, getSpeakerSuggestions,
} from '../controller/sessionController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const sessionRouter = express.Router()

// Specific routes pehle, taake '/:id' se clash na ho
sessionRouter.get('/public/all', getAllSessionsPublic)
sessionRouter.get('/speakers', getSpeakerSuggestions)
sessionRouter.get('/', protect, authorize('admin'), getAllSessionsAdmin)
sessionRouter.post('/', protect, authorize('admin'), createSession)
sessionRouter.get('/:id', getSessionById)
sessionRouter.put('/:id', protect, authorize('admin'), updateSession)
sessionRouter.delete('/:id', protect, authorize('admin'), deleteSession)

export default sessionRouter
