import { faker } from '@faker-js/faker'
import httpStatus from 'http-status'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser'
import { getConfig } from '../../src/config/config'
import { Database, getDBClient } from '../../src/config/database'
import { getAccessToken } from '../fixtures/token.fixture'
import { MockUser, UserResponse } from '../fixtures/user.fixture'
import { userOne, userTwo, admin, insertUsers } from '../fixtures/user.fixture'
import { clearDBTables } from '../utils/clearDBTables'
import { request } from '../utils/testRequest'

const env = getMiniflareBindings()
const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user' as TableReference<Database>], config.database)

describe('User routes', () => {
  describe('POST /v1/users', () => {
    let newUser: MockUser

    beforeEach(() => {
      newUser = {
        name: faker.name.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        role: 'user'
      }
    })

    test('should return 201 and successfully create new user if data is ok', async () => {
      const ids = await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse>()
      expect(res.status).toBe(httpStatus.CREATED)
      expect(body).not.toHaveProperty('password')
      expect(body).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: 'user',
        is_email_verified: 0
      })

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', body.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      expect(dbUser.password).not.toBe(newUser.password)
      expect(dbUser).toMatchObject({
        name: newUser.name,
        password: expect.anything(),
        email: newUser.email,
        role: 'user',
        is_email_verified: 0
      })
    })

    test('should be able to create an admin as well', async () => {
      const ids = await insertUsers([admin], config.database)
      newUser.role = 'admin'
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse>()
      expect(res.status).toBe(httpStatus.CREATED)
      expect(body.role).toBe('admin')

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', body.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      expect(dbUser.password).not.toBe(newUser.password)
      expect(dbUser.role).toBe('admin')
    })

    test('should return 401 error if access token is missing', async () => {
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 error if logged in user is not admin', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)

      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 400 error if email is invalid', async () => {
      const ids = await insertUsers([admin], config.database)
      newUser.email = 'invalidEmail'
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 error if email is already used', async () => {
      const ids = await insertUsers([admin, userOne], config.database)
      newUser.email = userOne.email
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 error if password length is less than 8 characters', async () => {
      const ids = await insertUsers([admin], config.database)
      newUser.password = 'passwo1'
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if password does not contain both letters and numbers', async () => {
      const ids = await insertUsers([admin], config.database)
      newUser.password = 'password'
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)

      newUser.password = '1111111'

      const res2 = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res2.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 error if role is neither user nor admin', async () => {
      const ids = await insertUsers([admin], config.database)
      ;(newUser as any).role = 'invalid'
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 201 and is_email_verified false if set to true', async () => {
      const ids = await insertUsers([admin], config.database)
      newUser.is_email_verified = true
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.CREATED)
      const body = await res.json<UserResponse>()
      expect(body.is_email_verified).toBe(0)
    })
  })

  describe('GET /v1/users', () => {
    test('should return 200 and apply the default query options', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[2], admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toHaveLength(3)
      expect(body[0]).toEqual({
        id: ids[0],
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        is_email_verified: 0
      })
    })

    test('should return 401 if access token is missing', async () => {
      await insertUsers([userOne, userTwo, admin], config.database)
      const res = await request('/v1/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 if a non-admin is trying to access all users', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should correctly apply filter on email field', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[2], admin.role, config.jwt)
      const res = await request(`/v1/users?email=${userOne.email}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toHaveLength(1)
      expect(body[0].id).toBe(ids[0])
    })

    test('should correctly sort the returned array if desc sort param is specified', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[2], admin.role, config.jwt)
      const res = await request('/v1/users?sort_by=id:desc', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toHaveLength(3)
      expect(body[0].id).toBe(ids[2])
      expect(body[1].id).toBe(ids[1])
      expect(body[2].id).toBe(ids[0])
    })

    test('should correctly sort the returned array if asc sort param is specified', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[2], admin.role, config.jwt)
      const res = await request('/v1/users?sort_by=id:asc', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toHaveLength(3)
      expect(body[0].id).toBe(ids[0])
      expect(body[1].id).toBe(ids[1])
      expect(body[2].id).toBe(ids[2])
    })

    test('should limit returned array if limit param is specified', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[2], admin.role, config.jwt)
      const res = await request('/v1/users?limit=2', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toHaveLength(2)
      expect(body[0].id).toBe(ids[0])
      expect(body[1].id).toBe(ids[1])
    })

    test('should return the correct page if page and limit params are specified', async () => {
      const ids = await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[2], admin.role, config.jwt)
      const res = await request('/v1/users?limit=2&page=1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toHaveLength(1)
      expect(body[0].id).toBe(ids[2])
    })
  })

  describe('GET /v1/users/:userId', () => {
    test('should return 200 and the user object if data is ok', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      const body = await res.json<UserResponse[]>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).not.toHaveProperty('password')
      expect(body).toEqual({
        id: ids[0],
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        is_email_verified: 0
      })
    })

    test('should return 401 error if access token is missing', async () => {
      const ids = await insertUsers([userOne], config.database)
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 error if user is trying to get another user', async () => {
      const ids = await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const res = await request(`/v1/users/${ids[1]}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 200 and user if admin is trying to get another user', async () => {
      const ids = await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[1], admin.role, config.jwt)
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.OK)
    })

    test('should return 400 error if userId is not a number', async () => {
      const ids = await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users/hello1234', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 404 error if user is not found', async () => {
      const ids = await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users/1221212', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NOT_FOUND)
    })
  })

  describe('DELETE /v1/users/:userId', () => {
    test('should return 204 if data is ok', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', ids[0])
        .executeTakeFirst()
      expect(dbUser).toBe(undefined)
    })

    test('should return 401 error if access token is missing', async () => {
      const ids = await insertUsers([userOne], config.database)
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 error if user is trying to delete another user', async () => {
      const ids = await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const res = await request(`/v1/users/${ids[1]}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 204 if admin is trying to delete another user', async () => {
      const ids = await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[1], admin.role, config.jwt)
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
    })

    test('should return 400 error if userId is not a number', async () => {
      const ids = await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[1], admin.role, config.jwt)
      const res = await request('/v1/users/iamnotanumber', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 404 error if user already is not found', async () => {
      const ids = await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const res = await request('/v1/users/12345', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NOT_FOUND)
    })
  })

  describe('PATCH /v1/users/:userId', () => {
    test('should return 200 and successfully update user if data is ok', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const updateBody = {
        name: faker.name.fullName(),
        email: faker.internet.email().toLowerCase()
      }

      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      const body = await res.json<UserResponse>()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).not.toHaveProperty('password')
      expect(body).toEqual({
        id: ids[0],
        name: updateBody.name,
        email: updateBody.email,
        role: 'user',
        is_email_verified: 0
      })

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', body.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      if (!dbUser) return

      expect(dbUser.password).not.toBe(userOne.password)
      expect(dbUser).toMatchObject({
        name: updateBody.name,
        password: expect.anything(),
        email: updateBody.email,
        role: 'user',
        is_email_verified: 0
      })
    })

    test('should return 401 error if access token is missing', async () => {
      const ids = await insertUsers([userOne], config.database)
      const updateBody = { name: faker.name.fullName() }
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 if user is updating another user', async () => {
      const ids = await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const updateBody = { name: faker.name.fullName() }
      const res = await request(`/v1/users/${ids[1]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 200 and update user if admin is updating another user', async () => {
      const ids = await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[1], admin.role, config.jwt)
      const updateBody = { name: faker.name.fullName() }
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.OK)
    })

    test('should return 404 if admin is updating another user that is not found', async () => {
      const ids = await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const updateBody = { name: faker.name.fullName() }
      const res = await request('/v1/users/123123222', {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NOT_FOUND)
    })

    test('should return 400 error if userId is not a number', async () => {
      const ids = await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(ids[0], admin.role, config.jwt)
      const updateBody = { name: faker.name.fullName() }
      const res = await request('/v1/users/notanumber123', {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if email is invalid', async () => {
      const ids = await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(ids[1], admin.role, config.jwt)
      const updateBody = { email: 'invalidEmail' }
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if email is already taken', async () => {
      const ids = await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const updateBody = { email: userTwo.email }
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should not return 400 if email is my email', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const updateBody = { email: userOne.email }
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.OK)
    })
    test('should return 400 if one of email/password/role are not passed in', async () => {
      const ids = await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(ids[0], userOne.role, config.jwt)
      const updateBody = {}
      const res = await request(`/v1/users/${ids[0]}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })
})
