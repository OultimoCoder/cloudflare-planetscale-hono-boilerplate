import { Handler } from 'hono'
import httpStatus from 'http-status'
import { discord } from 'worker-auth-providers'
import { Environment } from '../../../../bindings'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import { DiscordUserType } from '../../../types/oauth.types'
import * as authValidation from '../../../validations/auth.validation'
import {
  oauthCallback,
  oauthLink,
  deleteOauthLink,
  validateCallbackBody,
  getRedirectUrl
} from './oauth.controller'

export const discordRedirect: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const { state } = authValidation.oauthRedirect.parse(c.req.query())
  const redirectUrl = getRedirectUrl(state, config)
  const location = await discord.redirect({
    options: {
      clientId: config.oauth.provider.discord.clientId,
      redirectUrl: redirectUrl,
      state: state,
      scope: 'identify email'
    }
  })
  return c.redirect(location, httpStatus.FOUND)
}

export const discordCallback: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const request = await validateCallbackBody(c, code)
  const oauthRequest = discord.users({
    options: {
      clientId: config.oauth.provider.discord.clientId,
      clientSecret: config.oauth.provider.discord.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  }) as Promise<{ user: DiscordUserType; tokens: unknown }>
  return oauthCallback<typeof authProviders.DISCORD>(c, oauthRequest, authProviders.DISCORD)
}

export const linkDiscord: Handler<Environment> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { platform, code } = authValidation.oauthCallback.parse(bodyParse)
  const redirectUrl = config.oauth.platform[platform].redirectUrl
  const request = await validateCallbackBody(c, code)
  const oauthRequest = discord.users({
    options: {
      clientId: config.oauth.provider.discord.clientId,
      clientSecret: config.oauth.provider.discord.clientSecret,
      redirectUrl: redirectUrl
    },
    request
  }) as Promise<{ user: DiscordUserType; tokens: unknown }>
  return oauthLink<typeof authProviders.DISCORD>(c, oauthRequest, authProviders.DISCORD)
}

export const deleteDiscordLink: Handler<Environment> = async (c) => {
  return deleteOauthLink(c, authProviders.DISCORD)
}
