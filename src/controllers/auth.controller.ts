import httpStatus from 'http-status';
// import * as authService from '../services/auth.service';
// import * as emailService from '../services/email.service';
import * as tokenService from '../services/token.service';
import * as userService from '../services/user.service';
import * as authValidation from '../validations/auth.validation';
import { Context } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';

const register = async (c: Context) => {
  let body = await c.req.parseBody()
  body = await authValidation.register.parseAsync(body);
  console.log(body)
  const user = await userService.createUser(body);
  const tokens = await tokenService.generateAuthTokens(user);
  return c.json({ user, tokens }, httpStatus.CREATED as StatusCode);
};

// const login = async (c: Context) => {
//   const {
//     body: { email, password },
//   } = authValidation.login.parse(c.req.parseBody());
//   const user = await authService.loginUserWithEmailAndPassword(email, password);
//   const tokens = await tokenService.generateAuthTokens(user);
//   return c.json({ user, tokens }, httpStatus.OK as StatusCode);
// };

// const logout = async (c: Context) => {
//   const { body } = authValidation.logout.parse(req);
//   await authService.logout(body.refreshToken);
//   c.status(httpStatus.NO_CONTENT as StatusCode);
//   return c.body(null)
// };

// const refreshTokens = async (c: Context) => {
//   const { body } = authValidation.refreshTokens.parse(c.req.parseBody());
//   const tokens = await authService.refreshAuth(body.refreshToken);
//   return c.json({ ...tokens }, httpStatus.OK as StatusCode);
// };

// const forgotPassword = async (c: Context) => {
//   const { body } = authValidation.forgotPassword.parse(c.req.parseBody());
//   const resetPasswordToken = await tokenService.generateResetPasswordToken(body.email);
//   await emailService.sendResetPasswordEmail(body.email, resetPasswordToken);
//   c.status(httpStatus.NO_CONTENT as StatusCode);
//   return c.body(null)
// };

// const resetPassword = async (c: Context) => {
//   const { body, query } = authValidation.resetPassword.parse(c.req.parseBody());
//   await authService.resetPassword(query.token, req.body.password);
//   c.status(httpStatus.NO_CONTENT as StatusCode);
//   return c.body(null)
// };

// const sendVerificationEmail = async (c: Context) => {
//   const user = c.get('payload').user
//   const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
//   await emailService.sendVerificationEmail(user.email, verifyEmailToken);
//   c.status(httpStatus.NO_CONTENT as StatusCode);
//   return c.body(null)
// };

// const verifyEmail = async (c: Context) => {
//   const { query } = authValidation.verifyEmail.parse(c.req.parseBody());
//   await authService.verifyEmail(query.token);
//   c.status(httpStatus.NO_CONTENT as StatusCode);
//   return c.body(null)
// };

export {
  register,
  // login,
  // logout,
  // refreshTokens,
  // forgotPassword,
  // resetPassword,
  // sendVerificationEmail,
  // verifyEmail
}
