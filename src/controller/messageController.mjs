// src/controller/messageController.mjs
import mongoose from 'mongoose'
import Message from '../models/Message.mjs'
import User from '../models/User.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'

const USER_FIELDS = 'name email avatar role companyName'

// Naya message DB me save karta hai — socket handler (script.mjs) aur REST route
// (sendMessage neeche) dono isi ek function ko use karte hain, taake logic duplicate na ho
export const createMessage = async ({ sender, receiver, text }) => {
  const message = await Message.create({ sender, receiver, text })
  return Message.findById(message._id)
    .populate('sender', USER_FIELDS)
    .populate('receiver', USER_FIELDS)
}

// GET /api/v1/message/conversations
// Logged-in user (attendee ya exhibitor, koi bhi) ki saari chat threads —
// har doosre insaan ke sath sirf sabse latest message + unread count
export const getConversations = asyncHandler(async (req, res) => {
  const me = req.user._id

  const messages = await Message.find({ $or: [{ sender: me }, { receiver: me }] })
    .sort({ createdAt: -1 })
    .populate('sender', USER_FIELDS)
    .populate('receiver', USER_FIELDS)

  const threads = new Map()

  for (const msg of messages) {
    const iAmSender = String(msg.sender._id) === String(me)
    const other = iAmSender ? msg.receiver : msg.sender
    if (!other) continue // doosra user delete ho chuka ho to skip
    const key = String(other._id)

    if (!threads.has(key)) {
      threads.set(key, {
        user: other,
        lastMessage: msg.text,
        lastMessageAt: msg.createdAt,
        lastSenderIsMe: iAmSender,
        unreadCount: 0,
      })
    }
    // Unread sirf wo messages jo mujhe mile hain aur abhi tak padhe nahi
    if (!iAmSender && !msg.read) {
      threads.get(key).unreadCount += 1
    }
  }

  // messages already latest-first the, isliye Map insertion order khud hi sahi hai
  res.json(Array.from(threads.values()))
})

// GET /api/v1/message/:userId
// Logged-in user aur :userId ke beech ki poori chat — khulte hi unread read mark ho jate hain
export const getConversation = asyncHandler(async (req, res) => {
  const me = req.user._id
  const { userId } = req.params

  if (!mongoose.isValidObjectId(userId)) {
    res.status(400)
    throw new Error('Invalid user id')
  }

  const otherUser = await User.findById(userId).select(USER_FIELDS)
  if (!otherUser) {
    res.status(404)
    throw new Error('User not found')
  }

  const messages = await Message.find({
    $or: [
      { sender: me, receiver: userId },
      { sender: userId, receiver: me },
    ],
  })
    .sort({ createdAt: 1 })
    .populate('sender', USER_FIELDS)
    .populate('receiver', USER_FIELDS)

  // Doosre insaan ne jo mujhe bheja tha wo ab "read" ho gaya (chat open ki hai)
  await Message.updateMany({ sender: userId, receiver: me, read: false }, { $set: { read: true } })

  res.json({ otherUser, messages })
})

// POST /api/v1/message   body: { receiverId, text }
// Socket.io hi live delivery karta hai, ye REST route sirf fallback hai
// (agar kisi wajah se client ka socket connect na ho paye to bhi message chala jaye)
export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, text } = req.body

  if (!receiverId || !text?.trim()) {
    res.status(400)
    throw new Error('receiverId and text are required')
  }
  if (String(receiverId) === String(req.user._id)) {
    res.status(400)
    throw new Error('Cannot message yourself')
  }
  if (!mongoose.isValidObjectId(receiverId)) {
    res.status(400)
    throw new Error('Invalid receiverId')
  }

  const receiverExists = await User.exists({ _id: receiverId })
  if (!receiverExists) {
    res.status(404)
    throw new Error('Receiver not found')
  }

  const message = await createMessage({
    sender: req.user._id,
    receiver: receiverId,
    text: text.trim(),
  })

  // Agar receiver is waqt online hai (uska socket connected hai) to usko turant bhej do
  const io = req.app.get('io')
  if (io) {
    io.to(String(receiverId)).to(String(req.user._id)).emit('receiveMessage', message)
  }

  res.status(201).json(message)
})
