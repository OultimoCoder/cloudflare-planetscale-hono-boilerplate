import jwt from '@tsndr/cloudflare-worker-jwt'
import { MiddlewareHandler } from 'hono'
import httpStatus from 'http-status'
import { getConfig } from '../config/config'
import { roleRights, Permission, Role } from '../config/roles'
import { tokenTypes } from '../config/tokens'
import { ApiError } from '../utils/ApiError'

const authenticate = async (jwtToken: string, secret: string) => {
  let authorized = false
  let payload
  try {
    authorized = await jwt.verify(jwtToken, secret)
    const decoded = jwt.decode(jwtToken)
    payload = decoded.payload
    authorized = authorized && payload.type === tokenTypes.ACCESS
  } catch (e) {}
  return { authorized, payload }
}

const auth =
  (...requiredRights: Permission[]): MiddlewareHandler<string, { Bindings: Bindings }> =>
  async (c, next) => {
    const credentials = c.req.headers.get('Authorization')
    const config = getConfig(c.env)
    if (!credentials) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
    }

    const parts = credentials.split(/\s+/)
    if (parts.length !== 2) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
    }

    const jwtToken = parts[1]
    const { authorized, payload } = await authenticate(jwtToken, config.jwt.secret)

    if (!authorized || !payload) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
    }

    if (requiredRights.length) {
      const userRights = roleRights[payload.role as Role]
      const hasRequiredRights = requiredRights.every((requiredRight) =>
        (userRights as unknown as string[]).includes(requiredRight)
      )
      if (!hasRequiredRights && c.req.param('userId') !== payload.sub) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden')
      }
    }
    c.set('payload', payload)
    await next()
  }

export { auth }
