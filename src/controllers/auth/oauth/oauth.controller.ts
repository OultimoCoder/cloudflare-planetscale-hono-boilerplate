import { JwtPayload } from '@tsndr/cloudflare-worker-jwt'
import { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { AuthProviderType } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { OauthUser } from '../../../models/authProvider.model'
import * as authService from '../../../services/auth.service'
import * as tokenService from '../../../services/token.service'
import { ApiError } from '../../../utils/ApiError'

const oauthCallback = async (
  c: Context<string, { Bindings: Bindings }>,
  oauthRequest: Promise<{user: unknown, tokens: unknown}>,
  providerType: AuthProviderType
) => {
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

const oauthLink = async (
  c: Context<string, { Bindings: Bindings }>,
  oauthRequest: Promise<{user: unknown, tokens: unknown}>,
  providerType: AuthProviderType
) => {
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

const deleteOauthLink = async (
  c: Context<string, { Bindings: Bindings }>,
  provider: AuthProviderType
) => {
  const payload = c.get('payload') as JwtPayload
  const userId = Number(payload.sub)
  const config = getConfig(c.env)
  await authService.deleteOauthLink(userId, provider, config.database)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

export {
  oauthCallback,
  oauthLink,
  deleteOauthLink
}
