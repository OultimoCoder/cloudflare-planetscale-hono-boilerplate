import { Handler } from 'hono'
import httpStatus from 'http-status'
import { google } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { GoogleUserType } from '../../../types/oauth.types'
import { oauthCallback, oauthLink, deleteOauthLink, validateCallbackBody } from './oauth.controller'

export const googleCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = google.users({
    options: {
      clientId: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      redirectUrl: config.oauth.google.redirectUrl
    },
    request
  }) as Promise<{ user: GoogleUserType; tokens: unknown }>
  return oauthCallback<typeof authProviders.GOOGLE>(c, oauthRequest, authProviders.GOOGLE)
}

export const googleRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const location = await google.redirect({
    options: {
      clientId: config.oauth.google.clientId,
      redirectUrl: config.oauth.google.redirectUrl
    }
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const linkGoogle: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = google.users({
    options: {
      clientId: config.oauth.facebook.clientId,
      clientSecret: config.oauth.facebook.clientSecret,
      redirectUrl: config.oauth.facebook.redirectUrl
    },
    request
  }) as Promise<{ user: GoogleUserType; tokens: unknown }>
  return oauthLink<typeof authProviders.GOOGLE>(c, oauthRequest, authProviders.GOOGLE)
}

export const deleteGoogleLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.GOOGLE)
}
