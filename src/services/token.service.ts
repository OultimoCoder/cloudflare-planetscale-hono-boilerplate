import jwt from '@tsndr/cloudflare-worker-jwt'
import dayjs, { Dayjs } from 'dayjs'
import { Selectable } from 'kysely'
import { Config } from '../config/config'
import { Role } from '../config/roles'
import { TokenType, tokenTypes } from '../config/tokens'
import { User } from '../models/user.model'

const generateToken = async (
  userId: number,
  type: TokenType,
  role: Role,
  expires: Dayjs,
  secret: string
) => {
  const payload = {
    sub: userId.toString(),
    exp: expires.unix(),
    iat: dayjs().unix(),
    type,
    role
  }
  return jwt.sign(payload, secret)
}

const generateAuthTokens = async (user: Selectable<User>, jwtConfig: Config['jwt']) => {
  const accessTokenExpires = dayjs().add(jwtConfig.accessExpirationMinutes, 'minutes')
  const accessToken = await generateToken(
    user.id,
    tokenTypes.ACCESS,
    user.role,
    accessTokenExpires,
    jwtConfig.secret
  )
  const refreshTokenExpires = dayjs().add(jwtConfig.refreshExpirationDays, 'days')
  const refreshToken = await generateToken(
    user.id,
    tokenTypes.REFRESH,
    user.role,
    refreshTokenExpires,
    jwtConfig.secret
  )
  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate()
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate()
    }
  }
}

const verifyToken = async (token: string, type: TokenType, secret: string) => {
  const isValid = await jwt.verify(token, secret)
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

const generateVerifyEmailToken = async (user: Selectable<User>, jwtConfig: Config['jwt']) => {
  const expires = dayjs().add(jwtConfig.verifyEmailExpirationMinutes, 'minutes')
  const verifyEmailToken = await generateToken(
    user.id,
    tokenTypes.VERIFY_EMAIL,
    user.role,
    expires,
    jwtConfig.secret
  )
  return verifyEmailToken
}

export const generateResetPasswordToken = async (
  user: Selectable<User>,
  jwtConfig: Config['jwt'],
  email: string
) => {
  const expires = dayjs().add(jwtConfig.resetPasswordExpirationMinutes, 'minutes')
  const resetPasswordToken = await generateToken(
    user.id,
    tokenTypes.RESET_PASSWORD,
    user.role,
    expires,
    jwtConfig.secret
  )
  return resetPasswordToken
}

export { generateToken, generateAuthTokens, generateVerifyEmailToken, verifyToken }
