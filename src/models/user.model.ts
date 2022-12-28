import bcrypt from 'bcryptjs'
import { Generated, Selectable } from 'kysely'
import { Role } from '../config/roles'
import { BaseModel } from './base.model'

interface UserTable {
  id: Generated<number>
  name: string
  email: string
  password: string | null  // null if user is created via OAuth
  is_email_verified: boolean
  role: Role
}

class User extends BaseModel implements Selectable<UserTable> {
  id: number
  name: string
  email: string
  is_email_verified: boolean
  role: Role
  password: string | null

  private_fields = ['password']

  constructor(user: Selectable<UserTable>, role: Role = 'user') {
    super(role)
    this.id = user.id
    this.name = user.name
    this.email = user.email
    this.is_email_verified = user.is_email_verified
    this.role = user.role
    this.password = user.password
  }

  isPasswordMatch = async (userPassword: string) => {
    return bcrypt.compare(userPassword, this.password)
  }
}

export { UserTable, User }
