import { Handler } from 'hono'
import httpStatus from 'http-status'
import { spotify } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import * as spotifyService from '../../../services/oauth/spotify.service'
import { SpotifyUserType } from '../../../types/oauth.types'
import * as authValidation from '../../../validations/auth.validation'
import {
  oauthCallback,
  oauthLink,
  deleteOauthLink,
  validateCallbackBody,
  getRedirectUrl
} from './oauth.controller'

export const spotifyRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const { state } = authValidation.oauthRedirect.parse(c.req.query())
  const redirectUrl = getRedirectUrl(state, config)
  const location = await spotifyService.redirect({
    clientId: config.oauth.provider.spotify.clientId,
    redirectUrl: redirectUrl,
    state: state,
    scope: 'user-read-email'
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const spotifyCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.provider.spotify.clientId,
      clientSecret: config.oauth.provider.spotify.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  }) as Promise<{ user: SpotifyUserType; tokens: unknown }>
  return oauthCallback<typeof authProviders.SPOTIFY>(c, oauthRequest, authProviders.SPOTIFY)
}

export const linkSpotify: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const request = await validateCallbackBody(c, code)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.provider.spotify.clientId,
      clientSecret: config.oauth.provider.spotify.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  }) as Promise<{ user: SpotifyUserType; tokens: unknown }>
  return oauthLink<typeof authProviders.SPOTIFY>(c, oauthRequest, authProviders.SPOTIFY)
}

export const deleteSpotifyLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.SPOTIFY)
}
