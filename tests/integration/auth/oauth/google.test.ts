import { faker } from '@faker-js/faker'
import httpStatus from 'http-status'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser'
import { authProviders } from '../../../../src/config/authProviders'
import { getConfig } from '../../../../src/config/config'
import { Database, getDBClient } from '../../../../src/config/database'
import { OauthUser } from '../../../../src/models/authProvider.model'
import { googleAuthorisation, insertAuthorisations} from '../../../fixtures/authorisations.fixture'
import { TokenResponse } from '../../../fixtures/token.fixture'
import { userOne, insertUsers, UserResponse } from '../../../fixtures/user.fixture'
import { clearDBTables } from '../../../utils/clearDBTables'
import { request } from '../../../utils/testRequest'

const env = getMiniflareBindings()
const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user' as TableReference<Database>], config.database)

describe('Oauth routes', () => {
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
  })
})
