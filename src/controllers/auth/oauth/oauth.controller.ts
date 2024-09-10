import { Context, Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { Environment } from '../../../../bindings'
import { Config, getConfig } from '../../../config/config'
import { providerUserFactory } from '../../../factories/oauth.factory'
import { OAuthUserModel } from '../../../models/oauth/oauth-base.model'
import * as authService from '../../../services/auth.service'
import * as tokenService from '../../../services/token.service'
import * as userService from '../../../services/user.service'
import { AuthProviderType, OauthUserTypes } from '../../../types/oauth.types'
import { ApiError } from '../../../utils/api-error'
import * as authValidation from '../../../validations/auth.validation'

type State = {
  platform: 'web' | 'android' | 'ios'
}

export const parseState = (state: string) => {
  try {
    const decodedState = JSON.parse(atob(state)) as State
    authValidation.stateValidation.parse(decodedState)
    return decodedState
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST as StatusCode, 'Bad request')
  }
}

export const getRedirectUrl = (state: string, config: Config) => {
  try {
    const decodedState = parseState(state)
    const platform = decodedState.platform
    return config.oauth.platform[platform].redirectUrl
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST as StatusCode, 'Bad request')
  }
}

export const oauthCallback = async <T extends AuthProviderType>(
  c: Context<Environment>,
  oauthRequest: Promise<{ user: OauthUserTypes[T]; tokens: unknown }>,
  providerType: T
): Promise<Response> => {
  const config = getConfig(c.env)
  let providerUser: OAuthUserModel
  try {
    const result = await oauthRequest
    const UserModel = providerUserFactory[providerType]
    providerUser = new UserModel(result.user)
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED as StatusCode, 'Unauthorized')
  }
  const user = await authService.loginOrCreateUserWithOauth(providerUser, config.database)
  const tokens = await tokenService.generateAuthTokens(user, config.jwt)
  return c.json({ user, tokens }, httpStatus.OK as StatusCode)
}

export const oauthLink = async <T extends AuthProviderType>(
  c: Context<Environment>,
  oauthRequest: Promise<{ user: OauthUserTypes[T]; tokens: unknown }>,
  providerType: T
): Promise<Response> => {
  const payload = c.get('payload')
  const userId = payload.sub
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
  const config = getConfig(c.env)
  let providerUser: OAuthUserModel
  try {
    const result = await oauthRequest
    const UserModel = providerUserFactory[providerType]
    providerUser = new UserModel(result.user)
  } catch {
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
  const userId = payload.sub
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
  const config = getConfig(c.env)
  await authService.deleteOauthLink(userId, provider, config.database)
  c.status(httpStatus.NO_CONTENT as StatusCode)
  return c.body(null)
}

export const validateCallbackBody = async (
  c: Context<Environment>,
  code: string
): Promise<Request> => {
  const url = new URL(c.req.url)
  url.searchParams.set('code', code)
  const request = new Request(url.toString())
  return request
}

export const validateOauthOneTimeCode: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { code } = authValidation.validateOneTimeCode.parse(bodyParse)
  const oauthCode = await tokenService.getOneTimeOauthCode(code, config)
  const user = await userService.getUserById(oauthCode.user_id, config.database)
  const tokenResponse = {
    access: {
      token: oauthCode.access_token,
      expires: oauthCode.access_token_expires_at
    },
    refresh: {
      token: oauthCode.refresh_token,
      expires: oauthCode.refresh_token_expires_at
    }
  }
  return c.json({ user, tokens: tokenResponse }, httpStatus.OK as StatusCode)
}
