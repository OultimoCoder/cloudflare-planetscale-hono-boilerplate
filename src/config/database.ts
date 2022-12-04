import { Kysely } from 'kysely'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { AuthProviderTable } from '../models/authProvider.model'
import { UserTable } from '../models/user.model'
import { Config } from './config'

let dbClient: Kysely<Database>

interface Database {
  user: UserTable,
  authorisations: AuthProviderTable
}

const getDBClient = (databaseConfig: Config['database']) => {
  dbClient =
    dbClient ||
    new Kysely<Database>({
      dialect: new PlanetScaleDialect({
        username: databaseConfig.username,
        password: databaseConfig.password,
        host: databaseConfig.host
      })
    })
  return dbClient
}

export { getDBClient, Database }
