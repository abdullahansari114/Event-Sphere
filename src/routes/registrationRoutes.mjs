import express from 'express'
import {
  registerForEvent,
  getMyRegistrations,
  getAllRegistrations,
  getRegistrationsCountByEvent,
  cancelRegistration,
} from '../controller/registrationController.mjs'
import { protect, authorize } from '../middleware/auth.mjs'

const registrationRouter = express.Router()

registrationRouter.post('/', protect, registerForEvent)
registrationRouter.get('/mine', protect, getMyRegistrations)
registrationRouter.get('/', protect, authorize('admin'), getAllRegistrations)
registrationRouter.get('/event/:eventId', protect, getRegistrationsCountByEvent)
registrationRouter.delete('/:id', protect, cancelRegistration)

export default registrationRouter
