import { Kysely } from 'kysely'
import { UserTable } from '../models/user.model'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { config } from './config'

let dbClient: Kysely<Database>

interface Database {
  user: UserTable
}

const getDBClient = () => {
  dbClient = dbClient || new Kysely<Database>({
    dialect: new PlanetScaleDialect({
      username: config.database.username,
      password: config.database.password,
      host: config.database.host
    })
  })
  return dbClient
}

export {
  getDBClient,
  Database
}
