import httpStatus from 'http-status'
import { UpdateResult } from 'kysely'
import { Config } from '../config/config'
import { getDBClient } from '../config/database'
import { OAuthUserModel } from '../models/oauth/oauth-base.model'
import { User } from '../models/user.model'
import { UserTable } from '../tables/user.table'
import { AuthProviderType } from '../types/oauth.types'
import { ApiError } from '../utils/api-error'
import { generateId } from '../utils/utils'
import { CreateUser, UpdateUser } from '../validations/user.validation'

interface getUsersFilter {
  email: string | undefined
}

interface getUsersOptions {
  sortBy: string
  limit: number
  page: number
}

export const createUser = async (
  userBody: CreateUser,
  databaseConfig: Config['database']
): Promise<User> => {
  const db = getDBClient(databaseConfig)
  const id = generateId()
  try {
    await db
      .insertInto('user')
      .values({ ...userBody, id })
      .executeTakeFirstOrThrow()
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists')
  }
  const user = (await getUserById(id, databaseConfig)) as User
  return user
}

export const createOauthUser = async (
  providerUser: OAuthUserModel,
  databaseConfig: Config['database']
): Promise<User> => {
  const db = getDBClient(databaseConfig)
  try {
    const id = generateId()
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('user')
        .values({
          id,
          name: providerUser._name,
          email: providerUser._email,
          is_email_verified: true,
          password: null,
          role: 'user'
        })
        .executeTakeFirstOrThrow()
      await trx
        .insertInto('authorisations')
        .values({
          user_id: id,
          provider_type: providerUser.providerType,
          provider_user_id: providerUser._id
        })
        .executeTakeFirstOrThrow()
    })
  } catch {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Cannot signup with ${providerUser.providerType}, user already exists with that email`
    )
  }
  const user = (await getUserByProviderIdType(
    providerUser._id,
    providerUser.providerType,
    databaseConfig
  )) as User
  return new User(user)
}

export const queryUsers = async (
  filter: getUsersFilter,
  options: getUsersOptions,
  databaseConfig: Config['database']
): Promise<User[]> => {
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
  return users.map((user) => new User(user))
}

export const getUserById = async (
  id: string,
  databaseConfig: Config['database']
): Promise<User | undefined> => {
  const db = getDBClient(databaseConfig)
  const user = await db.selectFrom('user').selectAll().where('user.id', '=', id).executeTakeFirst()
  return user ? new User(user) : undefined
}

export const getUserByEmail = async (
  email: string,
  databaseConfig: Config['database']
): Promise<User | undefined> => {
  const db = getDBClient(databaseConfig)
  const user = await db
    .selectFrom('user')
    .selectAll()
    .where('user.email', '=', email)
    .executeTakeFirst()
  return user ? new User(user) : undefined
}

export const getUserByProviderIdType = async (
  id: string,
  type: AuthProviderType,
  databaseConfig: Config['database']
): Promise<User | undefined> => {
  const db = getDBClient(databaseConfig)
  const user = await db
    .selectFrom('user')
    .innerJoin('authorisations', 'authorisations.user_id', 'user.id')
    .selectAll()
    .where('authorisations.provider_user_id', '=', id)
    .where('authorisations.provider_type', '=', type)
    .executeTakeFirst()
  return user ? new User(user) : undefined
}

export const updateUserById = async (
  userId: string,
  updateBody: Partial<UpdateUser>,
  databaseConfig: Config['database']
): Promise<User> => {
  const db = getDBClient(databaseConfig)
  let result: UpdateResult
  try {
    result = await db
      .updateTable('user')
      .set(updateBody)
      .where('id', '=', userId)
      .executeTakeFirst()
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists')
  }
  if (!result.numUpdatedRows || Number(result.numUpdatedRows) < 1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }
  const user = (await getUserById(userId, databaseConfig)) as User
  return user
}

export const deleteUserById = async (
  userId: string,
  databaseConfig: Config['database']
): Promise<void> => {
  const db = getDBClient(databaseConfig)
  const result = await db.deleteFrom('user').where('user.id', '=', userId).executeTakeFirst()

  if (!result.numDeletedRows || Number(result.numDeletedRows) < 1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }
}

export const getAuthorisations = async (userId: string, databaseConfig: Config['database']) => {
  const db = getDBClient(databaseConfig)
  const auths = await db
    .selectFrom('user')
    .leftJoin('authorisations', 'authorisations.user_id', 'user.id')
    .selectAll()
    .where('user.id', '=', userId)
    .execute()

  if (!auths) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
  const response = {
    local: auths[0].password !== null ? true : false,
    google: false,
    facebook: false,
    discord: false,
    spotify: false,
    github: false,
    apple: false
  }
  for (const auth of auths) {
    if (auth.provider_type === null) {
      continue
    }
    response[auth.provider_type as AuthProviderType] = true
  }
  return response
}
