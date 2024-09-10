import { Handler } from 'hono'
import httpStatus from 'http-status'
import { github } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import * as githubService from '../../../services/oauth/github.service'
import * as authValidation from '../../../validations/auth.validation'
import {
  oauthCallback,
  oauthLink,
  deleteOauthLink,
  validateCallbackBody,
  getRedirectUrl
} from './oauth.controller'

export const githubRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const { state } = authValidation.oauthRedirect.parse(c.req.query())
  const redirectUrl = getRedirectUrl(state, config)
  const location = await githubService.redirect({
    clientId: config.oauth.provider.github.clientId,
    redirectTo: redirectUrl,
    state: state
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const githubCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = github.users({
    options: {
      clientId: config.oauth.provider.github.clientId,
      clientSecret: config.oauth.provider.github.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  })
  return oauthCallback<typeof authProviders.GITHUB>(c, oauthRequest, authProviders.GITHUB)
}

export const linkGithub: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = github.users({
    options: {
      clientId: config.oauth.provider.github.clientId,
      clientSecret: config.oauth.provider.github.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  })
  return oauthLink(c, oauthRequest, authProviders.GITHUB)
}

export const deleteGithubLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.GITHUB)
}
