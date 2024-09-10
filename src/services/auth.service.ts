import httpStatus from 'http-status'
import { Config } from '../config/config'
import { getDBClient } from '../config/database'
import { Role } from '../config/roles'
import { tokenTypes } from '../config/tokens'
import { OAuthUserModel } from '../models/oauth/oauth-base.model'
import { TokenResponse } from '../models/token.model'
import { User } from '../models/user.model'
import { AuthProviderType } from '../types/oauth.types'
import { ApiError } from '../utils/api-error'
import { Register } from '../validations/auth.validation'
import * as tokenService from './token.service'
import * as userService from './user.service'
import { createUser } from './user.service'

export const loginUserWithEmailAndPassword = async (
  email: string,
  password: string,
  databaseConfig: Config['database']
): Promise<User> => {
  const user = await userService.getUserByEmail(email, databaseConfig)
  // If password is null then the user must login with a social account
  if (user && !user.password) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please login with your social account')
  }
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password')
  }
  return user
}

export const refreshAuth = async (refreshToken: string, config: Config): Promise<TokenResponse> => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(
      refreshToken,
      tokenTypes.REFRESH,
      config.jwt.secret
    )
    if (!refreshTokenDoc.sub) {
      throw new Error()
    }
    const user = await userService.getUserById(refreshTokenDoc.sub, config.database)
    if (!user) {
      throw new Error()
    }
    return tokenService.generateAuthTokens(user, config.jwt)
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
}

export const register = async (
  body: Register,
  databaseConfig: Config['database']
): Promise<User> => {
  const registerBody = { ...body, role: 'user' as Role, is_email_verified: false }
  const newUser = await createUser(registerBody, databaseConfig)
  return newUser
}

export const resetPassword = async (
  resetPasswordToken: string,
  newPassword: string,
  config: Config
): Promise<void> => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(
      resetPasswordToken,
      tokenTypes.RESET_PASSWORD,
      config.jwt.secret
    )
    if (!resetPasswordTokenDoc.sub) {
      throw new Error()
    }
    const userId = resetPasswordTokenDoc.sub
    const user = await userService.getUserById(userId, config.database)
    if (!user) {
      throw new Error()
    }
    await userService.updateUserById(user.id, { password: newPassword }, config.database)
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed')
  }
}

export const verifyEmail = async (verifyEmailToken: string, config: Config): Promise<void> => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(
      verifyEmailToken,
      tokenTypes.VERIFY_EMAIL,
      config.jwt.secret
    )
    if (!verifyEmailTokenDoc.sub) {
      throw new Error()
    }
    const userId = verifyEmailTokenDoc.sub
    const user = await userService.getUserById(userId, config.database)
    if (!user) {
      throw new Error()
    }
    await userService.updateUserById(user.id, { is_email_verified: true }, config.database)
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed')
  }
}

export const loginOrCreateUserWithOauth = async (
  providerUser: OAuthUserModel,
  databaseConfig: Config['database']
): Promise<User> => {
  const user = await userService.getUserByProviderIdType(
    providerUser._id,
    providerUser.providerType,
    databaseConfig
  )
  if (user) return user
  return userService.createOauthUser(providerUser, databaseConfig)
}

export const linkUserWithOauth = async (
  userId: string,
  providerUser: OAuthUserModel,
  databaseConfig: Config['database']
): Promise<void> => {
  const db = getDBClient(databaseConfig)
  await db.transaction().execute(async (trx) => {
    try {
      await trx
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow()
    } catch {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
    }
    await trx
      .insertInto('authorisations')
      .values({
        user_id: userId,
        provider_user_id: providerUser._id,
        provider_type: providerUser.providerType
      })
      .executeTakeFirstOrThrow()
  })
}

export const deleteOauthLink = async (
  userId: string,
  provider: AuthProviderType,
  databaseConfig: Config['database']
): Promise<void> => {
  const db = getDBClient(databaseConfig)
  await db.transaction().execute(async (trx) => {
    const { count } = trx.fn
    let loginsNo: number
    try {
      const logins = await trx
        .selectFrom('user')
        .select('password')
        .select(count<number>('authorisations.provider_user_id').as('authorisations'))
        .leftJoin('authorisations', 'authorisations.user_id', 'user.id')
        .where('user.id', '=', userId)
        .groupBy('user.password')
        .executeTakeFirstOrThrow()
      loginsNo = logins.password !== null ? logins.authorisations + 1 : logins.authorisations
    } catch {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Account not linked')
    }
    const minLoginMethods = 1
    if (loginsNo <= minLoginMethods) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot unlink last login method')
    }
    const result = await trx
      .deleteFrom('authorisations')
      .where('user_id', '=', userId)
      .where('provider_type', '=', provider)
      .executeTakeFirst()
    if (!result.numDeletedRows || Number(result.numDeletedRows) < 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Account not linked')
    }
  })
}
