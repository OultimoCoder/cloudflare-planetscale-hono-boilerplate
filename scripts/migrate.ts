import * as dotenv from 'dotenv'
import * as path from 'path'
import { promises as fs } from 'fs'
import { Migrator, FileMigrationProvider } from 'kysely'
import { fileURLToPath } from 'url';
import { Kysely } from 'kysely'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { User } from '../src/models/user.model'

dotenv.config()
interface Database {
  user: User
}
const __filename = fileURLToPath(import.meta.url);
const db = new Kysely<Database>({
  dialect: new PlanetScaleDialect({url: process.env.MYSQL_URL})
})

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(path.dirname(__filename), '../migrations'),
  })
})

async function migrateToLatest() {
  const { error, results } = await migrator.migrateToLatest()
  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration '${it.migrationName}' was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

async function migrateDown() {
  const { error, results } = await migrator.migrateDown()
  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration '${it.migrationName}' was reverted successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}
const myArgs = process.argv[2];

if (myArgs === 'down') {
  migrateDown()
} else if (myArgs === 'latest') {
  migrateToLatest()
}
