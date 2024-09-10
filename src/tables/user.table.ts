import { Role } from '../config/roles'

export interface UserTable {
  id: string
  name: string | null // null if not available on oauth account linking
  email: string
  password: string | null // null if user is created via OAuth
  is_email_verified: boolean
  role: Role
}
