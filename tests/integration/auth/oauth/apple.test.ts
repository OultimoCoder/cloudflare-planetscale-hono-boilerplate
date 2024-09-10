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
  githubAuthorisation,
  googleAuthorisation,
  insertAuthorisations
} from '../../../fixtures/authorisations.fixture'
import { getAccessToken } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, userTwo } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clear-db-tables'
import { request } from '../../../utils/test-request'

const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['authorisations', 'user'], config.database)

describe('Oauth Apple routes', () => {
  describe('GET /v1/auth/apple/redirect', () => {
    test('should return 302 and successfully redirect to apple', async () => {
      const state = btoa(JSON.stringify({ platform: 'web' }))
      const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.provider.apple.redirectUrl)
      const res = await request(`/v1/auth/apple/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toContain(
        'https://appleid.apple.com/auth/authorize?client_id=myclientid&redirect_uri=' +
          `${urlEncodedRedirectUrl}&response_mode=form_post&response_type=code&scope=email` +
          `&state=${state}`
      )
    })
    test('should return 400 error if state is not provided', async () => {
      const res = await request('/v1/auth/apple/redirect', { method: 'GET' })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if state platform is not provided', async () => {
      const state = btoa(JSON.stringify({}))
      const res = await request(`/v1/auth/apple/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if state platform is invalid', async () => {
      const state = btoa(JSON.stringify({ platform: 'fake' }))
      const res = await request(`/v1/auth/apple/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('POST /v1/auth/apple/callback', () => {
    let newUser: AppleUserType
    let state: string
    beforeAll(async () => {
      newUser = {
        sub: faker.number.int().toString(),
        name: faker.person.fullName(),
        email: faker.internet.email()
      }
      fetchMock.activate()
      state = btoa(JSON.stringify({ platform: 'web' }))
    })
    afterEach(() => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully register + redirect with one time code', async () => {
      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ id_token: mockJWT }))
      const providerId = '123456'
      const formData = new FormData()
      formData.append('code', providerId)
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toContain(
        `${config.oauth.platform.ios.redirectUrl}?oneTimeCode=`
      )
      const location = res.headers.get('location')
      const oneTimeCode = location?.split('=')[1].split('&')[0]
      expect(oneTimeCode).toBeDefined()
      if (!oneTimeCode) return

      const returnedState = location?.split('=')[2]
      expect(returnedState).toBe(state)

      const dbOneTimeCode = await client
        .selectFrom('one_time_oauth_code')
        .selectAll()
        .where('one_time_oauth_code.code', '=', oneTimeCode)
        .executeTakeFirst()

      expect(dbOneTimeCode).toBeDefined()
      if (!dbOneTimeCode) return

      expect(dbOneTimeCode).toEqual({
        code: oneTimeCode,
        user_id: expect.any(String),
        access_token: expect.any(String),
        access_token_expires_at: expect.any(Date),
        refresh_token: expect.any(String),
        refresh_token_expires_at: expect.any(Date),
        expires_at: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      })

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', dbOneTimeCode.user_id)
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
        .where('authorisations.user_id', '=', dbOneTimeCode.user_id)
        .where('authorisations.provider_user_id', '=', newUser.sub)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return
    })

    test('should redirect and successfully login user if already created', async () => {
      await insertUsers([userOne], config.database)
      const appleUser = appleAuthorisation(userOne.id)
      await insertAuthorisations([appleUser], config.database)
      newUser.sub = appleUser.provider_user_id

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ id_token: mockJWT }))

      const providerId = '123456'
      const formData = new FormData()
      formData.append('code', providerId)
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toContain(
        `${config.oauth.platform.ios.redirectUrl}?oneTimeCode=`
      )
      expect(res.headers.get('location')).toContain(`state=${state}`)
    })
    test('should redirect with error if user exists but has not linked their apple', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email
      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ id_token: mockJWT }))

      const providerId = '123456'
      const formData = new FormData()
      formData.append('code', providerId)
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      const encodedError =
        'Cannot%20signup%20with%20apple,' + '%20user%20already%20exists%20with%20that%20email'
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.ios.redirectUrl}?error=${encodedError}&state=${state}`
      )
    })
    //TODO: return custom error message for this scenario
    test('should redirect with error if no apple email is provided', async () => {
      delete newUser.email
      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ id_token: mockJWT }))
      const providerId = '123456'
      const formData = new FormData()
      formData.append('state', state)
      formData.append('code', providerId)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.ios.redirectUrl}?error=Unauthorized&state=${state}`
      )
    })
    test('should redirect with error if code is invalid', async () => {
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const providerId = '123456'
      const formData = new FormData()
      formData.append('code', providerId)
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.ios.redirectUrl}?error=Unauthorized&state=${state}`
      )
    })

    test('should redirect with error if no code provided', async () => {
      const formData = new FormData()
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.ios.redirectUrl}?error=Bad%20request&state=${state}`
      )
    })
    test('should return 400 error if state is not provided', async () => {
      const providerId = '123456'
      const formData = new FormData()
      formData.append('code', providerId)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.web.redirectUrl}?error=Something%20went%20wrong`
      )
    })
    test('should return 400 error if platform is not provided', async () => {
      const providerId = '123456'
      const formData = new FormData()
      state = btoa(JSON.stringify({}))
      formData.append('code', providerId)
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.web.redirectUrl}?error=Bad%20request&state=${state}`
      )
    })
    test('should return 400 error if platform is invalid', async () => {
      const providerId = '123456'
      const formData = new FormData()
      state = btoa(JSON.stringify({ platform: 'wb' }))
      formData.append('code', providerId)
      formData.append('state', state)
      const res = await request('/v1/auth/apple/callback', { method: 'POST', body: formData })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `${config.oauth.platform.web.redirectUrl}?error=Bad%20request&state=${state}`
      )
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
      fetchMock.activate()
    })
    afterEach(() => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully link apple account', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ id_token: mockJWT }))

      const providerId = '123456'
      const res = await request(`/v1/auth/apple/${userOne.id}`, {
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
        .where('authorisations.provider_type', '=', authProviders.APPLE)
        .where('authorisations.user_id', '=', userOne.id)
        .where('authorisations.provider_user_id', '=', newUser.sub)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return
    })

    test('should return 401 if user does not exist when linking', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      await client.deleteFrom('user').where('user.id', '=', userOne.id).execute()

      const mockJWT = await jwt.sign(newUser, 'randomSecret')
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(200, JSON.stringify({ id_token: mockJWT }))

      const providerId = '123456'
      const res = await request(`/v1/auth/apple/${userOne.id}`, {
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
        .where('authorisations.user_id', '=', userOne.id)
        .where('authorisations.provider_user_id', '=', String(newUser.sub))
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
    })

    test('should return 401 if code is invalid', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const appleMock = fetchMock.get('https://appleid.apple.com')
      appleMock
        .intercept({ method: 'POST', path: '/auth/token' })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const providerId = '123456'
      const res = await request(`/v1/auth/apple/${userOne.id}`, {
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
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

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
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

      const res = await request(`/v1/auth/apple/${userOne.id}`, {
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
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
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
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const appleUser = appleAuthorisation(userOne.id)
      await insertAuthorisations([appleUser], config.database)

      const res = await request(`/v1/auth/apple/${userOne.id}`, {
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
        .where('authorisations.user_id', '=', userOne.id)
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
      if (!oauthUser) return
    })

    test('should return 400 if user does not have a local login and only 1 link', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const appleUser = appleAuthorisation(newUser.id)
      await insertAuthorisations([appleUser], config.database)

      const res = await request(`/v1/auth/apple/${newUser.id}`, {
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
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
    })

    test('should return 400 if user does not have apple link', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const githubUser = githubAuthorisation(newUser.id)
      await insertAuthorisations([githubUser], config.database)
      const googleUser = googleAuthorisation(newUser.id)
      await insertAuthorisations([googleUser], config.database)

      const res = await request(`/v1/auth/apple/${newUser.id}`, {
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
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)

      const res = await request(`/v1/auth/apple/${newUser.id}`, {
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
      const appleUser = appleAuthorisation(newUser.id)
      const githubUser = githubAuthorisation(newUser.id)
      await insertAuthorisations([appleUser, githubUser], config.database)

      const res = await request(`/v1/auth/apple/${newUser.id}`, {
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
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthAppleUser).toBeUndefined()

      const oauthFacebookUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.GITHUB)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthFacebookUser).toBeDefined()
    })

    test('should return 403 if unlinking different user', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

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
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
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
