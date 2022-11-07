import { Hono } from 'hono'
import * as userController from '../controllers/user.controller'
import { auth } from '../middlewares/auth'

const route = new Hono<{ Bindings: Bindings }>()

route.post('/', auth('manageUsers'), userController.createUser)
route.get('/', auth('getUsers'), userController.getUsers)

route.get('/:userId', auth('getUsers'), userController.getUser)
route.patch('/:userId', auth('manageUsers'), userController.updateUser)
route.delete('/:userId', auth('manageUsers'), userController.deleteUser)

export { route }
