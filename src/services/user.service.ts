import httpStatus from 'http-status'
import { InsertResult, UpdateResult } from 'kysely'
import { AuthProviderType } from '../config/authProviders'
import { Config } from '../config/config'
import { getDBClient } from '../config/database'
import { OauthUser } from '../models/authProvider.model'
import { User, UserTable } from '../models/user.model'
import { ApiError } from '../utils/ApiError'
import { CreateUser, UpdateUser } from '../validations/user.validation'

interface getUsersFilter {
  email: string | undefined
}

interface getUsersOptions {
  sortBy: string
  limit: number
  page: number
}

const createUser = async (userBody: CreateUser, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  let result: InsertResult
  try {
    result = await db.insertInto('user').values(userBody).executeTakeFirstOrThrow()
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists')
  }
  const user = await getUserById(Number(result.insertId), databaseConfig)
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists')
  }
  return user
}

const createOauthUser = async (
  providerUser: OauthUser,
  databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  try {
    await db.transaction().execute(async (trx) => {
      const userId = await trx
        .insertInto('user')
        .values({
          name: providerUser.name,
          email: providerUser.email,
          is_email_verified: true,
          password: null,
          role: 'user'
        })
        .executeTakeFirstOrThrow()
      await trx
        .insertInto('authorisations')
        .values({
          user_id: Number(userId.insertId),
          provider_type: providerUser.providerType,
          provider_user_id: providerUser.id.toString()
        })
        .executeTakeFirstOrThrow()
        return userId
    })
  } catch (error) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Cannot signup with ${providerUser.providerType}, user already exists with that email`
    )
  }
  const user = await getUserByProviderIdType(
    providerUser.id.toString(), providerUser.providerType, databaseConfig
  )
  return User.convert(user)
}

const queryUsers = async (
  filter: getUsersFilter,
  options: getUsersOptions,
  databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  const [sortField, direction] = options.sortBy.split(':') as [keyof UserTable, 'asc' | 'desc']
  let usersQuery = db
    .selectFrom('user')
    .selectAll()
    .orderBy(`user.${sortField}`, direction)
    .limit(options.limit)
    .offset(options.limit * options.page)
  if (filter.email) {
    usersQuery = usersQuery.where('user.email', '=', filter.email)
  }
  const users = await usersQuery.execute()
  return User.convert(users)
}

const getUserById = async (id: number, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const user = await db.selectFrom('user').selectAll().where('user.id', '=', id).executeTakeFirst()
  return user ? User.convert(user) : user
}

const getUserByEmail = async (email: string, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.email', '=', email)
    .executeTakeFirst()
  return user ? User.convert(user) : user
}

const getUserByProviderIdType = async (
  id: string,
  type: AuthProviderType,
  databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  const user = await db
    .selectFrom('user')
    .innerJoin('authorisations', 'authorisations.user_id', 'user.id')
    .selectAll()
    .where('authorisations.provider_user_id', '=', id)
    .where('authorisations.provider_type', '=', type)
    .executeTakeFirst()
  return user ? User.convert(user) : user
}

const updateUserById = async (
  userId: number,
  updateBody: Partial<UpdateUser>,
  databaseConfig: Config['database']
) => {
  const db = getDBClient(databaseConfig)
  let result: UpdateResult
  try {
    result = await db
      .updateTable('user')
      .set(updateBody)
      .where('id', '=', userId)
      .executeTakeFirst()
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists')
  }
  if (!result.numUpdatedRows || Number(result.numUpdatedRows) < 1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }
  const user = await getUserById(userId, databaseConfig)
  return user
}

const deleteUserById = async (userId: number, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const result = await db.deleteFrom('user').where('user.id', '=', userId).executeTakeFirst()

  if (!result.numDeletedRows || Number(result.numDeletedRows) < 1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }
}

export {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  getUserByProviderIdType,
  createOauthUser
}
