import bcrypt from 'bcryptjs'
import { Selectable } from 'kysely'
import { Role } from '../config/roles'
import { UserTable } from '../tables/user.table'
import { BaseModel } from './base.model'

export class User extends BaseModel implements Selectable<UserTable> {
  id: string
  name: string | null
  email: string
  is_email_verified: boolean
  role: Role
  password: string | null

  private_fields = ['password', 'created_at', 'updated_at']

  constructor(user: Selectable<UserTable>) {
    super()
    this.role = user.role
    this.id = user.id
    this.name = user.name || null
    this.email = user.email
    this.is_email_verified = user.is_email_verified
    this.role = user.role
    this.password = user.password
  }

  isPasswordMatch = async (userPassword: string): Promise<boolean> => {
    if (!this.password) throw 'No password connected to user'
    return await bcrypt.compare(userPassword, this.password)
  }
}
