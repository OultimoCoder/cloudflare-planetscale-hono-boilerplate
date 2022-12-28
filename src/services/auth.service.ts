import httpStatus from 'http-status'
import { sql } from 'kysely'
import { authProviders, AuthProviderType } from '../config/authProviders'
import { Config } from '../config/config'
import { getDBClient } from '../config/database'
import { tokenTypes } from '../config/tokens'
import { OauthUser } from '../models/authProvider.model'
import { ApiError } from '../utils/ApiError'
import * as tokenService from './token.service'
import * as userService from './user.service'

const loginUserWithEmailAndPassword = async (
  email: string,
  password: string,
  databaseConfig: Config['database']
) => {
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

const refreshAuth = async (refreshToken: string, config: Config) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(
      refreshToken,
      tokenTypes.REFRESH,
      config.jwt.secret
    )
    const user = await userService.getUserById(Number(refreshTokenDoc.sub), config.database)
    if (!user) {
      throw new Error()
    }
    return tokenService.generateAuthTokens(user, config.jwt)
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
}

const resetPassword = async (resetPasswordToken: string, newPassword: string, config: Config) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(
      resetPasswordToken,
      tokenTypes.RESET_PASSWORD,
      config.jwt.secret
    )
    const userId = Number(resetPasswordTokenDoc.sub)
    const user = await userService.getUserById(userId, config.database)
    if (!user) {
      throw new Error()
    }
    await userService.updateUserById(user.id, { password: newPassword }, config.database)
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed')
  }
}

const verifyEmail = async (verifyEmailToken: string, config: Config) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(
      verifyEmailToken,
      tokenTypes.VERIFY_EMAIL,
      config.jwt.secret
    )
    const userId = Number(verifyEmailTokenDoc.sub)
    const user = await userService.getUserById(userId, config.database)
    if (!user) {
      throw new Error()
    }
    await userService.updateUserById(user.id, { is_email_verified: true }, config.database)
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed')
  }
}

const changePassword = async (
  userId: number,
  oldPassword: string,
  newPassword: string,
  databaseConfig: Config['database']
) => {
  try {
    const user = await userService.getUserById(userId, databaseConfig)
    if (!(await user.isPasswordMatch(oldPassword))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password')
    }
    await userService.updateUserById(user.id, { password: newPassword }, databaseConfig)
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password change failed')
  }
}

const loginOrCreateUserWithOauth = async (
  providerUser: OauthUser,
  databaseConfig: Config['database']
) => {
  const user = await userService.getUserByProviderIdType(
    providerUser.id.toString(),
    providerUser.providerType,
    databaseConfig
  )
  if (user) return user
  return userService.createOauthUser(providerUser, databaseConfig)
}

const linkUserWithOauth = async (
  userId: number,
  providerUser: OauthUser,
  databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  await db.transaction().execute(async (trx) => {
    try {
      await trx
      .selectFrom('user')
      .selectAll()
      .where('user.id', '=', userId)
      .executeTakeFirstOrThrow()
    } catch (err) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
    }
    try {
      await trx
      .insertInto('authorisations')
      .values({
        user_id: userId,
        provider_user_id: providerUser.id.toString(),
        provider_type: providerUser.providerType
      })
      .executeTakeFirstOrThrow()
    } catch (err) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `User has already linked their ${providerUser.providerType} account`
      )
    }
  })
}

const deleteOauthLink = async (
  userId: number,
  provider: AuthProviderType,
  databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  await db.transaction().execute(async (trx) => {
    const { count } = trx.fn
    let loginsNo: number
    try {
      const logins = await trx
        .selectFrom('user')
        .select('password')
        .select(count<number>('authorisations.provider_user_id').as('authorisations'))
        .innerJoin('authorisations', 'authorisations.user_id', 'user.id')
        .groupBy('user.password')
        .executeTakeFirstOrThrow()
      loginsNo = logins.password ? logins.authorisations + 1 : logins.authorisations
    } catch(_) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Account not linked')
    }
    const minLoginMethods = 1
    if (loginsNo <= minLoginMethods) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot unlink last login method')
    }
    try {
      await trx
        .deleteFrom('authorisations')
        .where('user_id', '=', userId)
        .where('provider_type', '=', provider)
        .executeTakeFirstOrThrow()
    } catch (_) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Account unlink failed')
    }
  })
}

export {
  loginUserWithEmailAndPassword,
  refreshAuth,
  resetPassword,
  verifyEmail,
  changePassword,
  loginOrCreateUserWithOauth,
  linkUserWithOauth,
  deleteOauthLink
}
