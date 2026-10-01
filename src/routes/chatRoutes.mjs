// src/routes/chatRoutes.mjs
import express from 'express'
import { sendChatMessage, getChatStatus } from '../controller/chatController.mjs'

const chatRouter = express.Router()

// Public — website ke chat widget se yahin par message aata hai, login zaroori nahi
chatRouter.post('/', sendChatMessage)
chatRouter.get('/status', getChatStatus)

export default chatRouter
