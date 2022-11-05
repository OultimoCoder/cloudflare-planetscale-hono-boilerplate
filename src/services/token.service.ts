import jwt, { JwtPayload } from '@tsndr/cloudflare-worker-jwt'
import dayjs, { Dayjs } from 'dayjs'
import { config } from '../config/config'
import { TokenType, tokenTypes } from '../config/tokens'
import { Role } from '../config/roles'
import { User } from '../models/user.model'
import { Selectable } from 'kysely'

const generateToken = async (userId: number, type: TokenType, role: Role, expires: Dayjs) => {
  const payload = {
    sub: userId.toString(),
    exp: expires.unix(),
    iat: dayjs().unix(),
    type,
    role
  }
  return jwt.sign(payload, config.jwt.secret)
}

const generateAuthTokens = async (user: Selectable<User>) => {
  const accessTokenExpires = dayjs().add(config.jwt.accessExpirationMinutes, 'minutes')
  const accessToken = await generateToken(user.id, tokenTypes.ACCESS, user.role, accessTokenExpires)
  const refreshTokenExpires = dayjs().add(config.jwt.refreshExpirationDays, 'days')
  const refreshToken = await generateToken(
    user.id,
    tokenTypes.REFRESH,
    user.role,
    refreshTokenExpires
  )
  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  }
}

const verifyToken = async (token: string, type: TokenType) => {
  const isValid = await jwt.verify(token, config.jwt.secret)
  if (!isValid) {
    throw new Error('Token not valid')
  }
  const decoded = jwt.decode(token)
  const payload = decoded.payload
  if (type !== payload.type) {
    throw new Error('Token not valid')
  }
  return payload
}

export {
  generateToken,
  generateAuthTokens,
  verifyToken
}
