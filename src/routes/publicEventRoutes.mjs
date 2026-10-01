import express from 'express'
import { getEventPublicInfo } from '../controller/publicEventController.mjs'

const publicEventRouter = express.Router()

// public — login ki zaroorat nahi
publicEventRouter.get('/:eventId', getEventPublicInfo)

export default publicEventRouter
