import { JwtPayload } from '@tsndr/cloudflare-worker-jwt'
import { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { Environment } from '../../../../bindings'
import { AuthProviderType } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { OauthUser } from '../../../models/authProvider.model'
import * as authService from '../../../services/auth.service'
import * as tokenService from '../../../services/token.service'
import { ApiError } from '../../../utils/ApiError'
import * as authValidation from '../../../validations/auth.validation'

export const oauthCallback = async (
  c: Context<Environment>,
  oauthRequest: Promise<{user: unknown, tokens: unknown}>,
  providerType: AuthProviderType
): Promise<Response> => {
  const config = getConfig(c.env)
  let providerUser: OauthUser
  try {
    const result = await oauthRequest
    providerUser = result.user as OauthUser
    providerUser.providerType = providerType
  } catch (err) {
    throw new ApiError(httpStatus.UNAUTHORIZED as StatusCode, 'Unauthorized')
  }
  const user = await authService.loginOrCreateUserWithOauth(providerUser, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.OK as StatusCode)
}

export const oauthLink = async (
  c: Context<Environment>,
  oauthRequest: Promise<{user: unknown, tokens: unknown}>,
  providerType: AuthProviderType
): Promise<Response> => {
  const payload = c.get('payload') as JwtPayload
  const userId = Number(payload.sub)
  const config = getConfig(c.env)
  let providerUser: OauthUser
  try {
    const result = await oauthRequest
    providerUser = result.user as OauthUser
    providerUser.providerType = providerType
  } catch (err) {
    throw new ApiError(httpStatus.UNAUTHORIZED as StatusCode, 'Unauthorized')
  }
  await authService.linkUserWithOauth(userId, providerUser, config.database)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

export const deleteOauthLink = async (
  c: Context<Environment>,
  provider: AuthProviderType
): Promise<Response> => {
  const payload = c.get('payload') as JwtPayload
  const userId = Number(payload.sub)
  const config = getConfig(c.env)
  await authService.deleteOauthLink(userId, provider, config.database)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

export const validateCallbackBody = async (c: Context<Environment>): Promise<Request> => {
  const bodyParse = await c.req.json()
  const { code } = authValidation.oauthCallback.parse(bodyParse)
  const url = new URL(c.req.url)
  url.searchParams.set('code', code)
  const request = new Request(url.toString())
  return request
}
