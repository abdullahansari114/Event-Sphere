// src/routes/messageRoutes.mjs
import express from 'express'
import { getConversations, getConversation, sendMessage } from '../controller/messageController.mjs'
import { protect } from '../middleware/auth.mjs'

const messageRouter = express.Router()

// Chat feature sirf logged-in users (attendee ya exhibitor, koi bhi) ke liye hai
messageRouter.use(protect)

messageRouter.get('/conversations', getConversations) // saari threads (list, left sidebar)
messageRouter.get('/:userId', getConversation) // ek specific insaan ke sath poori chat
messageRouter.post('/', sendMessage) // REST fallback (socket na chale to)

export default messageRouter
