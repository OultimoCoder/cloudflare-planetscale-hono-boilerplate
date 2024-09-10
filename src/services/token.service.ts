import jwt, { JwtPayload } from '@tsndr/cloudflare-worker-jwt'
import dayjs, { Dayjs } from 'dayjs'
import httpStatus from 'http-status'
import { Selectable } from 'kysely'
import { Config } from '../config/config'
import { getDBClient } from '../config/database'
import { Role } from '../config/roles'
import { TokenType, tokenTypes } from '../config/tokens'
import { OneTimeOauthCode } from '../models/one-time-oauth-code'
import { TokenResponse } from '../models/token.model'
import { User } from '../models/user.model'
import { ApiError } from '../utils/api-error'
import { generateId } from '../utils/utils'

export const generateToken = async (
  userId: string,
  type: TokenType,
  role: Role,
  expires: Dayjs,
  secret: string,
  isEmailVerified: boolean
) => {
  const payload = {
    sub: userId.toString(),
    exp: expires.unix(),
    iat: dayjs().unix(),
    type,
    role,
    isEmailVerified
  }
  return jwt.sign(payload, secret)
}

export const generateAuthTokens = async (user: Selectable<User>, jwtConfig: Config['jwt']) => {
  const accessTokenExpires = dayjs().add(jwtConfig.accessExpirationMinutes, 'minutes')
  const accessToken = await generateToken(
    user.id,
    tokenTypes.ACCESS,
    user.role,
    accessTokenExpires,
    jwtConfig.secret,
    user.is_email_verified
  )
  const refreshTokenExpires = dayjs().add(jwtConfig.refreshExpirationDays, 'days')
  const refreshToken = await generateToken(
    user.id,
    tokenTypes.REFRESH,
    user.role,
    refreshTokenExpires,
    jwtConfig.secret,
    user.is_email_verified
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

export const verifyToken = async (token: string, type: TokenType, secret: string) => {
  const isValid = await jwt.verify(token, secret)
  if (!isValid) {
    throw new Error('Token not valid')
  }
  const decoded = jwt.decode(token)
  const payload = decoded.payload as JwtPayload
  if (type !== payload.type) {
    throw new Error('Token not valid')
  }
  return payload
}

export const generateVerifyEmailToken = async (
  user: Selectable<User>,
  jwtConfig: Config['jwt']
) => {
  const expires = dayjs().add(jwtConfig.verifyEmailExpirationMinutes, 'minutes')
  const verifyEmailToken = await generateToken(
    user.id,
    tokenTypes.VERIFY_EMAIL,
    user.role,
    expires,
    jwtConfig.secret,
    user.is_email_verified
  )
  return verifyEmailToken
}

export const generateResetPasswordToken = async (
  user: Selectable<User>,
  jwtConfig: Config['jwt']
) => {
  const expires = dayjs().add(jwtConfig.resetPasswordExpirationMinutes, 'minutes')
  const resetPasswordToken = await generateToken(
    user.id,
    tokenTypes.RESET_PASSWORD,
    user.role,
    expires,
    jwtConfig.secret,
    user.is_email_verified
  )
  return resetPasswordToken
}

const generateOneTimeOauthCodeToken = () => {
  return generateId()
}

export const createOneTimeOauthCode = async (
  userId: string,
  tokens: TokenResponse,
  config: Config
) => {
  const db = getDBClient(config.database)
  let attempts = 0
  const maxAttempts = 5
  let code = generateOneTimeOauthCodeToken()
  while (attempts < maxAttempts) {
    try {
      await db
        .insertInto('one_time_oauth_code')
        .values({
          code,
          user_id: userId,
          access_token: tokens.access.token,
          access_token_expires_at: tokens.access.expires,
          refresh_token: tokens.refresh.token,
          refresh_token_expires_at: tokens.refresh.expires,
          expires_at: dayjs().add(config.jwt.accessExpirationMinutes, 'minutes').toDate()
        })
        .executeTakeFirstOrThrow()
      break
    } catch {
      if (attempts >= maxAttempts) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create one time code')
      }
      code = generateOneTimeOauthCodeToken()
      attempts++
    }
  }
  return code
}

export const getOneTimeOauthCode = async (code: string, config: Config) => {
  const db = getDBClient(config.database)
  const oneTimeCode = await db.transaction().execute(async (trx) => {
    const oneTimeCode = await db
      .selectFrom('one_time_oauth_code')
      .selectAll()
      .where('code', '=', code)
      .where('expires_at', '>', dayjs().toDate())
      .executeTakeFirst()
    if (!oneTimeCode) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Code invalid or expired')
    }
    await trx.deleteFrom('one_time_oauth_code').where('code', '=', code).execute()
    return oneTimeCode
  })
  return new OneTimeOauthCode(oneTimeCode)
}
