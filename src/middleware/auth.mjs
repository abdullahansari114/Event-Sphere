import jwt from 'jsonwebtoken'
import User from '../models/User.mjs'

// Ye middleware check karta hai ke request ke sath valid token aaya hai ya nahi
export const protect = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id) // baaki controllers me req.user use hoga
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' })
    }
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' })
  }
}

// Role-based access: sirf diye gaye roles hi is route ko access kar sakein
// Usage: authorize('admin') ya authorize('admin', 'exhibitor')
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to access this route' })
    }
    next()
  }
}