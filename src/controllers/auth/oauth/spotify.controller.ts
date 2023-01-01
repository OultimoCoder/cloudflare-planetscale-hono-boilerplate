import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { spotify } from 'worker-auth-providers-typed'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { oauthCallback, oauthLink, deleteOauthLink, validateCallbackBody } from './oauth.controller'

const spotifyRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await spotify.redirect({
    options: {
      clientId: config.oauth.spotify.clientId,
      redirectUrl: config.oauth.spotify.redirectUrl,
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

const spotifyCallback: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.spotify.clientId,
      clientSecret: config.oauth.spotify.clientSecret,
      redirectUrl: config.oauth.spotify.redirectUrl
    },
    request
  })
  return oauthCallback(c, oauthRequest, authProviders.SPOTIFY)
}

const linkSpotify: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const request = await validateCallbackBody(c)
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.facebook.clientId,
      clientSecret: config.oauth.facebook.clientSecret,
      redirectUrl: config.oauth.facebook.redirectUrl
    },
    request
  })
  return oauthLink(c, oauthRequest, authProviders.SPOTIFY)
}

const deleteSpotifyLink: Handler<{ Bindings: Bindings }> = async (c) => {
  return deleteOauthLink(c, authProviders.SPOTIFY)
}

export {
  spotifyRedirect,
  spotifyCallback,
  linkSpotify,
  deleteSpotifyLink
}
