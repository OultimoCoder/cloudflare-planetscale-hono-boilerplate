import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user')
    .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
    .addColumn('first_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('last_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('password', 'varchar(255)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('is_email_verified', 'boolean', (col) => col.defaultTo(false))
    .addColumn('role', 'varchar(255)', (col) => col.defaultTo('user'))
    .execute()

  await db.schema
    .createIndex('user_email_index')
    .on('user')
    .column('email')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user').execute()
}
