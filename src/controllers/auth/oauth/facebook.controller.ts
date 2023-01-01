import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { facebook } from 'worker-auth-providers-typed'
import { Facebook } from 'worker-auth-providers-typed/src/providers/facebook'
import { OAuthTokens } from 'worker-auth-providers-typed/src/types'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { oauthCallback, oauthLink, deleteOauthLink, validateCallbackBody } from './oauth.controller'

const facebookRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await facebook.redirect({
    options: {
      clientId: config.oauth.facebook.clientId,
      redirectUrl: config.oauth.facebook.redirectUrl,
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

// Don't actually know what the response values are
// Just putting in enough for types to stop complaining
export interface IFacebookCallbackResponse {
  user: {
    name: string,
    first_name: string,
    last_name: string
  },
  tokens: object
}

const facebookCallback: Handler<{ Bindings: Bindings }> = async (c) => {
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

const linkFacebook: Handler<{ Bindings: Bindings }> = async (c) => {
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

const deleteFacebookLink: Handler<{ Bindings: Bindings }> = async (c) => {
  return deleteOauthLink(c, authProviders.FACEBOOK)
}

export {
  facebookRedirect,
  facebookCallback,
  linkFacebook,
  deleteFacebookLink
}
