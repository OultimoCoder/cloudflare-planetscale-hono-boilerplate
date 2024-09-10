import { Handler } from 'hono'
import httpStatus from 'http-status'
import { Environment } from '../../../bindings'
import { getConfig } from '../../config/config'
import * as authService from '../../services/auth.service'
import * as emailService from '../../services/email.service'
import * as tokenService from '../../services/token.service'
import * as userService from '../../services/user.service'
import { ApiError } from '../../utils/api-error'
import * as authValidation from '../../validations/auth.validation'

export const register: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const body = await authValidation.register.parseAsync(bodyParse)
  const user = await authService.register(body, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.CREATED)
}

export const login: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { email, password } = authValidation.login.parse(bodyParse)
  const user = await authService.loginUserWithEmailAndPassword(email, password, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.OK)
}

export const refreshTokens: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { refresh_token } = authValidation.refreshTokens.parse(bodyParse)
  const tokens = await authService.refreshAuth(refresh_token, config)
  return c.json({ ...tokens }, httpStatus.OK)
}

export const forgotPassword: Handler<Environment> = async (c) => {
  const bodyParse = await c.req.json()
  const config = getConfig(c.env)
  const { email } = authValidation.forgotPassword.parse(bodyParse)
  const user = await userService.getUserByEmail(email, config.database)
  // Don't let bad actors know if the email is registered by throwing if the user exists
  if (user) {
    const resetPasswordToken = await tokenService.generateResetPasswordToken(user, config.jwt)
    await emailService.sendResetPasswordEmail(
      user.email,
      { name: user.name || '', token: resetPasswordToken },
      config
    )
  }
  c.status(httpStatus.NO_CONTENT)
  return c.body(null)
}

export const resetPassword: Handler<Environment> = async (c) => {
  const queryParse = c.req.query()
  const bodyParse = await c.req.json()
  const config = getConfig(c.env)
  const { query, body } = await authValidation.resetPassword.parseAsync({
    query: queryParse,
    body: bodyParse
  })
  await authService.resetPassword(query.token, body.password, config)
  c.status(httpStatus.NO_CONTENT)
  return c.body(null)
}

export const sendVerificationEmail: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const payload = c.get('payload')
  const userId = payload.sub
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
  // Don't let bad actors know if the email is registered by returning an error if the email
  // is already verified
  try {
    const user = await userService.getUserById(userId, config.database)
    if (!user || user.is_email_verified) {
      throw new Error()
    }
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(user, config.jwt)
    await emailService.sendVerificationEmail(
      user.email,
      { name: user.name || '', token: verifyEmailToken },
      config
    )
  } catch {}
  c.status(httpStatus.NO_CONTENT)
  return c.body(null)
}

export const verifyEmail: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const queryParse = c.req.query()
  const { token } = authValidation.verifyEmail.parse(queryParse)
  await authService.verifyEmail(token, config)
  c.status(httpStatus.NO_CONTENT)
  return c.body(null)
}

export const getAuthorisations: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const payload = c.get('payload')
  if (!payload.sub) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
  const userId = payload.sub
  const authorisations = await userService.getAuthorisations(userId, config.database)
  return c.json(authorisations, httpStatus.OK)
}
