import { Hono } from 'hono'
import { Environment } from '../../bindings'
import * as userController from '../controllers/user.controller'
import { auth } from '../middlewares/auth'

export const route = new Hono<Environment>()

route.post('/', auth('manageUsers'), userController.createUser)
route.get('/', auth('getUsers'), userController.getUsers)

route.get('/:userId', auth('getUsers'), userController.getUser)
route.patch('/:userId', auth('manageUsers'), userController.updateUser)
route.delete('/:userId', auth('manageUsers'), userController.deleteUser)
