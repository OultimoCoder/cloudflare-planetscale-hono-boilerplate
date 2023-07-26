import { faker } from '@faker-js/faker'
import { Insertable } from 'kysely'
import { authProviders } from '../../src/config/authProviders'
import { Config } from '../../src/config/config'
import { getDBClient } from '../../src/config/database'
import { AuthProviderTable } from '../../src/models/authProvider.model'

const githubAuthorisation = (userId: number) => ({
  provider_type: authProviders.GITHUB,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

const discordAuthorisation = (userId: number) => ({
  provider_type: authProviders.DISCORD,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

const spotifyAuthorisation = (userId: number) => ({
  provider_type: authProviders.SPOTIFY,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

const googleAuthorisation = (userId: number) => ({
  provider_type: authProviders.GOOGLE,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

const facebookAuthorisation = (userId: number) => ({
  provider_type: authProviders.FACEBOOK,
  provider_user_id: faker.number.int().toString(),
  user_id: userId
})

const insertAuthorisations = async (
  authorisations: Insertable<AuthProviderTable>[],
  databaseConfig: Config['database']
) => {
  const client = getDBClient(databaseConfig)
  for await (const authorisation of authorisations) {
    await client.insertInto('authorisations').values(authorisation).executeTakeFirst()
  }
}

export {
  githubAuthorisation,
  spotifyAuthorisation,
  googleAuthorisation,
  discordAuthorisation,
  insertAuthorisations,
  facebookAuthorisation
}
