import httpStatus from 'http-status';
import { getDBClient } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { CreateUser, UpdateUser } from '../validations/user.validation';
import { User } from '../models/user.model';
import { InsertResult } from 'kysely';

const db = getDBClient()

const createUser = async (userBody: CreateUser) => {
  let result: InsertResult
  try {
    result = await db
      .insertInto('user')
      .values(userBody)
      .executeTakeFirstOrThrow()
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists');
  }
  const user = await getUserById(Number(result.insertId))
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User already exists');
  }
  return user
};

const queryUsers = async () => {
  const users = await db
    .selectFrom('user')
    .selectAll()
    .execute()
  return users
};

const getUserById = async (id: number) => {
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.id', '=', id)
    .executeTakeFirst()
  return user ? new User(user) : user
};

const getUserByEmail = async (email: string) => {
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.email', '=', email)
    .executeTakeFirst()
  return user ? new User(user) : user
};

const updateUserById = async (userId: number, updateBody: Partial<UpdateUser>) => {
  await db
    .updateTable('user')
    .set(updateBody)
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  const user = await getUserById(userId)
  return user
};

const deleteUserById = async (userId: number) => {
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
