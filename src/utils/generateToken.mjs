import jwt from 'jsonwebtoken'

// User ki id se ek JWT token banata hai jo login/register ke waqt bheja jayega
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

export default generateToken
