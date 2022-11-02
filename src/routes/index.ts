import app from '../app'
import { route as authRoute } from './auth.route'
import {route as userRoute } from './user.route'

const base_path = '/api/v1'

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute
  },
  {
    path: '/users',
    route: userRoute
  }
]

defaultRoutes.forEach((route) => {
  app.route(`${base_path}${route.path}`, route.route)
})
