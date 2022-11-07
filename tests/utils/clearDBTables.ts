import { TableReference } from 'kysely/dist/cjs/parser/table-parser.js'
import { getDBClient, Database } from '../../src/config/database'
import { Config } from '../../src/config/config'


const clearDBTables = (
  tables: Array<TableReference<Database>>, databaseConfig: Config['database']
) => {
  const client = getDBClient(databaseConfig)
  beforeEach(async () => {
    for (const table of tables) {
      await client
        .deleteFrom(table)
        .executeTakeFirst()
    }
  })
}

export {
  clearDBTables
}
