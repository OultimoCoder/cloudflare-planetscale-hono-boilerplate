import { faker } from '@faker-js/faker'
import jwt from '@tsndr/cloudflare-worker-jwt'
import { env, fetchMock } from 'cloudflare:test'
import httpStatus from 'http-status'
import { describe, expect, test, beforeAll, afterEach } from 'vitest'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { getDBClient } from '../../../../src/config/database'
import { tokenTypes } from '../../../../src/config/tokens'
import { AppleUserType } from '../../../../src/types/oauth.types'
import {
  appleAuthorisation,
  facebookAuthorisation,
  githubAuthorisation,
  insertAuthorisations
} from '../../../fixtures/authorisations.fixture'
import { getAccessToken, TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse, userTwo } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clearDBTables'
import { request } from '../../../utils/testRequest'

const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user', 'authorisations'], config.database)

describe('Oauth Apple routes', () => {
  describe('GET /v1/auth/apple/redirect', () => {
    test('should return 302 and successfully redirect to apple', async () => {
      const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.apple.redirectUrl)
      const res = await request('/v1/auth/apple/redirect', {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toContain(
        'https://appleid.apple.com/auth/authorize?client_id=myclientid&redirect_uri=' +
          `${urlEncodedRedirectUrl}&response_mode=query&response_type=code&scope=`
      )
    })
  })

  describe('POST /v1/auth/apple/callback', () => {
    let newUser: AppleUserType
    beforeAll(async () => {
      newUser = {
        sub: faker.number.int().toString(),
        name: faker.person.fullName(),
        email: faker.internet.email()
      }
      fetchMock.activate()
    })
    afterEach(() => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully register user if request data is ok', async () => {
      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ access_token: mockJWT }))
      const providerId = '123456'
      const res = await request('/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: 'user',
        is_email_verified: 1
      })

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', body.user.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      expect(dbUser.password).toBeNull()
      expect(dbUser).toMatchObject({
        name: newUser.name,
        password: null,
        email: newUser.email,
        role: 'user',
        is_email_verified: 1
      })

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', body.user.id)
        .where('authorisations.provider_user_id', '=', newUser.sub)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() }
      })
    })

    test('should return 200 and successfully login user if already created', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const appleUser = appleAuthorisation(userId)
      await insertAuthorisations([appleUser], config.database)
      newUser.sub = appleUser.provider_user_id

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ access_token: mockJWT }))

      const providerId = '123456'
      const res = await request('/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).toEqual({
        id: userId,
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

    test('should return 403 if user exists but has not linked their apple', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ access_token: mockJWT }))

      const providerId = '123456'
      const res = await request('/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.FORBIDDEN)
      expect(body).toEqual({
        code: httpStatus.FORBIDDEN,
        message: 'Cannot signup with apple, user already exists with that email'
      })
    })
    test('should return xxx if no apple email is provided', async () => {
      delete newUser.email
      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ access_token: mockJWT }))
      const providerId = '123456'
      const res = await request('/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
    test('should return 401 if code is invalid', async () => {
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const providerId = '123456'
      const res = await request('/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 400 if no code provided', async () => {
      const res = await request('/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('POST /v1/auth/apple/:userId', () => {
    let newUser: AppleUserType
    beforeAll(async () => {
      newUser = {
        sub: faker.number.int().toString(),
        name: faker.person.fullName(),
        email: faker.internet.email()
      }
    })
    test('should return 200 and successfully link apple account', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ access_token: mockJWT }))

      const providerId = '123456'
      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', userId)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      expect(dbUser.password).toBeDefined()
      expect(dbUser).toMatchObject({
        name: userOne.name,
        password: expect.anything(),
        email: userOne.email,
        role: userOne.role,
        is_email_verified: 0
      })

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', userId)
        .where('authorisations.provider_user_id', '=', newUser.sub)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return
    })

    test('should return 401 if user does not exist when linking', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(userId, userOne.role, config.jwt)
      await client.deleteFrom('user').where('user.id', '=', userId).execute()

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ access_token: mockJWT }))

      const providerId = '123456'
      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', userId)
        .where('authorisations.provider_user_id', '=', String(newUser.sub))
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
    })

    test('should return 401 if code is invalid', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const providerId = '123456'
      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 if linking different user', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(userId, userOne.role, config.jwt)

      const providerId = '123456'
      const res = await request('/v1/auth/apple/5298', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 400 if no code provided', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 401 error if access token is missing', async () => {
      const res = await request('/v1/auth/apple/1234', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
    test('should return 403 if user has not verified their email', async () => {
      const ids = await insertUsers([userTwo], config.database)
      const userId = ids[0]
      const accessToken = await getAccessToken(
        userId,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/auth/apple/5298', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })

  describe('DELETE /v1/auth/apple/:userId', () => {
    test('should return 200 and successfully remove apple account link', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const appleUser = appleAuthorisation(userId)
      await insertAuthorisations([appleUser], config.database)

      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
      if (!oauthUser) return
    })

    test('should return 400 if user does not have a local login and only 1 link', async () => {
      const newUser = { ...userOne, password: null }
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)
      const appleUser = appleAuthorisation(userId)
      await insertAuthorisations([appleUser], config.database)

      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
    })

    test('should return 400 if user does not have apple link', async () => {
      const newUser = { ...userOne, password: null }
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)
      const githubUser = githubAuthorisation(userId)
      await insertAuthorisations([githubUser], config.database)
      const facebookUser = facebookAuthorisation(userId)
      await insertAuthorisations([facebookUser], config.database)

      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if user only has a local login', async () => {
      const newUser = { ...userOne, password: null }
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)

      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 200 if user does not have a local login and 2 links', async () => {
      const newUser = { ...userOne, password: null }
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)
      const appleUser = appleAuthorisation(userId)
      const facebookUser = facebookAuthorisation(userId)
      await insertAuthorisations([appleUser, facebookUser], config.database)

      const res = await request(`/v1/auth/apple/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const oauthAppleUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthAppleUser).toBeUndefined()

      const oauthFacebookUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.FACEBOOK)
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthFacebookUser).toBeDefined()
    })

    test('should return 403 if unlinking different user', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(userId, userOne.role, config.jwt)

      const res = await request('/v1/auth/apple/5298', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 401 error if access token is missing', async () => {
      const res = await request('/v1/auth/apple/1234', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
    test('should return 403 if user has not verified their email', async () => {
      const ids = await insertUsers([userTwo], config.database)
      const userId = ids[0]
      const accessToken = await getAccessToken(
        userId,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/auth/apple/5298', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })
})
