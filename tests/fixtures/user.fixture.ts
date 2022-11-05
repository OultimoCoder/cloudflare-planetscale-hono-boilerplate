import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import { User } from '../../src/models/user.model';
import { Selectable } from 'kysely'

const password = 'password1';
const salt = await bcrypt.genSalt(8);
const hashedPassword = await bcrypt.hash(password, salt);

type MockUser = Selectable<User> | Partial<Omit<Selectable<User>, 'id'>>

interface UserResponse {
  id: number,
  first_name: string,
  last_name: string,
  email: string,
  role: string,
  isEmailVerified: boolean
}

const userOne: MockUser = {
  first_name: faker.name.firstName(),
  last_name: faker.name.lastName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
};

const userTwo: MockUser = {
  first_name: faker.name.firstName(),
  last_name: faker.name.lastName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  is_email_verified: false
};

const admin: MockUser = {
  first_name: faker.name.firstName(),
  last_name: faker.name.lastName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'admin',
  is_email_verified: false
};

const insertUsers = async (users: MockUser[]) => {
  await User.insertMany(users.map((user) => ({ ...user, password: hashedPassword })));
};

export {
  userOne,
  userTwo,
  admin,
  insertUsers,
  MockUser,
  UserResponse
}
