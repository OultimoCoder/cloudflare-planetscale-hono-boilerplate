import { faker } from '@faker-js/faker'
import httpStatus from 'http-status'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { Database, getDBClient } from '../../../../src/config/database'
import { OauthUser } from '../../../../src/models/authProvider.model'
import { spotifyAuthorisation, insertAuthorisations} from '../../../fixtures/authorisations.fixture'
import { TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clearDBTables'
import { request } from '../../../utils/testRequest'

const env = getMiniflareBindings()
const config = getConfig(env)
const client = getDBClient(config.database)
const urlEncodedRedirectUrl = encodeURIComponent(config.oauth.spotify.redirectUrl)

clearDBTables(['user' as TableReference<Database>], config.database)

describe('Oauth Spotify routes', () => {
  describe('GET /v1/auth/spotify/redirect', () => {
    test('should return 302 and successfully redirect to spotify', async () => {
      const res = await request('/v1/auth/spotify/redirect', {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.FOUND)
      expect(res.headers.get('location')).toBe(
        `https://accounts.spotify.com/authorize?client_id=${config.oauth.spotify.clientId}&` +
        `redirect_uri=${urlEncodedRedirectUrl}&response_type=code&` +
        'scope=user-library-read%20playlist-modify-private&show_dialog=false'
      )
    })
  })

  describe('GET /v1/auth/spotify/callback', () => {
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
      const providerId = 123456

      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({method: 'GET', path: '/v1/me'})
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path: `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`}
        )
        .reply(200, JSON.stringify({access_token: '1234'}))

      const res = await request(`/v1/auth/spotify/callback?code=${providerId}`, {
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
        .where('authorisations.provider_type', '=', authProviders.SPOTIFY)
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
      const spotifyUser = spotifyAuthorisation(userId)
      await insertAuthorisations([spotifyUser], config.database)
      newUser.id = parseInt(spotifyUser.provider_user_id)
      const providerId = 123456

      const fetchMock = getMiniflareFetchMock()
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({method: 'GET', path: '/v1/me'})
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path: `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`}
        )
        .reply(200, JSON.stringify({access_token: '1234'}))

      const res = await request(`/v1/auth/spotify/callback?code=${providerId}`, {
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

    test('should return 403 if user exists but has not linked their spotify', async () => {
      await insertUsers([userOne], config.database)
      newUser.email = userOne.email
      const providerId = 123456

      const fetchMock = getMiniflareFetchMock()
      const spotifyApiMock = fetchMock.get('https://api.spotify.com')
      spotifyApiMock
        .intercept({method: 'GET', path: '/v1/me'})
        .reply(200, JSON.stringify(newUser))
      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path: `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`}
        )
        .reply(200, JSON.stringify({access_token: '1234'}))

      const res = await request(`/v1/auth/spotify/callback?code=${providerId}`, {
        method: 'GET',
      })
      const body = await res.json<{ user: UserResponse; tokens: TokenResponse }>()
      expect(res.status).toBe(httpStatus.FORBIDDEN)
      expect(body).toEqual({
        code: httpStatus.FORBIDDEN,
        message: 'Cannot signup with spotify, user already exists with that email'
      })
    })


    test('should return 401 if code is invalid', async () => {
      const fetchMock = getMiniflareFetchMock()
      const providerId = 123456

      const spotifyMock = fetchMock.get('https://accounts.spotify.com')
      spotifyMock
        .intercept({
          method: 'POST',
          path: `/api/token?code=${providerId}&grant_type=authorization_code&` +
            `redirect_uri=${urlEncodedRedirectUrl}`}
        )
        .reply(httpStatus.UNAUTHORIZED, JSON.stringify({error: 'error'}))

      const res = await request(`/v1/auth/spotify/callback?code=${providerId}`, {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 400 if no code provided', async () => {
      const res = await request('/v1/auth/spotify/callback', {
        method: 'GET',
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })
})
