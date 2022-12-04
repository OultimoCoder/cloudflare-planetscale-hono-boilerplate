import { Kysely } from 'kysely'
import { Database } from '../src/config/database'

export async function up(db: Kysely<Database>) {
  await db.schema
    .createTable('user')
    .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('password', 'varchar(255)')
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('is_email_verified', 'boolean', (col) => col.defaultTo(false))
    .addColumn('role', 'varchar(255)', (col) => col.defaultTo('user'))
    .execute()

  await db.schema
    .createTable('authorisations')
    .addColumn('provider_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('provider_user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
    .addPrimaryKeyConstraint('primary_key', ['provider_type', 'provider_user_id', 'user_id'])
    .addUniqueConstraint('unique_provider_user', ['provider_type', 'provider_user_id'])
    .execute()

  await db.schema
    .createIndex('user_email_index')
    .on('user')
    .column('email')
    .execute()

  await db.schema
    .createIndex('authorisations_user_id_index')
    .on('authorisations')
    .column('user_id')
    .execute()
}

export async function down(db: Kysely<Database>) {
  await db.schema.dropTable('user').execute()
  await db.schema.dropTable('authorisations').execute()
}
