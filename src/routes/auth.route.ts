import { Hono } from 'hono'
import * as authController from '../controllers/auth.controller'
import { auth } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rateLimiter'

const route = new Hono<{ Bindings: Bindings }>()
const twoMinutes = 120
const oneRequest = 1

route.post('/register', authController.register)
route.post('/login', authController.login)
route.post('/refresh-tokens', authController.refreshTokens)
route.post('/forgot-password', authController.forgotPassword)
route.post('/reset-password', authController.resetPassword)
route.post('/change-password', authController.changePassword)
route.post(
  '/send-verification-email',
  auth(),
  rateLimit(twoMinutes, oneRequest),
  authController.sendVerificationEmail
)
route.post('/verify-email', authController.verifyEmail)

route.get('/github/redirect', authController.githubRedirect)
route.get('/google/redirect', authController.googleRedirect)
route.get('/spotify/redirect', authController.spotifyRedirect)
route.get('/discord/redirect', authController.discordRedirect)
route.get('/facebook/redirect', authController.facebookRedirect)

route.get('/github/callback', authController.githubCallback)
route.get('/spotify/callback', authController.spotifyCallback)
route.get('/discord/callback', authController.discordCallback)
route.get('/google/callback', authController.googleCallback)
route.get('/facebook/callback', authController.facebookCallback)

route.post('/github/:userId', auth('manageUsers'), authController.linkGithub)
// route.post('/spotify/:userId', auth('manageUsers'), authController.linkSpotify)
// route.post('/discord/:userId', auth('manageUsers'), authController.linkDiscord)
// route.post('/google/:userId', auth('manageUsers'), authController.linkGoogle)
// route.post('/facebook/:userId', auth('manageUsers'), authController.linkFacebook)

// route.delete('/github/:userId', auth('manageUsers'), authController.deleteGithub)
// route.delete('/spotify/:userId', auth('manageUsers'), authController.deleteSpotify)
// route.delete('/discord/:userId', auth('manageUsers'), authController.deleteDiscord)
// route.delete('/google/:userId', auth('manageUsers'), authController.deleteGoogle)
// route.delete('/facebook/:userId', auth('manageUsers'), authController.deleteFacebook)

export { route }
