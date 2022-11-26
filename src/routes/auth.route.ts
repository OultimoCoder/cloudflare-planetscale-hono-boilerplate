import { Hono } from 'hono'
import * as authController from '../controllers/auth.controller'
import { auth } from '../middlewares/auth'

const route = new Hono<{ Bindings: Bindings }>()

route.post('/register', authController.register)
route.post('/login', authController.login)
route.post('/refresh-tokens', authController.refreshTokens)
route.post('/forgot-password', authController.forgotPassword)
route.post('/reset-password', authController.resetPassword)
route.post('/change-password', authController.changePassword)
route.post('/send-verification-email', auth(), authController.sendVerificationEmail)
route.post('/verify-email', authController.verifyEmail)

export {
  route
}
