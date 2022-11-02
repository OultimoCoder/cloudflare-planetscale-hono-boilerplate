import httpStatus from 'http-status';
import { getDBClient } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { CreateUser, UpdateUser } from '../validations/user.validation';

const db = getDBClient()

const createUser = async (userBody: CreateUser) => {
  const result = await db
    .insertInto('user')
    .values(userBody)
    .executeTakeFirstOrThrow()
  if (!result.insertId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists');
  }
  const user = await getUserById(Number(result.insertId))
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
    .executeTakeFirstOrThrow()
  return user
};

const getUserByEmail = async (email: string) => {
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.email', '=', email)
    .executeTakeFirst()
  return user
};

const updateUserById = async (userId: number, updateBody: Partial<UpdateUser>) => {
  const user = await db
    .updateTable('user')
    .set(updateBody)
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  return user;
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
