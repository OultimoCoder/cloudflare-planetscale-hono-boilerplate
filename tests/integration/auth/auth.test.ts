import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { faker } from '@faker-js/faker'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import httpStatus from 'http-status'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser'
import { getConfig } from '../../../src/config/config'
import { Database, getDBClient } from '../../../src/config/database'
import { tokenTypes } from '../../../src/config/tokens'
import * as tokenService from '../../../src/services/token.service'
import { discordAuthorisation, insertAuthorisations } from '../../fixtures/authorisations.fixture'
import { getAccessToken, TokenResponse } from '../../fixtures/token.fixture'
import { userOne, insertUsers, MockUser, UserResponse } from '../../fixtures/user.fixture'
import { clearDBTables } from '../../utils/clearDBTables'
import { request } from '../../utils/testRequest'

const env = getMiniflareBindings()
const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user' as TableReference<Database>], config.database)

describe('Auth routes', () => {
  describe('POST /v1/auth/register', () => {
    let newUser: MockUser
    beforeEach(() => {
      newUser = {
        name: faker.name.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        is_email_verified: false,
        role: 'user'
      }
    })

    test('should return 201 and successfully register user if request data is ok', async () => {
      const res = await request('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.CREATED)
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: 'user',
        is_email_verified: 0
      })

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', body.user.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      expect(dbUser.password).not.toBe(newUser.password)
      expect(dbUser).toMatchObject({
        name: newUser.name,
        password: expect.anything(),
        email: newUser.email,
        role: 'user',
        is_email_verified: 0
      })

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() }
      })
    })

    test('should return 400 error if email is invalid', async () => {
      newUser.email = 'invalidEmail'

      const res = await request('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 error if email is already used', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email

      const res = await request('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 error if password length is less than 8 characters', async () => {
      newUser.password = 'passwo1'

      const res = await request('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if password does not contain both letters and numbers', async () => {
      newUser.password = 'password'

      const res = await request('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)

      newUser.password = '11111111'

      const res2 = await request('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res2.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('POST /v1/auth/login', () => {
    test('should return 200 and login user if email and password match', async () => {
      await insertUsers([userOne], config.database)
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password
      }

      const res = await request('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginCredentials),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.OK)
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).toEqual({
        id: expect.anything(),
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        is_email_verified: 0
      })

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() }
      })
    })

    test('should return 401 error if there are no users with that email', async () => {
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password
      }

      const res = await request('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginCredentials),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
      const body = await res.json()
      expect(body).toEqual({
        code: httpStatus.UNAUTHORIZED,
        message: 'Incorrect email or password'
      })
    })

    test('should return 401 error if only oauth account exists', async () => {
      const newUser = { ...userOne, password: null }
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const discordUser = discordAuthorisation(userId)
      await insertAuthorisations([discordUser], config.database)

      const loginCredentials = {
        email: newUser.email,
        password: ''
      }

      const res = await request('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginCredentials),
        headers: { 'Content-Type': 'application/json' }
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
      expect(body).toEqual({
        code: httpStatus.UNAUTHORIZED,
        message: 'Please login with your social account'
      })
    })

    test('should return 401 error if password is wrong', async () => {
      await insertUsers([userOne], config.database)
      const loginCredentials = {
        email: userOne.email,
        password: 'wrongPassword1'
      }

      const res = await request('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginCredentials),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
      const body = await res.json()
      expect(body).toEqual({
        code: httpStatus.UNAUTHORIZED,
        message: 'Incorrect email or password'
      })
    })
  })

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and new auth tokens if refresh token is valid', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const expires = dayjs().add(config.jwt.refreshExpirationDays, 'days')
      const refreshToken = await tokenService.generateToken(
        userId,
        tokenTypes.REFRESH,
        userOne.role,
        expires,
        config.jwt.secret
      )

      const res = await request('/v1/auth/refresh-tokens', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { 'Content-Type': 'application/json' }
      })
      const body = await res.json<{ tokens: TokenResponse }>()

      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() }
      })
    })

    test('should return 400 error if refresh token is missing from request body', async () => {
      const res = await request('/v1/auth/refresh-tokens', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 401 error if refresh token is signed using an invalid secret', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const expires = dayjs().add(config.jwt.refreshExpirationDays, 'days')
      const refreshToken = await tokenService.generateToken(
        userId,
        tokenTypes.REFRESH,
        userOne.role,
        expires,
        'random secret'
      )

      const res = await request('/v1/auth/refresh-tokens', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 401 error if refresh token is expired', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const expires = dayjs().subtract(1, 'minutes')
      const refreshToken = await tokenService.generateToken(
        userId,
        tokenTypes.REFRESH,
        userOne.role,
        expires,
        config.jwt.secret
      )

      const res = await request('/v1/auth/refresh-tokens', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 401 error if user is not found', async () => {
      const expires = dayjs().add(1, 'minutes')
      const refreshToken = await tokenService.generateToken(
        123,
        tokenTypes.REFRESH,
        userOne.role,
        expires,
        config.jwt.secret
      )

      const res = await request('/v1/auth/refresh-tokens', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
  })

  describe('POST /v1/auth/forgot-password', () => {
    const sesMock = mockClient(SESClient)

    beforeEach(() => {
      sesMock.reset()
    })

    test('should return 204 and send reset password email to the user', async () => {
      await insertUsers([userOne], config.database)
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'message-id'
      })
      const res = await request('/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: userOne.email }),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      expect(sesMock).toHaveReceivedCommandTimes(SendEmailCommand, 1)
    })

    test('should return 204 and send email if only has oauth account', async () => {
      const newUser = { ...userOne, password: null }
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const discordUser = discordAuthorisation(userId)
      await insertAuthorisations([discordUser], config.database)

      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'message-id'
      })
      const res = await request('/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: newUser.email }),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      expect(sesMock).toHaveReceivedCommandTimes(SendEmailCommand, 1)
    })

    test('should return 400 if email is missing', async () => {
      await insertUsers([userOne], config.database)

      const res = await request('/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 204 if email does not belong to any user', async () => {
      const res = await request('/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: userOne.email }),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
    })
  })

  describe('POST /v1/auth/send-verification-email', () => {
    const sesMock = mockClient(SESClient)

    beforeEach(() => {
      sesMock.reset()
    })

    test('should return 204 and send verification email to the user', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'message-id'
      })

      const res = await request('/v1/auth/send-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email: userOne.email }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      expect(sesMock).toHaveReceivedCommandTimes(SendEmailCommand, 1)
    })

    test('should return 204 and not send verification email if already verified', async () => {
      const newUser = { ...userOne }
      newUser.is_email_verified = true
      const ids = await insertUsers([newUser], config.database)
      const newUserAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)

      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'message-id'
      })

      const res = await request('/v1/auth/send-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email: newUser.email }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newUserAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      expect(sesMock).toHaveReceivedCommandTimes(SendEmailCommand, 0)
    })

    test('should return 429 if a second request is sent in under 2 minutes', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'message-id'
      })

      const res = await request('/v1/auth/send-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email: userOne.email }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const res2 = await request('/v1/auth/send-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email: userOne.email }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res2.status).toBe(httpStatus.TOO_MANY_REQUESTS)
      expect(sesMock).toHaveReceivedCommandTimes(SendEmailCommand, 1)
    })

    test('should return 401 error if access token is missing', async () => {
      await insertUsers([userOne], config.database)

      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'message-id'
      })

      const res = await request('/v1/auth/send-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email: userOne.email }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
  })

  describe('POST /v1/auth/reset-password', () => {
    test('should return 204 and reset the password', async () => {
      const ids = await insertUsers([userOne], config.database)
      const newPassword = 'iamanewpassword123'
      const expires = dayjs().add(config.jwt.resetPasswordExpirationMinutes, 'minutes')
      const resetPasswordToken = await tokenService.generateToken(
        ids[0],
        tokenTypes.RESET_PASSWORD,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', ids[0])
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      const isPasswordMatch = await bcrypt.compare(newPassword, dbUser.password || '')
      expect(isPasswordMatch).toBe(true)
    })

    test('should return 400 if reset password token is missing', async () => {
      const res = await request('/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'iamanewpasword123' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 401 if reset password token is expired', async () => {
      const ids = await insertUsers([userOne], config.database)
      const newPassword = 'iamanewpassword123'
      const expires = dayjs().subtract(10, 'minutes')
      const resetPasswordToken = await tokenService.generateToken(
        ids[0],
        tokenTypes.RESET_PASSWORD,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 401 if user is not found', async () => {
      const newPassword = 'iamanewpassword123'
      const expires = dayjs().add(config.jwt.resetPasswordExpirationMinutes, 'minutes')
      const resetPasswordToken = await tokenService.generateToken(
        123,
        tokenTypes.RESET_PASSWORD,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 400 if password is missing or invalid', async () => {
      const ids = await insertUsers([userOne], config.database)
      const expires = dayjs().add(config.jwt.resetPasswordExpirationMinutes, 'minutes')
      const resetPasswordToken = await tokenService.generateToken(
        ids[0],
        tokenTypes.RESET_PASSWORD,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)

      const res2 = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({ password: 'short1' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res2.status).toBe(httpStatus.BAD_REQUEST)

      const res3 = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({ password: 'password' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res3.status).toBe(httpStatus.BAD_REQUEST)

      const res4 = await request(`/v1/auth/reset-password?token=${resetPasswordToken}`, {
        method: 'POST',
        body: JSON.stringify({ password: '11111111' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res4.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('POST /v1/auth/verify-email', () => {
    test('should return 204 and verify the email', async () => {
      const ids = await insertUsers([userOne], config.database)
      const expires = dayjs().add(config.jwt.verifyEmailExpirationMinutes, 'minutes')
      const verifyEmailToken = await tokenService.generateToken(
        ids[0],
        tokenTypes.VERIFY_EMAIL,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/verify-email?token=${verifyEmailToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', ids[0])
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return
      expect(dbUser.is_email_verified).toBe(1)
    })

    test('should return 400 if verify email token is missing', async () => {
      const res = await request('/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 401 if verify email token is expired', async () => {
      const ids = await insertUsers([userOne], config.database)
      const expires = dayjs().subtract(10, 'minutes')
      const verifyEmailToken = await tokenService.generateToken(
        ids[0],
        tokenTypes.VERIFY_EMAIL,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/verify-email?token=${verifyEmailToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 401 if verify email token is an access token', async () => {
      const ids = await insertUsers([userOne], config.database)
      const expires = dayjs().add(10, 'minutes')
      const verifyEmailToken = await tokenService.generateToken(
        ids[0],
        tokenTypes.ACCESS,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/verify-email?token=${verifyEmailToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 401 if user is not found', async () => {
      const expires = dayjs().add(config.jwt.verifyEmailExpirationMinutes, 'minutes')
      const verifyEmailToken = await tokenService.generateToken(
        123,
        tokenTypes.VERIFY_EMAIL,
        userOne.role,
        expires,
        config.jwt.secret
      )
      const res = await request(`/v1/auth/verify-email?token=${verifyEmailToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
  })
  describe('Auth middleware', () => {
    test('should return 401 if auth header is malformed', async () => {
      const res = await request('/v1/users/123', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer123'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
  })
})
