import { Kysely } from 'kysely'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { AuthProviderTable } from '../tables/oauth.table'
import { UserTable } from '../tables/user.table'
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
        host: databaseConfig.host,
        fetch: (url, init) => {
          // TODO: REMOVE.
          // Remove cache header
          // https://github.com/cloudflare/workerd/issues/698
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (init as any)['cache']
          return fetch(url, init)
        }
      })
    })
  return dbClient
}
