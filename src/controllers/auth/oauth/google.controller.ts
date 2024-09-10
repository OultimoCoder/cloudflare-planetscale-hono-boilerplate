import { Handler } from 'hono'
import httpStatus from 'http-status'
import { google } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { GoogleUserType } from '../../../types/oauth.types'
import * as authValidation from '../../../validations/auth.validation'
import {
  oauthCallback,
  oauthLink,
  deleteOauthLink,
  validateCallbackBody,
  getRedirectUrl
} from './oauth.controller'

export const googleRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const { state } = authValidation.oauthRedirect.parse(c.req.query())
  const redirectUrl = getRedirectUrl(state, config)
  const location = await google.redirect({
    options: {
      clientId: config.oauth.provider.google.clientId,
      redirectUrl: redirectUrl,
      state: state
    }
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const googleCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = google.users({
    options: {
      clientId: config.oauth.provider.google.clientId,
      clientSecret: config.oauth.provider.google.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  }) as Promise<{ user: GoogleUserType; tokens: unknown }>
  return oauthCallback<typeof authProviders.GOOGLE>(c, oauthRequest, authProviders.GOOGLE)
}

export const linkGoogle: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = google.users({
    options: {
      clientId: config.oauth.provider.google.clientId,
      clientSecret: config.oauth.provider.google.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  }) as Promise<{ user: GoogleUserType; tokens: unknown }>
  return oauthLink<typeof authProviders.GOOGLE>(c, oauthRequest, authProviders.GOOGLE)
}

export const deleteGoogleLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.GOOGLE)
}
