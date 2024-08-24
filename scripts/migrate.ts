/* eslint no-console: "off" */
import { promises as fs } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as dotenv from 'dotenv'
import { Migrator, FileMigrationProvider, NO_MIGRATIONS } from 'kysely'
import { Kysely } from 'kysely'
import { PlanetScaleDialect } from 'kysely-planetscale'
import { User } from '../src/models/user.model'

const envFile = {
  dev: '.env',
  test: '.env.test'
}

const __filename = fileURLToPath(import.meta.url)

dotenv.config({ path: path.join(path.dirname(__filename), `../${envFile[process.argv[2]]}`) })

interface Database {
  user: User
}

const db = new Kysely<Database>({
  dialect: new PlanetScaleDialect({
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_HOST
  })
})

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(path.dirname(__filename), '../migrations')
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

async function migrateNone() {
  const { error, results } = await migrator.migrateTo(NO_MIGRATIONS)
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

const myArgs = process.argv[3]

if (myArgs === 'down') {
  await migrateDown()
} else if (myArgs === 'latest') {
  await migrateToLatest()
} else if (myArgs === 'none') {
  await migrateNone()
}
