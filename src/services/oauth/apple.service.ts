import httpStatus from 'http-status'
import { ApiError } from '../../utils/api-error'

type AppleResponse = {
  error?: string
  id_token?: string
}

export const getIdTokenFromCode = async (
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUrl: string
) => {
  const params = {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUrl,
    response_mode: 'form_post'
  }
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  })
  const result = (await response.json()) as AppleResponse
  if (result.error || !result.id_token) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized')
  }
  return result.id_token
}
