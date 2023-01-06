import { Kysely } from 'kysely'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { AuthProviderTable } from '../models/authProvider.model'
import { UserTable } from '../models/user.model'
import { Config } from './config'

let dbClient: Kysely<Database>

export interface Database {
  user: UserTable
  authorisations: AuthProviderTable
}

export const getDBClient = (databaseConfig: Config['database']): Kysely<Database> => {
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
