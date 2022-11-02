import { Generated } from 'kysely'

interface User {
  id: Generated<number>
  first_name: string
  last_name: string
  email: string
  password: string
  is_email_verified: boolean
  role: 'admin' | 'user'
}

export { User }
