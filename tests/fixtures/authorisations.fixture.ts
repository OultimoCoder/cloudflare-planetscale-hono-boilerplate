import { faker } from '@faker-js/faker'
import { Selectable } from 'kysely'
import { authProviders } from '../../src/config/authProviders'
import { Config } from '../../src/config/config'
import { getDBClient } from '../../src/config/database'
import { AuthProviderTable } from '../../src/models/authProvider.model'

const githubAuthorisation = (userId: string) => ({
  provider_type: authProviders.GITHUB,
  provider_user_id: faker.datatype.number().toString(),
  user_id: userId
})

const insertAuthorisations = async (
  authorisations: Selectable<AuthProviderTable>[],
  databaseConfig: Config['database']
) => {
  const client = getDBClient(databaseConfig)
  for await (const authorisation of authorisations) {
    await client
      .insertInto('authorisations')
      .values(authorisation)
      .executeTakeFirst()
  }
}

export { githubAuthorisation, insertAuthorisations }
