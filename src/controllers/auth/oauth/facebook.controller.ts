import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { facebook } from 'worker-auth-providers-typed'
import { Facebook } from 'worker-auth-providers-typed/src/providers/facebook'
import { OAuthTokens } from 'worker-auth-providers-typed/src/types'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { oauthCallback, oauthLink, deleteOauthLink, validateCallbackBody } from './oauth.controller'

export const facebookRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const location = await facebook.redirect({
    options: {
      clientId: config.oauth.facebook.clientId,
      redirectUrl: config.oauth.facebook.redirectUrl,
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

export const facebookCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = facebook.users({
    options: {
      clientId: config.oauth.facebook.clientId,
      clientSecret: config.oauth.facebook.clientSecret,
      redirectUrl: config.oauth.facebook.redirectUrl
    },
    request
  }).then((result) => {
    const res = result as {
      tokens: OAuthTokens,
      user: Facebook.UserResponse & {name: string}
    }
    res.user.name = `${res.user.first_name} ${res.user.last_name}`
    return res
  })
  return oauthCallback(c, oauthRequest, authProviders.FACEBOOK)
}

export const linkFacebook: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = facebook.users({
    options: {
      clientId: config.oauth.facebook.clientId,
      clientSecret: config.oauth.facebook.clientSecret,
      redirectUrl: config.oauth.facebook.redirectUrl
    },
    request
  })
  return oauthLink(c, oauthRequest, authProviders.FACEBOOK)
}

export const deleteFacebookLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.FACEBOOK)
}
