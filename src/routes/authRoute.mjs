import { Router } from 'express'
import authController from '../controller/authController.mjs';
import { protect } from '../middleware/auth.mjs';
import uploadAvatar from '../middleware/uploadAvatar.mjs';

const { register, login, logout, forgotPassword, resetPassword, getMe, updateProfile, changePassword, uploadAvatarHandler, removeAvatar,} = authController;

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.get('/me', protect, getMe)
router.put('/profile', protect, updateProfile)
router.put('/change-password', protect, changePassword)
router.post('/avatar', protect, uploadAvatar.single('avatar'), uploadAvatarHandler)
router.delete('/avatar', protect, removeAvatar)

export default router
