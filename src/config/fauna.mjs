import pkg from 'faunadb'
const { Client } = pkg
import config from './config.mjs'

let dbClient

const getDBClient = () => {
  dbClient = dbClient || new Client({
    domain: config.fauna.domain,
    port: config.fauna.port,
    scheme: config.fauna.scheme,
    secret: config.fauna.secret
  })
  return dbClient
}
export default getDBClient
