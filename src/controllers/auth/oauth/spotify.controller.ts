import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { spotify } from 'worker-auth-providers'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import * as authValidation from '../../../validations/auth.validation'
import { oauthCallback, oauthLink, deleteOauthLink } from './oauth.controller'

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
  const queryParse = c.req.query()
  authValidation.oauthCallback.parse(queryParse)
  const oauthRequest = spotify.users({
    options: {
      clientId: config.oauth.spotify.clientId,
      clientSecret: config.oauth.spotify.clientSecret,
      redirectUrl: config.oauth.spotify.redirectUrl
    },
    request: c.req
  })
  return oauthCallback(c, oauthRequest, authProviders.SPOTIFY)
}

const linkSpotify: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { code } = authValidation.oauthCallback.parse(bodyParse)
  const url = new URL(c.req.url)
  url.searchParams.set('code', code)
  const request = new Request(url.toString())
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
