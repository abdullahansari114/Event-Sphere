import { randomBytes, createHash } from 'crypto'
import generateToken from '../utils/generateToken.mjs'
import asyncHandler from '../utils/asyncHandler.mjs'
import sendEmail from '../utils/sendMail.mjs'
import { findOne, create, findById } from '../models/User.mjs'
import { v2 as cloudinary } from 'cloudinary'

// Frontend ke user object jaisa response bhejne ke liye helper
const shapeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  companyId: user.companyId || undefined,
  companyName: user.companyName,
  category: user.category,
  description: user.description,
  website: user.website,
  address: user.address,
  boothNumber: user.boothNumber,
  products: user.products,
  createdAt: user.createdAt,
})

// Token ko httpOnly cookie mein set karne ka helper — sab jagah reuse hoga
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true, // JS se access nahi ho sakti (XSS se safe)
    secure: process.env.NODE_ENV === 'production', // production mein sirf HTTPS pe bhejo
    sameSite: 'lax', // CSRF se basic protection
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 din
  })
}

// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body

  if (!name || !email || !password) {
    res.status(400)
    throw new Error('Please provide name, email and password')
  }

  const userExists = await findOne({ email: email.toLowerCase() })
  if (userExists) {
    res.status(400)
    throw new Error('User already exists with this email')
  }

  const user = await create({
    name,
    email,
    password,
    role: ['admin', 'exhibitor', 'attendee'].includes(role) ? role : 'attendee',
  })

  const token = generateToken(user._id)
  setTokenCookie(res, token)
  res.status(201).json({ user: shapeUser(user) })
})

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  const user = await findOne({ email: email.toLowerCase() }).select('+password')

  if (!user || !(await user.matchPassword(password))) {
    res.status(401)
    throw new Error('Invalid email or password')
  }

  const token = generateToken(user._id)
  setTokenCookie(res, token)
  res.json({ user: shapeUser(user) })
})

// @route POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  res.json({ success: true })
})

// @route POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body
  const user = await findOne({ email: email?.toLowerCase() })

  if (!user) {
    return res.json({ success: true })
  }

  const resetToken = randomBytes(32).toString('hex')
  user.resetPasswordToken = createHash('sha256').update(resetToken).digest('hex')
  user.resetPasswordExpire = Date.now() + 30 * 60 * 1000
  await user.save()

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`

  const message = `
    <h2>Password Reset Request</h2>
    <p>Aapne apna password reset karne ki request ki hai. Neeche diye link par click karein (30 minute valid hai):</p>
    <a href="${resetUrl}" target="_blank">${resetUrl}</a>
    <p>Agar aapne ye request nahi ki, is email ko ignore kar dein.</p>
  `

  try {
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: message,
    })
    res.json({ success: true })
  } catch (error) {
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined
    await user.save()

    console.log('Email sending failed:', error.message)
    res.status(500)
    throw new Error('Email could not be sent')
  }
})

// @route POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body

  const hashedToken = createHash('sha256').update(token || '').digest('hex')

  const user = await findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire +password')

  if (!user) {
    res.status(400)
    throw new Error('Invalid or expired reset token')
  }

  user.password = password
  user.resetPasswordToken = undefined
  user.resetPasswordExpire = undefined
  await user.save()

  res.json({ success: true })
})

// @route GET /api/auth/me  (bonus route: current logged in user check karne ke liye)
const getMe = asyncHandler(async (req, res) => {
  res.json({ user: shapeUser(req.user) })
})

// @route PUT /api/auth/profile  (logged in user apna profile update kare)
// Exhibitor apni company info (companyName, category, description, website,
// phone, address, boothNumber, products) yahin se fill karta hai — wahi info
// jo public /exhibitors directory par dikhti hai.
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name',
    'phone',
    'companyName',
    'category',
    'description',
    'website',
    'address',
    'boothNumber',
    'products',
  ]

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      req.user[field] = req.body[field]
    }
  })

  await req.user.save()
  res.json({ user: shapeUser(req.user) })
})

// Google OAuth se aaye hue user ke liye — passport ne user already find/create kar
// diya hota hai (script.mjs ki GoogleStrategy me), yahan bas usi tarah ka JWT cookie
// issue karna hai jaisa normal login/register me hota hai, taake baaki poori app
// (protect middleware, /me, etc.) bina kisi farq ke kaam kare.
const googleLoginSuccess = (user, res) => {
  const token = generateToken(user._id)
  setTokenCookie(res, token)
  return shapeUser(user)
}

// @route PUT /api/v1/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    res.status(400)
    throw new Error('Please provide your current and new password')
  }

  if (newPassword.length < 6) {
    res.status(400)
    throw new Error('New password must be at least 6 characters')
  }

  // req.user (protect middleware se) mein password select:false hota hai,
  // isliye dobara +password ke sath fetch karna padega
  const user = await findById(req.user._id).select('+password')

  if (!user.password) {
    res.status(400)
    throw new Error('This account signed in with Google and has no password set')
  }

  const isMatch = await user.matchPassword(currentPassword)
  if (!isMatch) {
    res.status(401)
    throw new Error('Current password is incorrect')
  }

  user.password = newPassword
  await user.save()

  res.json({ success: true })
})

// @route POST /api/v1/auth/avatar  (multipart/form-data, field name: "avatar")
// uploadAvatar middleware (Cloudinary storage) req.file mein secure URL (.path)
// aur public_id (.filename) de deta hai — koi local file system involve nahi hai.
const uploadAvatarHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('Please select an image to upload')
  }

  // Purani Cloudinary image ho to wahan se bhi hata do — storage saaf rahe
  if (req.user.avatarPublicId) {
    await cloudinary.uploader.destroy(req.user.avatarPublicId).catch(() => {})
  }

  req.user.avatar = req.file.path // Cloudinary secure URL
  req.user.avatarPublicId = req.file.filename // Cloudinary public_id, delete ke liye chahiye
  await req.user.save()

  res.json({ user: shapeUser(req.user) })
})

// @route DELETE /api/v1/auth/avatar  (photo hata ke wapas initials pe)
const removeAvatar = asyncHandler(async (req, res) => {
  if (req.user.avatarPublicId) {
    await cloudinary.uploader.destroy(req.user.avatarPublicId).catch(() => {})
  }
  req.user.avatar = ''
  req.user.avatarPublicId = ''
  await req.user.save()

  res.json({ user: shapeUser(req.user) })
})

export default {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  googleLoginSuccess,
  shapeUser,
  changePassword,
  uploadAvatarHandler,
  removeAvatar,
}
