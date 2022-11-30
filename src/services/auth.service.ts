import httpStatus from 'http-status'
import { Config } from '../config/config'
import { tokenTypes } from '../config/tokens'
import { ApiError } from '../utils/ApiError'
import * as tokenService from './token.service'
import * as userService from './user.service'

const loginUserWithEmailAndPassword = async (
  email: string, password: string, databaseConfig: Config['database']
) => {
  const user = await userService.getUserByEmail(email, databaseConfig)
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
  userId: number, oldPassword: string, newPassword: string, databaseConfig: Config['database']
) => {
  try {
    const user = await userService.getUserById(userId, databaseConfig)
    if (!(await user.isPasswordMatch(oldPassword))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password')
    }
    await userService.updateUserById(
      user.id,
      { password: newPassword },
      databaseConfig
    )
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password change failed')
  }
}

export {
  loginUserWithEmailAndPassword,
  refreshAuth,
  resetPassword,
  verifyEmail,
  changePassword
}
