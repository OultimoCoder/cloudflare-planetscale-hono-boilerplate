import { faker } from '@faker-js/faker'
import httpStatus from 'http-status'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { Database, getDBClient } from '../../../../src/config/database'
import { FacebookUser, OauthUser } from '../../../../src/models/authProvider.model'
import {
  facebookAuthorisation,
  insertAuthorisations
} from '../../../fixtures/authorisations.fixture'
import { TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clearDBTables'
import { request } from '../../../utils/testRequest'

const env = getMiniflareBindings()
const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user' as TableReference<Database>], config.database)

describe('Oauth Facebook routes', () => {
  describe('GET /v1/auth/facebook/redirect', () => {
    test('should return 302 and successfully redirect to facebook', async () => {
      const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.facebook.redirectUrl)
      const res = await request('/v1/auth/facebook/redirect', {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `https://www.facebook.com/v4.0/dialog/oauth?auth_type=rerequest&` +
        `client_id=${config.oauth.facebook.clientId}&display=popup&` +
        `redirect_uri=${urlEncodedRedirectUrl}&response_type=code&scope=email%2C%20user_friends`
      )
    })
  })

  describe('GET /v1/auth/facebook/callback', () => {
    let newUser: Omit<FacebookUser, 'providerType' | 'name'>
    beforeAll(async () => {
      newUser = {
        id: faker.datatype.number(),
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        email: faker.internet.email()
      }
    })
    test('should return 200 and successfully register user if request data is ok', async () => {
      const fetchMock = getMiniflareFetchMock()
      const facebookApiMock = fetchMock.get('https://graph.facebook.com')
      facebookApiMock
        .intercept({
          method: 'GET',
          path: '/me?fields=id,email,first_name,last_name&access_token=1234'}
        )
        .reply(200, JSON.stringify(newUser))
      const facebookMock = fetchMock.get('https://graph.facebook.com')
      facebookMock
        .intercept({method: 'POST', path: '/v4.0/oauth/access_token'})
        .reply(200, JSON.stringify({access_token: '1234'}))

      const providerId = 123456
      const res = await request(`/v1/auth/facebook/callback?code=${providerId}`, {
        method: 'GET',
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).toEqual({
        id: expect.anything(),
        name: `${newUser.first_name} ${newUser.last_name}`,
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
        name: `${newUser.first_name} ${newUser.last_name}`,
        password: null,
        email: newUser.email,
        role: 'user',
        is_email_verified: 1
      })

      const oauthUser = await client
        .selectFrom('authorisations')
        .selectAll()
        .where('authorisations.provider_type', '=', authProviders.FACEBOOK)
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
      const facebookUser = facebookAuthorisation(userId)
      await insertAuthorisations([facebookUser], config.database)
      newUser.id = parseInt(facebookUser.provider_user_id)

      const fetchMock = getMiniflareFetchMock()
      const facebookApiMock = fetchMock.get('https://graph.facebook.com')
      facebookApiMock
        .intercept({
          method: 'GET',
          path: '/me?fields=id,email,first_name,last_name&access_token=1234'}
        )
        .reply(200, JSON.stringify(newUser))
      const facebookMock = fetchMock.get('https://graph.facebook.com')
      facebookMock
        .intercept({method: 'POST', path: '/v4.0/oauth/access_token'})
        .reply(200, JSON.stringify({access_token: '1234'}))

      const providerId = 123456
      const res = await request(`/v1/auth/facebook/callback?code=${providerId}`, {
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

    test('should return 403 if user exists but has not linked their facebook', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email

      const fetchMock = getMiniflareFetchMock()
      const facebookApiMock = fetchMock.get('https://graph.facebook.com')
      facebookApiMock
        .intercept({
          method: 'GET',
          path: '/me?fields=id,email,first_name,last_name&access_token=1234'}
        )
        .reply(200, JSON.stringify(newUser))
      const facebookMock = fetchMock.get('https://graph.facebook.com')
      facebookMock
        .intercept({method: 'POST', path: '/v4.0/oauth/access_token'})
        .reply(200, JSON.stringify({access_token: '1234'}))

      const providerId = 123456
      const res = await request(`/v1/auth/facebook/callback?code=${providerId}`, {
        method: 'GET',
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.FORBIDDEN)
      expect(body).toEqual({
        code: httpStatus.FORBIDDEN,
        message: 'Cannot signup with facebook, user already exists with that email'
      })
    })


    test('should return 401 if code is invalid', async () => {
      const fetchMock = getMiniflareFetchMock()
      const facebookMock = fetchMock.get('https://graph.facebook.com')
      facebookMock
        .intercept({method: 'POST', path: '/v4.0/oauth/access_token'})
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({error: 'error'}))

      const providerId = 123456
      const res = await request(`/v1/auth/facebook/callback?code=${providerId}`, {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 400 if no code provided', async () => {
      const res = await request('/v1/auth/facebook/callback', {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })
})
