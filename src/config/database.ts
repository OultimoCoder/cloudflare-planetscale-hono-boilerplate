import { Kysely } from 'kysely'
import { User } from '../models/user.model'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { config } from './config'

let dbClient: Kysely<Database>

interface Database {
  user: User
}

const getDBClient = () => {
  dbClient = dbClient || new Kysely<Database>({
    dialect: new PlanetScaleDialect({url: config.mysql.url})
  })
  return dbClient
}

export { getDBClient }
