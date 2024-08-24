import { Handler } from 'hono'
import httpStatus from 'http-status'
import { spotify } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { SpotifyUserType } from '../../../types/oauth.types'
import { oauthCallback, oauthLink, deleteOauthLink, validateCallbackBody } from './oauth.controller'

export const spotifyRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const location = await spotify.redirect({
    options: {
      clientId: config.oauth.spotify.clientId,
      redirectUrl: config.oauth.spotify.redirectUrl
    }
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const spotifyCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.spotify.clientId,
      clientSecret: config.oauth.spotify.clientSecret,
      redirectUrl: config.oauth.spotify.redirectUrl
    },
    request
  }) as Promise<{ user: SpotifyUserType; tokens: unknown }>
  return oauthCallback<typeof authProviders.SPOTIFY>(c, oauthRequest, authProviders.SPOTIFY)
}

export const linkSpotify: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.spotify.clientId,
      clientSecret: config.oauth.spotify.clientSecret,
      redirectUrl: config.oauth.spotify.redirectUrl
    },
    request
  }) as Promise<{ user: SpotifyUserType; tokens: unknown }>
  return oauthLink<typeof authProviders.SPOTIFY>(c, oauthRequest, authProviders.SPOTIFY)
}

export const deleteSpotifyLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.SPOTIFY)
}
