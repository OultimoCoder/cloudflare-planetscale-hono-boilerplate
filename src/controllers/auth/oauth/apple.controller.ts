import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { apple } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { oauthCallback, oauthLink, deleteOauthLink, validateCallbackBody } from './oauth.controller'

export const appleRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const location = await apple.redirect({
    options: {
      clientId: config.oauth.apple.clientId,
      redirectTo: config.oauth.apple.redirectUrl
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

export const appleCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = apple.users({
    options: {
      clientId: config.oauth.apple.clientId,
      clientSecret: config.oauth.apple.clientSecret,
      redirectUrl: config.oauth.apple.redirectUrl
    },
    request
  })
  return oauthCallback<typeof authProviders.APPLE>(c, oauthRequest, authProviders.APPLE)
}

export const linkApple: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = apple.users({
    options: {
      clientId: config.oauth.apple.clientId,
      clientSecret: config.oauth.apple.clientSecret,
      redirectUrl: config.oauth.apple.redirectUrl
    },
    request
  })
  return oauthLink<typeof authProviders.APPLE>(c, oauthRequest, authProviders.APPLE)
}

export const deleteAppleLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.APPLE)
}
