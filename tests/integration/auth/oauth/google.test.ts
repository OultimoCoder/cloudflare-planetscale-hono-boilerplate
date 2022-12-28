import { faker } from '@faker-js/faker'
import httpStatus from 'http-status'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { Database, getDBClient } from '../../../../src/config/database'
import { OauthUser } from '../../../../src/models/authProvider.model'
import { facebookAuthorisation, googleAuthorisation, insertAuthorisations} from '../../../fixtures/authorisations.fixture'
import { getAccessToken, TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clearDBTables'
import { request } from '../../../utils/testRequest'

const env = getMiniflareBindings()
const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user' as TableReference<Database>], config.database)

describe('Oauth Google routes', () => {
  describe('GET /v1/auth/google/redirect', () => {
    test('should return 302 and successfully redirect to google', async () => {
      const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.google.redirectUrl)
      const res = await request('/v1/auth/google/redirect', {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.oauth.google.clientId}&` +
        `include_granted_scopes=true&redirect_uri=${urlEncodedRedirectUrl}&` +
        'response_type=code&scope=openid%20email%20profile&state=pass-through%20value'
      )
    })

    describe('GET /v1/auth/google/callback', () => {
      let newUser: Omit<OauthUser, 'providerType'>
      beforeAll(async () => {
        newUser = {
          id: faker.datatype.number(),
          name: faker.name.fullName(),
          email: faker.internet.email(),
        }
      })
      test('should return 200 and successfully register user if request data is ok', async () => {
        const fetchMock = getMiniflareFetchMock()
        const googleApiMock = fetchMock.get('https://www.googleapis.com')
        googleApiMock
          .intercept({method: 'GET', path: '/oauth2/v2/userinfo'})
          .reply(200, JSON.stringify(newUser))
        const googleMock = fetchMock.get('https://oauth2.googleapis.com')
        googleMock
          .intercept({method: 'POST', path: '/token'})
          .reply(200, JSON.stringify({access_token: '1234'}))

        const providerId = 123456
        const res = await request(`/v1/auth/google/callback?code=${providerId}`, {
          method: 'GET',
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
          .where('authorisations.user_id', '=', String(body.user.id))
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
        const ids = await insertUsers([userOne], config.database)
        const userId = ids[0].toString()
        const googleUser = googleAuthorisation(userId)
        await insertAuthorisations([googleUser], config.database)
        newUser.id = parseInt(googleUser.provider_user_id)

        const fetchMock = getMiniflareFetchMock()
        const googleApiMock = fetchMock.get('https://www.googleapis.com')
        googleApiMock
          .intercept({method: 'GET', path: '/oauth2/v2/userinfo'})
          .reply(200, JSON.stringify(newUser))
        const googleMock = fetchMock.get('https://oauth2.googleapis.com')
        googleMock
          .intercept({method: 'POST', path: '/token'})
          .reply(200, JSON.stringify({access_token: '1234'}))

        const providerId = 123456
        const res = await request(`/v1/auth/google/callback?code=${providerId}`, {
          method: 'GET',
        })
        const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
        expect(res.status).toBe(httpStatus.OK)
        expect(body.user).not.toHaveProperty('password')
        expect(body.user).toEqual({
          id: parseInt(userId),
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

        const fetchMock = getMiniflareFetchMock()
        const googleApiMock = fetchMock.get('https://www.googleapis.com')
        googleApiMock
          .intercept({method: 'GET', path: '/oauth2/v2/userinfo'})
          .reply(200, JSON.stringify(newUser))
        const googleMock = fetchMock.get('https://oauth2.googleapis.com')
        googleMock
          .intercept({method: 'POST', path: '/token'})
          .reply(200, JSON.stringify({access_token: '1234'}))

        const providerId = 123456
        const res = await request(`/v1/auth/google/callback?code=${providerId}`, {
          method: 'GET',
        })
        const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
        expect(res.status).toBe(httpStatus.FORBIDDEN)
        expect(body).toEqual({
          code: httpStatus.FORBIDDEN,
          message: 'Cannot signup with google, user already exists with that email'
        })
      })


      test('should return 401 if code is invalid', async () => {
        const fetchMock = getMiniflareFetchMock()
        const googleMock = fetchMock.get('https://oauth2.googleapis.com')
        googleMock
          .intercept({method: 'POST', path: '/token'})
          .reply(httpStatus.UNAUTHORIZED, JSON.stringify({error: 'error'}))

        const providerId = 123456
        const res = await request(`/v1/auth/google/callback?code=${providerId}`, {
          method: 'GET',
        })
        expect(res.status).toBe(httpStatus.UNAUTHORIZED)
      })

      test('should return 400 if no code provided', async () => {
        const res = await request('/v1/auth/google/callback', {
          method: 'GET',
        })
        expect(res.status).toBe(httpStatus.BAD_REQUEST)
      })
    })
  })
  describe('POST /v1/auth/google/:userId', () => {
    let newUser: Omit<OauthUser, 'providerType'>
    beforeAll(async () => {
      newUser = {
        id: faker.datatype.number(),
        name: faker.name.fullName(),
        email: faker.internet.email(),
      }
    })
    test('should return 200 and successfully link google account', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      const fetchMock = getMiniflareFetchMock()
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({method: 'GET', path: '/oauth2/v2/userinfo'})
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({method: 'POST', path: '/token'})
        .reply(200, JSON.stringify({access_token: '1234'}))

      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userId}`, {
        method: 'POST',
        body: JSON.stringify({code: providerId}),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.OK)

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
        .where('authorisations.provider_type', '=', authProviders.GOOGLE)
        .where('authorisations.user_id', '=', userId)
        .where('authorisations.provider_user_id', '=', String(newUser.id))
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
      if (!oauthUser) return
    })

    test('should return 401 if user does not exist when linking', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(userId, userOne.role, config.jwt)
      await client
        .deleteFrom('user')
        .where('user.id', '=', userId)
        .execute()

      const fetchMock = getMiniflareFetchMock()
      const googleApiMock = fetchMock.get('https://www.googleapis.com')
      googleApiMock
        .intercept({method: 'GET', path: '/oauth2/v2/userinfo'})
        .reply(200, JSON.stringify(newUser))
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({method: 'POST', path: '/token'})
        .reply(200, JSON.stringify({access_token: '1234'}))

      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userId}`, {
        method: 'POST',
        body: JSON.stringify({code: providerId}),
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
        .where('authorisations.user_id', '=', userId)
        .where('authorisations.provider_user_id', '=', String(newUser.id))
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
    })

    test('should return 401 if code is invalid', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      const fetchMock = getMiniflareFetchMock()
      const googleMock = fetchMock.get('https://oauth2.googleapis.com')
      googleMock
        .intercept({method: 'POST', path: '/token'})
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({error: 'error'}))

      const providerId = '123456'
      const res = await request(`/v1/auth/google/${userId}`, {
        method: 'POST',
        body: JSON.stringify({code: providerId}),
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
      const res = await request('/v1/auth/google/5298', {
        method: 'POST',
        body: JSON.stringify({code: providerId}),
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

      const res = await request(`/v1/auth/google/${userId}`, {
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
      const res = await request('/v1/auth/google/1234', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
  })

  describe('DELETE /v1/auth/google/:userId', () => {
    test('should return 200 and successfully remove google account link', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const googleUser = googleAuthorisation(userId)
      await insertAuthorisations([googleUser], config.database)

      const res = await request(`/v1/auth/google/${userId}`, {
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
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthUser).toBeUndefined()
      if (!oauthUser) return
    })

    test('should return 400 if user does not have a local login and only 1 link', async () => {
      const newUser = { ...userOne }
      delete newUser.password
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)
      const googleUser = googleAuthorisation(userId)
      await insertAuthorisations([googleUser], config.database)

      const res = await request(`/v1/auth/google/${userId}`, {
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
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthUser).toBeDefined()
    })

    test('should return 400 if user does not have google link', async () => {
      const newUser = { ...userOne }
      delete newUser.password
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)

      const res = await request(`/v1/auth/google/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 200 if user does not have a local login and 2 links', async () => {
      const newUser = { ...userOne }
      delete newUser.password
      const ids = await insertUsers([newUser], config.database)
      const userId = ids[0]
      const userOneAccessToken = await getAccessToken(ids[0], newUser.role, config.jwt)
      const googleUser = googleAuthorisation(userId)
      const facebookUser = facebookAuthorisation(userId)
      await insertAuthorisations([googleUser, facebookUser], config.database)

      const res = await request(`/v1/auth/google/${userId}`, {
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
        .where('authorisations.user_id', '=', userId)
        .executeTakeFirst()

      expect(oauthGoogleUser).toBeUndefined()

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
          'Content-Type': 'application/json',
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })
  })
})
