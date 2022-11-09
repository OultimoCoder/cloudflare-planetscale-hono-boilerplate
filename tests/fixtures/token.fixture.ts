import dayjs from 'dayjs';
import * as tokenService from '../../src/services/token.service';
import { Config } from '../../src/config/config';
import { tokenTypes, TokenType } from '../../src/config/tokens';
import { Role } from '../../src/config/roles'

interface TokenResponse {
  access: {
    token: string,
    expires: string
  },
  refresh: {
    token: string,
    expires: string
  }
}


const getAccessToken = async (
  userId: number, role: Role, jwtConfig: Config['jwt'], type: TokenType = tokenTypes.ACCESS
) => {
  const expires = dayjs().add(jwtConfig.accessExpirationMinutes, 'minutes')
  const token = await tokenService.generateToken(
    userId,
    type,
    role,
    expires,
    jwtConfig.secret
  );
  return token
}


export {
  TokenResponse,
  getAccessToken
}
