import httpStatus from 'http-status';
import * as authService from '../services/auth.service';
// import * as emailService from '../services/email.service';
import * as tokenService from '../services/token.service';
import * as userService from '../services/user.service';
import * as authValidation from '../validations/auth.validation';
import { Handler } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { Bindings } from '../../bindings';

const register: Handler<{ Bindings: Bindings }> = async (c) => {
  const bodyParse = await c.req.json()
  const body = await authValidation.register.parseAsync(bodyParse)
  const user = await userService.createUser(body)
  const tokens = await tokenService.generateAuthTokens(user);
  return c.json({user, tokens}, httpStatus.CREATED as StatusCode);
};

const login: Handler<{ Bindings: Bindings }> = async (c) => {
  const bodyParse = await c.req.json()
  const { email, password } = authValidation.login.parse(bodyParse)
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  return c.json({ user, tokens }, httpStatus.OK as StatusCode);
};

const refreshTokens: Handler<{ Bindings: Bindings }> = async (c) => {
  const bodyParse = await c.req.json()
  const { refresh_token } = authValidation.refreshTokens.parse(bodyParse)
  const tokens = await authService.refreshAuth(refresh_token);
  return c.json({ ...tokens }, httpStatus.OK as StatusCode);
};

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
  login,
  refreshTokens,
  // forgotPassword,
  // resetPassword,
  // sendVerificationEmail,
  // verifyEmail
}
