import { route as authRoute } from './auth.route'
import { route as userRoute } from './user.route'

const base_path = 'v1'

export const defaultRoutes = [
  {
    path: `/${base_path}/auth`,
    route: authRoute
  },
  {
    path: `/${base_path}/users`,
    route: userRoute
  }
]
