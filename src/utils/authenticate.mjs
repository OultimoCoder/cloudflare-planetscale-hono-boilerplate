import jwt from '@tsndr/cloudflare-worker-jwt'
import config from '../config/config.mjs'
import tokenTypes from '../config/tokens.mjs'

const authenticateJWT = async (token, projectId) => {
  let authorized = false
  let msg = ''
  let payload = null
  try {
    authorized = await jwt.verify(token, config.jwt.secret)
    payload = jwt.decode(token)
    authorized = (
      authorized
      && (payload.type === tokenTypes.ACCESS)
      && payload.projectId === projectId
    )
  } catch (e) {
    msg = `${e}`
  }
  return [authorized, payload]
}

export default authenticateJWT
