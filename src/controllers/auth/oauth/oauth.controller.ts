import { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { Environment } from '../../../../bindings'
import { getConfig } from '../../../config/config'
import { providerUserFactory } from '../../../factories/oauth.factory'
import { OAuthUserModel } from '../../../models/oauth/oauthBase.model'
import * as authService from '../../../services/auth.service'
import * as tokenService from '../../../services/token.service'
import { AuthProviderType, OauthUserTypes } from '../../../types/oauth.types'
import { ApiError } from '../../../utils/ApiError'
import * as authValidation from '../../../validations/auth.validation'

export const oauthCallback = async <T extends AuthProviderType> (
  c: Context<Environment>,
  oauthRequest: Promise<{user: OauthUserTypes[T], tokens: unknown}>,
  providerType: T
): Promise<Response> => {
  const config = getConfig(c.env)
  let providerUser: OAuthUserModel
  try {
    const result = await oauthRequest
    const UserModel = providerUserFactory[providerType]
    providerUser = new UserModel(result.user)
  } catch (err) {
    throw new ApiError(httpStatus.UNAUTHORIZED as StatusCode, 'Unauthorized')
  }
  const user = await authService.loginOrCreateUserWithOauth(providerUser, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.OK as StatusCode)
}

export const oauthLink = async <T extends AuthProviderType> (
  c: Context<Environment>,
  oauthRequest: Promise<{user: OauthUserTypes[T], tokens: unknown}>,
  providerType: T
): Promise<Response> => {
  const payload = c.get('payload')
  const userId = Number(payload.sub)
  const config = getConfig(c.env)
  let providerUser: OAuthUserModel
  try {
    const result = await oauthRequest
    const UserModel = providerUserFactory[providerType]
    providerUser = new UserModel(result.user)
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
  const payload = c.get('payload')
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
