import { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import httpStatus from 'http-status'
import { github } from 'worker-auth-providers'
import { authProviders } from '../../../config/authProviders'
import { getConfig } from '../../../config/config'
import * as authValidation from '../../../validations/auth.validation'
import { oauthCallback, oauthLink, deleteOauthLink } from './oauth.controller'

const githubRedirect: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const location = await github.redirect({
    options: {
      clientId: config.oauth.github.clientId
    }
  })
  return c.redirect(location, httpStatus.FOUND as StatusCode)
}

const githubCallback: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const queryParse = c.req.query()
  authValidation.oauthCallback.parse(queryParse)
  const oauthRequest = github.users({
    options: {
      clientId: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret
    },
    request: c.req
  })
  return oauthCallback(c, oauthRequest, authProviders.GITHUB)
}

const linkGithub: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const bodyParse = await c.req.json()
  const { code } = authValidation.oauthCallback.parse(bodyParse)
  const url = new URL(c.req.url)
  url.searchParams.set('code', code)
  const request = new Request(url.toString())
  const oauthRequest = github.users({
    options: {
      clientId: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret
    },
    request
  })
  return oauthLink(c, oauthRequest, authProviders.GITHUB)
}

const deleteGithubLink: Handler<{ Bindings: Bindings }> = async (c) => {
  return deleteOauthLink(c, authProviders.GITHUB)
}

export {
  githubRedirect,
  githubCallback,
  linkGithub,
  deleteGithubLink
}
