import httpStatus from 'http-status'
import * as queryString from 'query-string'
import { ApiError } from '../../utils/api-error'

const DEFAULT_SCOPE = ['read:user', 'user:email']
const DEFAULT_ALLOW_SIGNUP = true

type Options = {
  clientId: string
  redirectTo?: string
  scope?: string[]
  allowSignup?: boolean
  state?: string
}

type Params = {
  client_id: string
  redirect_uri?: string
  scope: string
  allow_signup: boolean
  state?: string
}

// TODO: remove when worker-auth-providers library fixed
export const redirect = async (options: Options) => {
  const {
    clientId,
    redirectTo,
    scope = DEFAULT_SCOPE,
    allowSignup = DEFAULT_ALLOW_SIGNUP,
    state
  } = options
  if (!clientId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bad request')
  }
  const params: Params = {
    client_id: clientId,
    scope: scope.join(' '),
    allow_signup: allowSignup,
    state
  }
  if (redirectTo) {
    params.redirect_uri = redirectTo
  }
  const paramString = queryString.stringify(params)
  const githubLoginUrl = `https://github.com/login/oauth/authorize?${paramString}`
  return githubLoginUrl
}
