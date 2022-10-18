import httpStatus from 'http-status'
import { roleRights, Permission, Role } from '../config/roles'
import { ApiError } from '../utils/ApiError'
import { Context } from 'hono';
import jwt from '@tsndr/cloudflare-worker-jwt'
import { tokenTypes } from '../config/tokens';
import { config } from '../config/config'

const authenticate = async (jwtToken: string) => {
  let authorized = false
  let payload
  try {
    authorized = await jwt.verify(jwtToken, config.jwt.secret)
    const decoded = jwt.decode(jwtToken);
    payload = decoded.payload
    authorized = authorized && (payload.type === tokenTypes.ACCESS)
  } catch (e) {}
  return {authorized, payload}
}

const auth = (...requiredRights: Permission[]) => async (c: Context, next: Function) => {
  const credentials = c.req.headers.get('Authorization')

  if (!credentials) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }

  const parts = credentials.split(/\s+/)
  if (parts.length !== 2) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }

  const jwtToken = parts[1]
  const {authorized, payload} = await authenticate(jwtToken)

  if (!authorized || !payload ) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }

  if (requiredRights.length) {
    const userRights = roleRights[payload.role as Role]
    const hasRequiredRights = requiredRights.every(
      (requiredRight) => (userRights as unknown as string[]).includes(requiredRight)
    )
    if (!hasRequiredRights && c.req.param('userId') !== payload.user) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden')
    }
  }
  c.set('payload', payload)
  await next()
}

export default auth
