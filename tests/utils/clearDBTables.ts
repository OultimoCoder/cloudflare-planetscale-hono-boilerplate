import { TableReference } from 'kysely/dist/cjs/parser/table-parser.js'
import { getDBClient, Database } from '../../src/config/database'

const client = getDBClient()

const clearDBTables = (tables: Array<TableReference<Database>>) => {
  beforeEach(async () => {
    for (const table of tables) {
      const deleteResult = await client
        .deleteFrom(table)
        .executeTakeFirst()
    }
  })
}

export {
  clearDBTables
}
