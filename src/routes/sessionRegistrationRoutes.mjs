import express from 'express'
import {
  registerForSession, getMyRegistrations, getAllRegistrations,
  updateRegistrationStatus, cancelRegistration,
} from '../controller/sessionRegistrationController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const sessionRegistrationRouter = express.Router()

sessionRegistrationRouter.post('/', protect, registerForSession)
sessionRegistrationRouter.get('/mine', protect, getMyRegistrations)
sessionRegistrationRouter.get('/', protect, authorize('admin'), getAllRegistrations)
sessionRegistrationRouter.put('/:id', protect, authorize('admin'), updateRegistrationStatus)
sessionRegistrationRouter.delete('/:id', protect, cancelRegistration)

export default sessionRegistrationRouter
