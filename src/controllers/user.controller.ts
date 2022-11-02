import httpStatus from 'http-status';
import { ApiError } from '../utils/ApiError';
import * as userService from '../services/user.service';
import * as userValidation from '../validations/user.validation';
import { Context } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';

const createUser = async (c: Context) => {
  const { body } = userValidation.createUser.parse(c.req.parseBody());
  const user = await userService.createUser(body);
  return c.json(user, httpStatus.CREATED as StatusCode);
};

const getUsers = async (c: Context) => {
  const { query } = userValidation.getUsers.parse(c.req.parseBody());

  const filter = { name: query.name, role: query.role };
  const options = { sortBy: query.sortBy, limit: query.limit, page: query.page };

  const result = await userService.queryUsers();
  return c.json(result, httpStatus.OK as StatusCode);
};

const getUser = async (c: Context) => {
  const { params } = userValidation.getUser.parse(c.req.parseBody());
  const user = await userService.getUserById(params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return c.json(user, httpStatus.OK as StatusCode);
};

const updateUser = async (c: Context) => {
  const { params, body } = userValidation.updateUser.parse(c.req.parseBody());
  const user = await userService.updateUserById(params.userId, body);
  return c.json(user, httpStatus.OK as StatusCode);
};

const deleteUser = async (c: Context) => {
  const { params } = userValidation.deleteUser.parse(c.req.parseBody());
  await userService.deleteUserById(params.userId);
  c.status(httpStatus.NO_CONTENT as StatusCode);
  return c.body(null)
};

export {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser
}
