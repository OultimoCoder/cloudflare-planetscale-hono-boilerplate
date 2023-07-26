import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'
import { Insertable } from 'kysely'
import { Config } from '../../src/config/config'
import { getDBClient } from '../../src/config/database'
import { UserTable } from '../../src/models/user.model'

const password = 'password1'
const salt = bcrypt.genSaltSync(8)
const hashedPassword = bcrypt.hashSync(password, salt)

export type MockUser = Insertable<UserTable>

export interface UserResponse {
  id: number
  name: string
  email: string
  role: string
  is_email_verified: boolean
}

export const userOne: MockUser = {
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
}

export const userTwo: MockUser = {
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
}

export const admin: MockUser = {
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'admin',
  is_email_verified: false
}

export const insertUsers = async (
  users: MockUser[],
  databaseConfig: Config['database']
) => {
  const hashedUsers = users.map((user) => ({
    ...user,
    password: user.password ? hashedPassword : null
  }))
  const client = getDBClient(databaseConfig)
  const results: number[] = []
  for await (const user of hashedUsers) {
    const result = await client.insertInto('user').values(user).executeTakeFirst()
    results.push(Number(result.insertId))
  }
  return results
}
