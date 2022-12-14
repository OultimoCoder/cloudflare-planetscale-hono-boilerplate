import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'
import { Selectable } from 'kysely'
import { Config } from '../../src/config/config'
import { getDBClient } from '../../src/config/database'
import { UserTable } from '../../src/models/user.model'

const password = 'password1'
const salt = bcrypt.genSaltSync(8)
const hashedPassword = bcrypt.hashSync(password, salt)

type MockUser = Selectable<UserTable> | Partial<Omit<Selectable<UserTable>, 'id'>>

interface UserResponse {
  id: number
  name: string
  email: string
  role: string
  is_email_verified: boolean
}

const userOne: MockUser = {
  name: faker.name.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
}

const userTwo: MockUser = {
  name: faker.name.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
}

const admin: MockUser = {
  name: faker.name.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'admin',
  is_email_verified: false
}

const insertUsers = async (
  users: Omit<Selectable<UserTable>, 'id'>[],
  databaseConfig: Config['database']
) => {
  const hashedUsers = users.map((user) => ({
    ...user,
    password: (user.password ? hashedPassword : null)
  }))
  const client = getDBClient(databaseConfig)
  const results: number[] = []
  for await (const user of hashedUsers) {
    const result = await client.insertInto('user').values(user).executeTakeFirst()
    results.push(Number(result.insertId))
  }
  return results
}

export { userOne, userTwo, admin, insertUsers, MockUser, UserResponse }
