import { Handler } from 'hono'
import httpStatus from 'http-status'
import { facebook } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import * as facebookService from '../../../services/oauth/facebook.service'
import * as authValidation from '../../../validations/auth.validation'
import {
  oauthCallback,
  oauthLink,
  deleteOauthLink,
  validateCallbackBody,
  getRedirectUrl
} from './oauth.controller'

export const facebookRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const { state } = authValidation.oauthRedirect.parse(c.req.query())
  const redirectUrl = getRedirectUrl(state, config)
  const location = await facebookService.redirect({
    clientId: config.oauth.provider.facebook.clientId,
    redirectUrl: redirectUrl,
    state: state
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const facebookCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const request = await validateCallbackBody(c, code)
  const oauthRequest = facebook.users({
    options: {
      clientId: config.oauth.provider.facebook.clientId,
      clientSecret: config.oauth.provider.facebook.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  })
  return oauthCallback<typeof authProviders.FACEBOOK>(c, oauthRequest, authProviders.FACEBOOK)
}

export const linkFacebook: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = facebook.users({
    options: {
      clientId: config.oauth.provider.facebook.clientId,
      clientSecret: config.oauth.provider.facebook.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  })
  return oauthLink<typeof authProviders.FACEBOOK>(c, oauthRequest, authProviders.FACEBOOK)
}

export const deleteFacebookLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.FACEBOOK)
}
