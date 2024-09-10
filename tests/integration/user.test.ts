import { faker } from '@faker-js/faker'
import { env } from 'cloudflare:test'
import httpStatus from 'http-status'
import { test, describe, expect, beforeEach } from 'vitest'
import { getConfig } from '../../src/config/config'
import { getDBClient } from '../../src/config/database'
import { tokenTypes } from '../../src/config/tokens'
import { CreateUser } from '../../src/validations/user.validation'
import { getAccessToken } from '../fixtures/token.fixture'
import { UserResponse } from '../fixtures/user.fixture'
import { userOne, userTwo, admin, insertUsers } from '../fixtures/user.fixture'
import { clearDBTables } from '../utils/clear-db-tables'
import { request } from '../utils/test-request'

const config = getConfig(env)
const client = getDBClient(config.database)

clearDBTables(['user'], config.database)

describe('User routes', () => {
  describe('POST /v1/users', () => {
    let newUser: CreateUser

    beforeEach(() => {
      newUser = {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        role: 'user',
        is_email_verified: false
      }
    })

    test('should return 201 and successfully create new user if data is ok', async () => {
      await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
        id: expect.any(String),
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
      expect(dbUser).toEqual({
        id: body.id,
        name: newUser.name,
        password: expect.anything(),
        email: newUser.email,
        role: 'user',
        is_email_verified: 0,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      })
    })

    test('should be able to create an admin as well', async () => {
      await insertUsers([admin], config.database)
      newUser.role = 'admin'
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)

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
      await insertUsers([admin], config.database)
      newUser.email = 'invalidEmail'
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      await insertUsers([admin, userOne], config.database)
      newUser.email = userOne.email
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      await insertUsers([admin], config.database)
      newUser.password = 'passwo1'
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      await insertUsers([admin], config.database)
      newUser.password = 'password'
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          ...newUser,
          role: 'invalid'
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 201 and is_email_verified false if set to true', async () => {
      await insertUsers([admin], config.database)
      newUser.is_email_verified = true
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })

  describe('GET /v1/users', () => {
    test('should return 200 and apply the default query options', async () => {
      await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      expect(body).toEqual(
        expect.arrayContaining([
          {
            id: userOne.id,
            name: userOne.name,
            email: userOne.email,
            role: userOne.role,
            is_email_verified: 0
          },
          {
            id: userTwo.id,
            name: userTwo.name,
            email: userTwo.email,
            role: userTwo.role,
            is_email_verified: 0
          },
          {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            is_email_verified: 0
          }
        ])
      )
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
      await insertUsers([userOne, userTwo, admin], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
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
      await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
      expect(body[0].id).toBe(userOne.id)
    })

    test('should limit returned array if limit param is specified', async () => {
      await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
    })

    test('should return the correct page if page and limit params are specified', async () => {
      await insertUsers([userOne, userTwo, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
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
    })
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/users?limit=2&page=1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })

  describe('GET /v1/users/:userId', () => {
    test('should return 200 and the user object if data is ok', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const res = await request(`/v1/users/${userOne.id}`, {
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
        id: userOne.id,
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        is_email_verified: 0
      })
    })

    test('should return 401 error if access token is missing', async () => {
      await insertUsers([userOne], config.database)
      const res = await request(`/v1/users/${userOne.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 error if user is trying to get another user', async () => {
      await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const res = await request(`/v1/users/${userTwo.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 200 and user if admin is trying to get another user', async () => {
      await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const res = await request(`/v1/users/${userOne.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.OK)
    })

    test('should return 404 error if user is not found', async () => {
      await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const res = await request('/v1/users/1221212', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NOT_FOUND)
    })
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/users/1221212', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })

  describe('DELETE /v1/users/:userId', () => {
    test('should return 204 if data is ok', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const res = await request(`/v1/users/${userOne.id}`, {
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
        .where('user.id', '=', userOne.id)
        .executeTakeFirst()
      expect(dbUser).toBe(undefined)
    })

    test('should return 401 error if access token is missing', async () => {
      await insertUsers([userOne], config.database)
      const res = await request(`/v1/users/${userOne.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 error if user is trying to delete another user', async () => {
      await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const res = await request(`/v1/users/${userTwo.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })

    test('should return 204 if admin is trying to delete another user', async () => {
      await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const res = await request(`/v1/users/${userOne.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NO_CONTENT)
    })

    test('should return 404 error if user already is not found', async () => {
      await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const res = await request('/v1/users/12345', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.NOT_FOUND)
    })
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const res = await request('/v1/users/12345', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })

  describe('PATCH /v1/users/:userId', () => {
    test('should return 200 and successfully update user if data is ok', async () => {
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const updateBody = {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase()
      }

      const res = await request(`/v1/users/${userOne.id}`, {
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
        id: userOne.id,
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
      await insertUsers([userOne], config.database)
      const updateBody = { name: faker.person.fullName() }
      const res = await request(`/v1/users/${userOne.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(res.status).toBe(httpStatus.UNAUTHORIZED)
    })

    test('should return 403 if user is updating another user', async () => {
      await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const updateBody = { name: faker.person.fullName() }
      const res = await request(`/v1/users/${userTwo.id}`, {
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
      await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const updateBody = { name: faker.person.fullName() }
      const res = await request(`/v1/users/${userOne.id}`, {
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
      await insertUsers([admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const updateBody = { name: faker.person.fullName() }
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

    test('should return 400 if email is invalid', async () => {
      await insertUsers([userOne, admin], config.database)
      const adminAccessToken = await getAccessToken(admin.id, admin.role, config.jwt)
      const updateBody = { email: 'invalidEmail' }
      const res = await request(`/v1/users/${userOne.id}`, {
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
      await insertUsers([userOne, userTwo], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const updateBody = { email: userTwo.email }
      const res = await request(`/v1/users/${userOne.id}`, {
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
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const updateBody = { email: userOne.email }
      const res = await request(`/v1/users/${userOne.id}`, {
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
      await insertUsers([userOne], config.database)
      const userOneAccessToken = await getAccessToken(userOne.id, userOne.role, config.jwt)
      const updateBody = {}
      const res = await request(`/v1/users/${userOne.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userOneAccessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
    test('should return 403 if user has not verified their email', async () => {
      await insertUsers([userTwo], config.database)
      const accessToken = await getAccessToken(
        userTwo.id,
        userTwo.role,
        config.jwt,
        tokenTypes.ACCESS,
        userTwo.is_email_verified
      )
      const updateBody = {}
      const res = await request('/v1/users/1234', {
        method: 'PATCH',
        body: JSON.stringify(updateBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      })
      expect(res.status).toBe(httpStatus.FORBIDDEN)
    })
  })
})
