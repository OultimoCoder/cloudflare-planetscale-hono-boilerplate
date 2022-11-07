import httpStatus from 'http-status';
import * as tokenService from './token.service';
import * as userService from './user.service';
import { ApiError } from '../utils/ApiError';
import { tokenTypes } from '../config/tokens';
import { Config } from '../config/config';

const loginUserWithEmailAndPassword = async (
  email: string, password: string, databaseConfig: Config['database']
) => {
  const user = await userService.getUserByEmail(email, databaseConfig);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

const refreshAuth = async (refreshToken: string, config: Config) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(
      refreshToken,
      tokenTypes.REFRESH,
      config.jwt.secret
    );
    const user = await userService.getUserById(Number(refreshTokenDoc.sub), config.database);
    if (!user) {
      throw new Error();
    }
    return tokenService.generateAuthTokens(user, config.jwt);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

// const resetPassword = async (resetPasswordToken: string, newPassword: string) => {
//   try {
//     const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
//     const user = await userService.getUserById(resetPasswordTokenDoc.user);
//     if (!user) {
//       throw new Error();
//     }
//     await userService.updateUserById(user.id, { password: newPassword });
//     await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD });
//   } catch (error) {
//     throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
//   }
// };

// const verifyEmail = async (verifyEmailToken: string) => {
//   try {
//     const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
//     const user = await userService.getUserById(verifyEmailTokenDoc.user);
//     if (!user) {
//       throw new Error();
//     }
//     await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
//     await userService.updateUserById(user.id, { isEmailVerified: true });
//   } catch (error) {
//     throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
//   }
// };

export {
  loginUserWithEmailAndPassword,
  refreshAuth
}
