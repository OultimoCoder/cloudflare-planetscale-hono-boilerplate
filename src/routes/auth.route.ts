import { Hono } from 'hono'
import { Environment } from '../../bindings'
import * as authController from '../controllers/auth/auth.controller'
import * as appleController from '../controllers/auth/oauth/apple.controller'
import * as discordController from '../controllers/auth/oauth/discord.controller'
import * as facebookController from '../controllers/auth/oauth/facebook.controller'
import * as githubController from '../controllers/auth/oauth/github.controller'
import * as googleController from '../controllers/auth/oauth/google.controller'
import * as oauthController from '../controllers/auth/oauth/oauth.controller'
import * as spotifyController from '../controllers/auth/oauth/spotify.controller'
import { auth } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limiter'

export const route = new Hono<Environment>()

const twoMinutes = 120
const oneRequest = 1

route.post('/register', authController.register)
route.post('/login', authController.login)
route.post('/refresh-tokens', authController.refreshTokens)
route.post('/forgot-password', authController.forgotPassword)
route.post('/reset-password', authController.resetPassword)
route.post(
  '/send-verification-email',
  auth(),
  rateLimit(twoMinutes, oneRequest),
  authController.sendVerificationEmail
)
route.post('/verify-email', authController.verifyEmail)
route.get('/authorisations', auth(), authController.getAuthorisations)

route.get('/github/redirect', githubController.githubRedirect)
route.get('/google/redirect', googleController.googleRedirect)
route.get('/spotify/redirect', spotifyController.spotifyRedirect)
route.get('/discord/redirect', discordController.discordRedirect)
route.get('/facebook/redirect', facebookController.facebookRedirect)
route.get('/apple/redirect', appleController.appleRedirect)

route.post('/github/callback', githubController.githubCallback)
route.post('/spotify/callback', spotifyController.spotifyCallback)
route.post('/discord/callback', discordController.discordCallback)
route.post('/google/callback', googleController.googleCallback)
route.post('/facebook/callback', facebookController.facebookCallback)
route.post('/apple/callback', appleController.appleCallback)

route.post('/github/:userId', auth('manageUsers'), githubController.linkGithub)
route.post('/spotify/:userId', auth('manageUsers'), spotifyController.linkSpotify)
route.post('/discord/:userId', auth('manageUsers'), discordController.linkDiscord)
route.post('/google/:userId', auth('manageUsers'), googleController.linkGoogle)
route.post('/facebook/:userId', auth('manageUsers'), facebookController.linkFacebook)
route.post('/apple/:userId', auth('manageUsers'), appleController.linkApple)

route.delete('/github/:userId', auth('manageUsers'), githubController.deleteGithubLink)
route.delete('/spotify/:userId', auth('manageUsers'), spotifyController.deleteSpotifyLink)
route.delete('/discord/:userId', auth('manageUsers'), discordController.deleteDiscordLink)
route.delete('/google/:userId', auth('manageUsers'), googleController.deleteGoogleLink)
route.delete('/facebook/:userId', auth('manageUsers'), facebookController.deleteFacebookLink)
route.delete('/apple/:userId', auth('manageUsers'), appleController.deleteAppleLink)

route.post('/validate', oauthController.validateOauthOneTimeCode)
