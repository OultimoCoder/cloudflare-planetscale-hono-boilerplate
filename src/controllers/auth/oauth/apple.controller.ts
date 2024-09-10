// TODO: Handle users using private email relay
// https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/
// authenticating_users_with_sign_in_with_apple
// Also handle users without email
// refactor
import { decode } from '@tsndr/cloudflare-worker-jwt'
import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { apple } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { Config, getConfig } from '../../../config/config'
import { AppleUser } from '../../../models/oauth/apple-user.model'
import * as authService from '../../../services/auth.service'
import { getIdTokenFromCode } from '../../../services/oauth/apple.service'
import * as tokenService from '../../../services/token.service'
import { ApiError } from '../../../utils/api-error'
import * as authValidation from '../../../validations/auth.validation'
import { deleteOauthLink, getRedirectUrl, parseState } from './oauth.controller'

type AppleJWT = {
  iss: string
  aud: string
  exp: number
  iat: number
  sub: string
  at_hash: string
  email: string
  email_verified: string
  is_private_email: string
  auth_time: number
  nonce_supported: boolean
}

const getAppleUser = async (code: string | null, config: Config) => {
  if (!code) {
    throw new ApiError(httpStatus.BAD_REQUEST as StatusCode, 'Bad request')
  }
  const appleClientSecret = await apple.convertPrivateKeyToClientSecret({
    privateKey: config.oauth.provider.apple.privateKey,
    keyIdentifier: config.oauth.provider.apple.keyId,
    teamId: config.oauth.provider.apple.teamId,
    clientId: config.oauth.provider.apple.clientId,
    expAfter: config.oauth.provider.apple.jwtAccessExpirationMinutes * 60
  })
  const idToken = await getIdTokenFromCode(
    code,
    config.oauth.provider.apple.clientId,
    appleClientSecret,
    config.oauth.provider.apple.redirectUrl
  )
  const userData = decode(idToken).payload as AppleJWT
  if (!userData.email) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized')
  }
  const appleUser = new AppleUser(userData)
  return appleUser
}

export const appleRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const { state } = authValidation.oauthRedirect.parse(c.req.query())
  parseState(state)
  const location = await apple.redirect({
    options: {
      clientId: config.oauth.provider.apple.clientId,
      redirectTo: config.oauth.provider.apple.redirectUrl,
      scope: ['email'],
      responseMode: 'form_post',
      state: state
    }
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const appleCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const formData = await c.req.formData()
  const state = formData.get('state')
  if (!state) {
    const redirect = new URL('?error=Something went wrong', config.oauth.platform.web.redirectUrl)
      .href
    return c.redirect(redirect, httpStatus.FOUND)
  }
  // Set a base redirect url to web in case of no platform info being passed
  let redirectBase = config.oauth.platform.web.redirectUrl
  try {
    redirectBase = getRedirectUrl(state, config)
    const appleUser = await getAppleUser(formData.get('code'), config)
    const user = await authService.loginOrCreateUserWithOauth(appleUser, config.database)
    const tokens = await tokenService.generateAuthTokens(user, config.jwt)
    const oneTimeCode = await tokenService.createOneTimeOauthCode(user.id, tokens, config)
    const redirect = new URL(`?oneTimeCode=${oneTimeCode}&state=${state}`, redirectBase).href
    return c.redirect(redirect, httpStatus.FOUND)
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Something went wrong'
    const redirect = new URL(`?error=${message}&state=${state}`, redirectBase).href
    return c.redirect(redirect, httpStatus.FOUND)
  }
}

export const linkApple: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const payload = c.get('payload')
  const userId = payload.sub
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
  const bodyParse = await c.req.json()
  const { code } = authValidation.linkApple.parse(bodyParse)
  const appleUser = await getAppleUser(code, config)
  await authService.linkUserWithOauth(userId, appleUser, config.database)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

export const deleteAppleLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.APPLE)
}
