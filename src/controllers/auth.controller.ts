import { JwtPayload } from '@tsndr/cloudflare-worker-jwt'
import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { github, discord, spotify, google } from 'worker-auth-providers'
import { getConfig } from '../config/config'
import * as authService from '../services/auth.service'
import * as emailService from '../services/email.service'
import * as tokenService from '../services/token.service'
import * as userService from '../services/user.service'
import * as authValidation from '../validations/auth.validation'

const register: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const body = await authValidation.register.parseAsync(bodyParse)
  const user = await userService.createUser(body, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.CREATED as StatusCode)
}

const login: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { email, password } = authValidation.login.parse(bodyParse)
  const user = await authService.loginUserWithEmailAndPassword(email, password, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.OK as StatusCode)
}

const refreshTokens: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { refresh_token } = authValidation.refreshTokens.parse(bodyParse)
  const tokens = await authService.refreshAuth(refresh_token, config)
  return c.json({ ...tokens }, httpStatus.OK as StatusCode)
}

const forgotPassword: Handler<{ Bindings: Bindings }> = async (c) => {
  const bodyParse = await c.req.json()
  const config = getConfig(c.env)
  const { email } = authValidation.forgotPassword.parse(bodyParse)
  const user = await userService.getUserByEmail(email, config.database)
  // Don't let bad actors know if the email is registered by throwing if the user exists
  if (user) {
    const resetPasswordToken = await tokenService.generateResetPasswordToken(user, config.jwt)
    await emailService.sendResetPasswordEmail(
      user.email,
      {
        name: user.name,
        token: resetPasswordToken
      },
      config
    )
  }
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

const resetPassword: Handler<{ Bindings: Bindings }> = async (c) => {
  const queryParse = c.req.query()
  const bodyParse = await c.req.json()
  const config = getConfig(c.env)
  const { query, body } = await authValidation.resetPassword.parseAsync({
    query: queryParse,
    body: bodyParse
  })
  await authService.resetPassword(query.token, body.password, config)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

const sendVerificationEmail: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const payload = c.get('payload') as JwtPayload
  const userId = Number(payload.sub)
  // Don't let bad actors know if the email is registered by returning an error if the email
  // is already verified
  try {
    const user = await userService.getUserById(userId, config.database)
    if (user.is_email_verified) {
      throw new Error()
    }
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(user, config.jwt)
    await emailService.sendVerificationEmail(
      user.email,
      {
        name: user.name,
        token: verifyEmailToken
      },
      config
    )
  } catch (err) {}
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

const verifyEmail: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const queryParse = c.req.query()
  const { token } = authValidation.verifyEmail.parse(queryParse)
  await authService.verifyEmail(token, config)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

const changePassword: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const payload = c.get('payload') as JwtPayload
  const bodyParse = await c.req.json()
  const { oldPassword, newPassword } = authValidation.changePassword.parse(bodyParse)
  const userId = Number(payload.sub)
  await authService.changePassword(userId, oldPassword, newPassword, config.database)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

const githubRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await github.redirect({
    options: {
      clientId: config.oauth.github.clientId
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

const discordRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await discord.redirect({
    options: {
      clientId: config.oauth.discord.clientId,
      redirectUrl: config.oauth.discord.redirectUrl,
      scope: 'identify email'
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

const googleRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await google.redirect({
    options: {
      clientId: config.oauth.google.clientId,
      redirectUrl: config.oauth.google.redirectUrl,
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

const spotifyRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await spotify.redirect({
    options: {
      clientId: config.oauth.spotify.clientId,
      redirectUrl: config.oauth.spotify.redirectUrl,
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

// const githubCallback: Handler<{ Bindings: Bindings }> = async (c) => {
//   const config = getConfig(c.env)
//   const { user: githubUser } = await github.users({
//     options: {
//       clientId: config.oauth.github.clientId,
//       clientSecret: config.oauth.github.clientSecret
//     },
//     request: c.req
//   })
//   console.log(githubUser)
// }


export {
  register,
  login,
  refreshTokens,
  sendVerificationEmail,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  githubRedirect,
  discordRedirect,
  googleRedirect,
  spotifyRedirect,
  // githubCallback
}
