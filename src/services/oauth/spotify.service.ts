import httpStatus from 'http-status'
import * as queryString from 'query-string'
import { ApiError } from '../../utils/api-error'

type Options = {
  clientId: string
  redirectUrl?: string
  scope?: string
  responseType?: string
  showDialog?: boolean
  state?: string
}

// TODO: remove when worker-auth-providers library fixed
export const redirect = async (options: Options) => {
  const {
    clientId,
    redirectUrl,
    scope = 'user-library-read playlist-modify-private',
    responseType = 'code',
    showDialog = false,
    state
  } = options
  if (!clientId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bad request')
  }
  const params = queryString.stringify({
    client_id: clientId,
    redirect_uri: redirectUrl,
    response_type: responseType,
    scope,
    show_dialog: showDialog,
    state
  })
  const url = `https://accounts.spotify.com/authorize?${params}`
  return url
}
