// src/controller/contactController.mjs
import ContactMessage from '../models/ContactMessage.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

// POST /api/v1/contact   (public — koi bhi website ke contact form se bhej sakta hai)
export const createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400)
    throw new Error('Name, email and message are required')
  }

  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    res.status(400)
    throw new Error('Please provide a valid email address')
  }

  const contactMessage = await ContactMessage.create({
    name: name.trim(),
    email: email.trim(),
    subject: subject?.trim() || '',
    message: message.trim(),
  })

  res.status(201).json(contactMessage)
})

// GET /api/v1/contact   (admin only — sab messages, sabse nayi pehle)
export const getContactMessages = asyncHandler(async (req, res) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 })
  const unreadCount = messages.filter((m) => !m.read).length
  res.json({ messages, unreadCount })
})

// PATCH /api/v1/contact/:id/read   (admin only — message ko read mark karna)
export const markContactMessageRead = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id)
  if (!message) {
    res.status(404)
    throw new Error('Message not found')
  }
  message.read = true
  await message.save()
  res.json(message)
})

// DELETE /api/v1/contact/:id   (admin only)
export const deleteContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id)
  if (!message) {
    res.status(404)
    throw new Error('Message not found')
  }
  await message.deleteOne()
  res.json({ message: 'Deleted' })
})
