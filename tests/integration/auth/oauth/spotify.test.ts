import { faker } from '@faker-js/faker'
import { env, fetchMock } from 'cloudflare:test'
import httpStatus from 'http-status'
import { describe, expect, test, beforeAll, afterEach } from 'vitest'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { getDBClient } from '../../../../src/config/database'
import { tokenTypes } from '../../../../src/config/tokens'
import { SpotifyUserType } from '../../../../src/types/oauth.types'
import {
  spotifyAuthorisation,
  insertAuthorisations,
  facebookAuthorisation,
  githubAuthorisation
} from '../../../fixtures/authorisations.fixture'
import { getAccessToken, TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse, userTwo } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clear-db-tables'
import { request } from '../../../utils/test-request'

const config = getConfig(env)
const client = getDBClient(config.database)
const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.platform.web.redirectUrl)

clearDBTables(['user', 'authorisations'], config.database)

describe('Oauth Spotify routes', () => {
  describe('GET /v1/auth/spotify/redirect', () => {
    test('should return 302 and successfully redirect to spotify', async () => {
      const state = btoa(JSON.stringify({ platform: 'web' }))
      const res = await request(`/v1/auth/spotify/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        'https://accounts.spotify.com/authorize?client_id=' +
          `${config.oauth.provider.spotify.clientId}&` +
          `redirect_uri=${urlEncodedRedirectUrl}&response_type=code&` +
          `scope=user-read-email&show_dialog=false&state=${state}`
      )
    })
    test('should return 400 error if state is not provided', async () => {
      const res = await request('/v1/auth/spotify/redirect', { method: 'GET' })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if state platform is not provided', async () => {
      const state = btoa(JSON.stringify({}))
      const res = await request(`/v1/auth/spotify/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 400 error if state platform is invalid', async () => {
      const state = btoa(JSON.stringify({ platform: 'fake' }))
      const res = await request(`/v1/auth/spotify/redirect?state=${state}`, {
        method: 'GET'
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('POST /v1/auth/spotify/callback', () => {
    let newUser: SpotifyUserType
    beforeAll(async () => {
      newUser = {
        id: faker.number.int().toString(),
        display_name: faker.person.fullName(),
        email: faker.internet.email()
      }
      fetchMock.activate()
    })
    afterEach(() => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully register user if request data is ok', async () => {
      const providerId = '123456'
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({ method: 'GET', path: '/v1/me' })
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const res = await request('/v1/auth/spotify/callback', {
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
        name: newUser.display_name,
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
        name: newUser.display_name,
        password: null,
        email: newUser.email,
        role: 'user',
        is_email_verified: 1
      })

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
        .where('authorisations.user_id', '=', body.user.id)
        .where('authorisations.provider_user_id', '=', String(newUser.id))
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
      const spotifyUser = spotifyAuthorisation(userOne.id)
      await insertAuthorisations([spotifyUser], config.database)
      newUser.id = spotifyUser.provider_user_id
      const providerId = '123456'
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({ method: 'GET', path: '/v1/me' })
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const res = await request('/v1/auth/spotify/callback', {
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

    test('should return 403 if user exists but has not linked their spotify', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email
      const providerId = '123456'
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({ method: 'GET', path: '/v1/me' })
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const res = await request('/v1/auth/spotify/callback', {
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
        message: 'Cannot signup with spotify, user already exists with that email'
      })
    })

    test('should return 401 if code is invalid', async () => {
      const providerId = '123456'
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const res = await request('/v1/auth/spotify/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'web' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 400 if no code provided', async () => {
      const res = await request('/v1/auth/spotify/callback', {
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
      const res = await request('/v1/auth/spotify/callback', {
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
      const res = await request('/v1/auth/spotify/callback', {
        method: 'POST',
        body: JSON.stringify({ code: providerId, platform: 'wb' }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })
  describe('POST /v1/auth/spotify/:userId', () => {
    let newUser: SpotifyUserType
    beforeAll(async () => {
      newUser = {
        id: faker.number.int().toString(),
        display_name: faker.person.fullName(),
        email: faker.internet.email()
      }
      fetchMock.activate()
    })
    afterEach(() => fetchMock.assertNoPendingInterceptors())
    test('should return 200 and successfully link spotify account', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const providerId = '123456'
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({ method: 'GET', path: '/v1/me' })
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
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
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
        .where('authorisations.user_id', '=', userOne.id)
        .where('authorisations.provider_user_id', '=', String(newUser.id))
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return
    })

    test('should return 401 if user does not exist when linking', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      await client.deleteFrom('user').where('user.id', '=', userOne.id).execute()
      const providerId = '123456'
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({ method: 'GET', path: '/v1/me' })
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(200, JSON.stringify({ access_token: '1234' }))

      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
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
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
        .where('authorisations.user_id', '=', userOne.id)
        .where('authorisations.provider_user_id', '=', String(newUser.id))
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
    })

    test('should return 401 if code is invalid', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const providerId = '123456'
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path:
            `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`
        })
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({ error: 'error' }))

      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
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
      const res = await request('/v1/auth/spotify/5298', {
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

      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
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
      const res = await request('/v1/auth/spotify/1234', {
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
      const res = await request('/v1/auth/spotify/5298', {
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
      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
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
      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
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

  describe('DELETE /v1/auth/spotify/:userId', () => {
    test('should return 200 and successfully remove spotify account link', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const spotifyUser = spotifyAuthorisation(userOne.id)
      await insertAuthorisations([spotifyUser], config.database)

      const res = await request(`/v1/auth/spotify/${userOne.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
        .where('authorisations.user_id', '=', userOne.id)
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
      if (!oauthUser) return
    })

    test('should return 400 if user does not have a local login and only 1 link', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const spotifyUser = spotifyAuthorisation(newUser.id)
      await insertAuthorisations([spotifyUser], config.database)

      const res = await request(`/v1/auth/spotify/${newUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
    })

    test('should return 400 if user only has a local login', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)

      const res = await request(`/v1/auth/spotify/${newUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if user does not have spotify link', async () => {
      const newUser = { ...userOne, password: null }
      await insertUsers([newUser], config.database)
      const userOneAccessToken = await getAccessToken(newUser.id, newUser.role, config.jwt)
      const githubUser = githubAuthorisation(newUser.id)
      await insertAuthorisations([githubUser], config.database)
      const facebookUser = facebookAuthorisation(newUser.id)
      await insertAuthorisations([facebookUser], config.database)

      const res = await request(`/v1/auth/spotify/${newUser.id}`, {
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
      const spotifyUser = spotifyAuthorisation(newUser.id)
      const facebookUser = facebookAuthorisation(newUser.id)
      await insertAuthorisations([spotifyUser, facebookUser], config.database)

      const res = await request(`/v1/auth/spotify/${newUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)

      const oauthSpotifyUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthSpotifyUser).toBeUndefined()

      const oauthFacebookUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.FACEBOOK)
        .where('authorisations.user_id', '=', newUser.id)
        .executeTakeFirst()

      expect(oauthFacebookUser).toBeDefined()
    })

    test('should return 403 if unlinking different user', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

      const res = await request('/v1/auth/spotify/5298', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 401 error if access token is missing', async () => {
      const res = await request('/v1/auth/spotify/1234', {
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
      const res = await request('/v1/auth/spotify/5298', {
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
