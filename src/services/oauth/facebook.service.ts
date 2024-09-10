import httpStatus from 'http-status'
import * as queryString from 'query-string'
import { ApiError } from '../../utils/api-error'

type Options = {
  clientId: string
  redirectUrl: string
  scope?: string
  responseType?: string
  authType?: string
  display?: string
  state?: string
}

// TODO: remove when worker-auth-providers library fixed
export const redirect = async (options: Options) => {
  const {
    clientId,
    redirectUrl,
    scope = 'email, user_friends',
    responseType = 'code',
    authType = 'rerequest',
    display = 'popup',
    state
  } = options
  if (!clientId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bad request')
  }
  const params = queryString.stringify({
    client_id: clientId,
    redirect_uri: redirectUrl,
    scope,
    response_type: responseType,
    auth_type: authType,
    display,
    state
  })
  const url = `https://www.facebook.com/v4.0/dialog/oauth?${params}`
  return url
}
