import { faker } from '@faker-js/faker'
import { env, fetchMock } from 'cloudflare:test'
import httpStatus from 'http-status'
import { describe, expect, test, beforeAll, afterEach } from 'vitest'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { getDBClient } from '../../../../src/config/database'
import { tokenTypes } from '../../../../src/config/tokens'
import { GoogleUserType } from '../../../../src/types/oauth.types'
import {
  appleAuthorisation,
  githubAuthorisation,
  googleAuthorisation,
  insertAuthorisations
} from '../../../fixtures/authorisations.fixture'
import { getAccessToken, TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse, userTwo } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clear-db-tables'
import { request } from '../../../utils/test-request'

const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user', 'authorisations'], config.database)

describe('Oauth Google routes', () => {
  describe('GET /v1/auth/google/redirect', () => {
    test('should return 302 and successfully redirect to google', async () => {
      const state = btoa(JSON.stringify({ platform: 'web' }))
      const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.platform.web.redirectUrl)
      const res = await request(`/v1/auth/google/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=' +
          `${config.oauth.provider.google.clientId}&` +
          `include_granted_scopes=true&redirect_uri=${urlEncodedRedirectUrl}&` +
          `response_type=code&scope=openid%20email%20profile&state=${state}`
      )
    })
    test('should return 400 error if state is not provided', async () => {
      const res = await request('/v1/auth/google/redirect', { method: 'GET' })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if state platform is not provided', async () => {
      const state = btoa(JSON.stringify({}))
      const res = await request(`/v1/auth/google/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if state platform is invalid', async () => {
      const state = btoa(JSON.stringify({ platform: 'fake' }))
      const res = await request(`/v1/auth/google/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })
  describe('POST /v1/auth/google/callback', () => {
    let newUser: GoogleUserType
    beforeAll(async () => {
      newUser = {
        id: faker.number.int().toString(),
        name: faker.person.fullName(),
        email: faker.internet.email()
      }
      fetchMock.activate()
    })
    afterEach(async () => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully register user if request data is ok', async () => {
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({ method: 'GET', path: '/oauth2/v2/userinfo' })
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const providerId = '123456'
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
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
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', body.user.id)
        .where('authorisations.provider_user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() }
      })
    })

    test('should return 200 and successfully login user if already created', async () => {
      await insertUsers([userOne], config.database)
      const googleUser = googleAuthorisation(userOne.id)
      await insertAuthorisations([googleUser], config.database)
      newUser.id = googleUser.provider_user_id
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({ method: 'GET', path: '/oauth2/v2/userinfo' })
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const providerId = '123456'
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).toEqual({
        id: userOne.id,
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

    test('should return 403 if user exists but has not linked their google', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({ method: 'GET', path: '/oauth2/v2/userinfo' })
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const providerId = '123456'
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.FORBIDDEN)
      expect(body).toEqual({
        code: httpStatus.FORBIDDEN,
        message: 'Cannot signup with google, user already exists with that email'
      })
    })

    test('should return 401 if code is invalid', async () => {
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const providerId = '123456'
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 400 if no code provided', async () => {
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ platform: 'web' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if platform is not provided', async () => {
      const providerId = '123456'
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if platform is invalid', async () => {
      const providerId = '123456'
      const res = await request('/v1/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'wb' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })
  describe('POST /v1/auth/google/:userId', () => {
    let newUser: GoogleUserType
    beforeAll(async () => {
      newUser = {
        id: faker.number.int().toString(),
        name: faker.person.fullName(),
        email: faker.internet.email()
      }
      fetchMock.activate()
    })
    afterEach(async () => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully link google account', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({ method: 'GET', path: '/oauth2/v2/userinfo' })
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', userOne.id)
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
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', userOne.id)
        .where('authorisations.provider_user_id', '=', newUser.id)
        .execute()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return
    })

    test('should return 401 if user does not exist when linking', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      await client.deleteFrom('user').where('user.id', '=', userOne.id).execute()
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({ method: 'GET', path: '/oauth2/v2/userinfo' })
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', userOne.id)
        .where('authorisations.provider_user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
    })

    test('should return 401 if code is invalid', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({ method: 'POST', path: '/token' })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 if linking different user', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

      const providerId = '123456'
      const res = await request('/v1/auth/google/5298', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 400 if no code provided', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'web' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 401 error if access token is missing', async () => {
      const res = await request('/v1/auth/google/1234', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/auth/google/5298', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
    test('should return 400 error if platform is not provided', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if platform is invalid', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'wb' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('DELETE /v1/auth/google/:userId', () => {
    test('should return 200 and successfully remove google account link', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const googleUser = googleAuthorisation(userOne.id)
      await insertAuthorisations([googleUser], config.database)

      const res = await request(`/v1/auth/google/${userOne.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', userOne.id)
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
      if (!oauthUser) return
    })

    test('should return 400 if user does not have a local login and only 1 link', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const googleUser = googleAuthorisation(newUser.id)
      await insertAuthorisations([googleUser], config.database)

      const res = await request(`/v1/auth/google/${newUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
    })

    test('should return 400 if user does not have google link', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const githubUser = githubAuthorisation(newUser.id)
      await insertAuthorisations([githubUser], config.database)
      const appleUser = appleAuthorisation(newUser.id)
      await insertAuthorisations([appleUser], config.database)

      const res = await request(`/v1/auth/google/${newUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if user only has a local login', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userId = newUser.id
      const userOneAccessToken = await getAccessToken(userId, newUser.role, config.jwt)

      const res = await request(`/v1/auth/google/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 200 if user does not have a local login and 2 links', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const googleUser = googleAuthorisation(newUser.id)
      const appleUser = appleAuthorisation(newUser.id)
      await insertAuthorisations([googleUser, appleUser], config.database)

      const res = await request(`/v1/auth/google/${newUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const oauthGoogleUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthGoogleUser).toBeUndefined()

      const oauthFacebookUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthFacebookUser).toBeDefined()
    })

    test('should return 403 if unlinking different user', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

      const res = await request('/v1/auth/google/5298', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 401 error if access token is missing', async () => {
      const res = await request('/v1/auth/google/1234', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/auth/google/5298', {
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
