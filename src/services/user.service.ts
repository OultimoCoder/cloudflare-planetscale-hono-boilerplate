import httpStatus from 'http-status';
import { getDBClient } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { CreateUser, UpdateUser } from '../validations/user.validation';
import { User } from '../models/user.model';
import { InsertResult } from 'kysely';
import { Config } from '../config/config';

const createUser = async (userBody: CreateUser, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  let result: InsertResult
  try {
    result = await db
      .insertInto('user')
      .values(userBody)
      .executeTakeFirstOrThrow()
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists');
  }
  const user = await getUserById(Number(result.insertId), databaseConfig)
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User already exists');
  }
  return user
};

const queryUsers = async (databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const users = await db
    .selectFrom('user')
    .selectAll()
    .execute()
  return users
};

const getUserById = async (id: number, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.id', '=', id)
    .executeTakeFirst()
  return user ? new User(user) : user
};

const getUserByEmail = async (email: string, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.email', '=', email)
    .executeTakeFirst()
  return user ? new User(user) : user
};

const updateUserById = async (
  userId: number, updateBody: Partial<UpdateUser>, databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  await db
    .updateTable('user')
    .set(updateBody)
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  const user = await getUserById(userId, databaseConfig)
  return user
};

const deleteUserById = async (userId: number, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const result = await db
    .deleteFrom('user')
    .where('user.id', '=', userId)
    .executeTakeFirst()
  if (result.numDeletedRows < 1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
};

export {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById
}
