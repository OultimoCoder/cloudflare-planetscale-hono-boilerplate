import { request } from '../utils/testRequest';
import { clearDBTables } from '../utils/clearDBTables';
import { faker } from '@faker-js/faker';
import httpStatus from 'http-status';
import { MockUser, UserResponse } from '../fixtures/user.fixture';
import { TokenResponse } from '../fixtures/token.fixture';
import { Database, getDBClient } from '../../src/config/database'
import { TableReference } from 'kysely/dist/cjs/parser/table-parser';

getMiniflareBindings()

clearDBTables(['user' as TableReference<Database>]);
const client = getDBClient()

describe('Auth routes', () => {
  describe('POST /v1/auth/register', () => {
    let newUser: MockUser;
    beforeEach(() => {
      newUser = {
        first_name: faker.name.firstName(),
        last_name: faker.name.firstName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1'
      };
    });

    test('should return 201 and successfully register user if request data is ok', async () => {
      const res = await request('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: new Headers({
          'Content-Type': 'application/json',
        })
      })
      expect(res.status).toBe(httpStatus.CREATED)
      const body = await res.json<{user: UserResponse, tokens: TokenResponse}>()
      expect(body.user).not.toHaveProperty('password');
      expect(body.user).toEqual({
        id: expect.anything(),
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        role: 'user',
        isEmailVerified: false
      });

      const dbUser = await client
        .selectFrom('user')
        .selectAll()
        .where('user.id', '=', body.user.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined();
      if (!dbUser) return;

      expect(dbUser.password).not.toBe(newUser.password);
      expect(dbUser).toMatchObject({
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        password: expect.anything(),
        email: newUser.email,
        role: 'user',
        isEmailVerified: false
      });

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    // test('should return 400 error if email is invalid', async () => {
    //   newUser.email = 'invalidEmail';

    //   await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    // });

    // test('should return 400 error if email is already used', async () => {
    //   await insertUsers([userOne]);
    //   newUser.email = userOne.email;

    //   await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    // });

    // test('should return 400 error if password length is less than 8 characters', async () => {
    //   newUser.password = 'passwo1';

    //   await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    // });

    // test('should return 400 error if password does not contain both letters and numbers', async () => {
    //   newUser.password = 'password';

    //   await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);

    //   newUser.password = '11111111';

    //   await request(app).post('/v1/auth/register').send(newUser).expect(httpStatus.BAD_REQUEST);
    // });
  });

  // describe('POST /v1/auth/login', () => {
  //   test('should return 200 and login user if email and password match', async () => {
  //     await insertUsers([userOne]);
  //     const loginCredentials = {
  //       email: userOne.email,
  //       password: userOne.password,
  //     };

  //     const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.OK);

  //     expect(res.body.user).toEqual({
  //       id: expect.anything(),
  //       name: userOne.name,
  //       email: userOne.email,
  //       role: userOne.role,
  //       isEmailVerified: userOne.isEmailVerified,
  //     });

  //     expect(res.body.tokens).toEqual({
  //       access: { token: expect.anything(), expires: expect.anything() },
  //       refresh: { token: expect.anything(), expires: expect.anything() },
  //     });
  //   });

  //   test('should return 401 error if there are no users with that email', async () => {
  //     const loginCredentials = {
  //       email: userOne.email,
  //       password: userOne.password,
  //     };

  //     const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

  //     expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
  //   });

  //   test('should return 401 error if password is wrong', async () => {
  //     await insertUsers([userOne]);
  //     const loginCredentials = {
  //       email: userOne.email,
  //       password: 'wrongPassword1',
  //     };

  //     const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

  //     expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
  //   });
  // });

  // describe('POST /v1/auth/refresh-tokens', () => {
  //   test('should return 200 and new auth tokens if refresh token is valid', async () => {
  //     await insertUsers([userOne]);
  //     const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
  //     const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
  //     await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

  //     const res = await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.OK);

  //     expect(res.body).toEqual({
  //       access: { token: expect.anything(), expires: expect.anything() },
  //       refresh: { token: expect.anything(), expires: expect.anything() },
  //     });

  //     const dbRefreshTokenDoc = await Token.findOne({ token: res.body.refresh.token });
  //     expect(dbRefreshTokenDoc).toMatchObject({ type: tokenTypes.REFRESH, user: userOne._id, blacklisted: false });

  //     const dbRefreshTokenCount = await Token.countDocuments();
  //     expect(dbRefreshTokenCount).toBe(1);
  //   });

  //   test('should return 400 error if refresh token is missing from request body', async () => {
  //     await request(app).post('/v1/auth/refresh-tokens').send().expect(httpStatus.BAD_REQUEST);
  //   });

  //   test('should return 401 error if refresh token is signed using an invalid secret', async () => {
  //     await insertUsers([userOne]);
  //     const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
  //     const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH, 'invalidSecret');
  //     await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

  //     await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
  //   });

  //   test('should return 401 error if refresh token is not found in the database', async () => {
  //     await insertUsers([userOne]);
  //     const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
  //     const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);

  //     await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
  //   });

  //   test('should return 401 error if refresh token is blacklisted', async () => {
  //     await insertUsers([userOne]);
  //     const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
  //     const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
  //     await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH, true);

  //     await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
  //   });

  //   test('should return 401 error if refresh token is expired', async () => {
  //     await insertUsers([userOne]);
  //     const expires = moment().subtract(1, 'minutes');
  //     const refreshToken = tokenService.generateToken(userOne._id, expires);
  //     await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

  //     await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
  //   });

  //   test('should return 401 error if user is not found', async () => {
  //     const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
  //     const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
  //     await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

  //     await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
  //   });
  // });
});
