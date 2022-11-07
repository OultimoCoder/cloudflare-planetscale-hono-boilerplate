import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import { UserTable } from '../../src/models/user.model';
import { Selectable } from 'kysely'
import { Config } from '../../src/config/config';
import { getDBClient } from '../../src/config/database';

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

type MockUser = Selectable<UserTable> | Partial<Omit<Selectable<UserTable>, 'id'>>

interface UserResponse {
  id: number,
  first_name: string,
  last_name: string,
  email: string,
  role: string,
  isEmailVerified: boolean
}

let userOne: MockUser = {
  first_name: faker.name.firstName(),
  last_name: faker.name.lastName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
};

let userTwo: MockUser = {
  first_name: faker.name.firstName(),
  last_name: faker.name.lastName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
};

let admin: MockUser = {
  first_name: faker.name.firstName(),
  last_name: faker.name.lastName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'admin',
  is_email_verified: false
};

const insertUsers = async (
  users: Omit<Selectable<UserTable>, 'id'>[], databaseConfig: Config['database']
) => {
  const hashedUsers = users.map((user) => ({ ...user, password: hashedPassword }))
  const client = getDBClient(databaseConfig)
  const results = await client
    .insertInto('user')
    .values(hashedUsers)
    .execute()
  return results
};

export {
  userOne,
  userTwo,
  admin,
  insertUsers,
  MockUser,
  UserResponse
}
