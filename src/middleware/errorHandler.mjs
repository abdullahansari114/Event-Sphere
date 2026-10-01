// Koi bhi route jo exist nahi karta, uske liye
const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`)
  res.status(404)
  next(error)
}

// Saare errors yahan aa kar ek jaisi shape me response bante hain
// controllers me hum sirf 'throw new Error(...)' ya 'next(err)' karenge, ye handler UI ke liye JSON banayega
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode
  let message = err.message

  // Mongoose "invalid ObjectId" error
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404
    message = 'Resource not found'
  }

  // Mongoose duplicate key error (e.g. same email dubara register)
  if (err.code === 11000) {
    statusCode = 400
    message = `Duplicate value entered for field: ${Object.keys(err.keyValue)}`
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ')
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  })
}

export default { notFound, errorHandler }
