import dayjs from 'dayjs'
import { Config } from '../../src/config/config'
import { Role } from '../../src/config/roles'
import { tokenTypes, TokenType } from '../../src/config/tokens'
import * as tokenService from '../../src/services/token.service'

export interface TokenResponse {
  access: {
    token: string
    expires: string
  }
  refresh: {
    token: string
    expires: string
  }
}

export const getAccessToken = async (
  userId: string,
  role: Role,
  jwtConfig: Config['jwt'],
  type: TokenType = tokenTypes.ACCESS,
  isEmailVerified = true
) => {
  const expires = dayjs().add(jwtConfig.accessExpirationMinutes, 'minutes')
  const token = await tokenService.generateToken(
    userId,
    type,
    role,
    expires,
    jwtConfig.secret,
    isEmailVerified
  )
  return token
}
