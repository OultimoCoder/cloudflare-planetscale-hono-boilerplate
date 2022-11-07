import httpStatus from 'http-status';
import { ApiError } from '../utils/ApiError';
import * as userService from '../services/user.service';
import * as userValidation from '../validations/user.validation';
import { Handler } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { getConfig } from '../config/config';

const createUser: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const { body } = userValidation.createUser.parse(c.req.parseBody());
  const user = await userService.createUser(body, config.database);
  return c.json(user, httpStatus.CREATED as StatusCode);
};

const getUsers: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const { query } = userValidation.getUsers.parse(c.req.parseBody());

  const filter = { name: query.name, role: query.role };
  const options = { sortBy: query.sortBy, limit: query.limit, page: query.page };

  const result = await userService.queryUsers(config.database);
  return c.json(result, httpStatus.OK as StatusCode);
};

const getUser: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const { params } = userValidation.getUser.parse(c.req.parseBody());
  const user = await userService.getUserById(params.userId, config.database);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return c.json(user, httpStatus.OK as StatusCode);
};

const updateUser: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const { params, body } = userValidation.updateUser.parse(c.req.parseBody());
  const user = await userService.updateUserById(params.userId, body, config.database);
  return c.json(user, httpStatus.OK as StatusCode);
};

const deleteUser: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const { params } = userValidation.deleteUser.parse(c.req.parseBody());
  await userService.deleteUserById(params.userId, config.database);
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
