import { faker } from '@faker-js/faker'
import { Insertable } from 'kysely'
import { authProviders } from '../../src/config/authProviders'
import { Config } from '../../src/config/config'
import { getDBClient } from '../../src/config/database'
import { AuthProviderTable } from '../../src/models/authProvider.model'

export const githubAuthorisation = (userId: number) => ({
  provider_type: authProviders.GITHUB,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

export const discordAuthorisation = (userId: number) => ({
  provider_type: authProviders.DISCORD,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

export const spotifyAuthorisation = (userId: number) => ({
  provider_type: authProviders.SPOTIFY,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

export const googleAuthorisation = (userId: number) => ({
  provider_type: authProviders.GOOGLE,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

export const facebookAuthorisation = (userId: number) => ({
  provider_type: authProviders.FACEBOOK,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

export const appleAuthorisation = (userId: number) => ({
  provider_type: authProviders.APPLE,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

export const insertAuthorisations = async (
  authorisations: Insertable<AuthProviderTable>[],
  databaseConfig: Config['database']
) => {
  const client = getDBClient(databaseConfig)
  for await (const authorisation of authorisations) {
    await client.insertInto('authorisations').values(authorisation).executeTakeFirst()
  }
}
