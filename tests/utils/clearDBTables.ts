import { beforeEach } from 'vitest'
import { Config } from '../../src/config/config'
import { getDBClient, Database } from '../../src/config/database'

const clearDBTables = (tables: Array<keyof Database>, databaseConfig: Config['database']) => {
  const client = getDBClient(databaseConfig)
  beforeEach(async () => {
    for (const table of tables) {
      await client.deleteFrom(table).executeTakeFirst()
    }
  })
}

export { clearDBTables }
