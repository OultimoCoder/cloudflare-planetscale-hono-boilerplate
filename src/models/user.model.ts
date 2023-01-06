import bcrypt from 'bcryptjs'
import { Generated, Selectable } from 'kysely'
import { Role } from '../config/roles'
import { BaseModel, ConvertReturn } from './base.model'

export interface UserTable {
  id: Generated<number>
  name: string
  email: string
  password: string | null  // null if user is created via OAuth
  is_email_verified: boolean
  role: Role
}

export class User extends BaseModel implements Selectable<UserTable> {
  id: number
  name: string
  email: string
  is_email_verified: boolean
  role: Role
  password: string | null

  private_fields = ['password']

  constructor(user: Selectable<UserTable>) {
    super()
    this.role = user.role
    this.id = user.id
    this.name = user.name
    this.email = user.email
    this.is_email_verified = user.is_email_verified
    this.role = user.role
    this.password = user.password
  }

  isPasswordMatch = async (userPassword: string) => {
    if (!this.password) Promise.reject('No password connected to user')
    return bcrypt.compare(userPassword, this.password || '')
  }
  static _convertArrayObjects(array: Selectable<UserTable>[]): User[] {
    return array.reduce((arr: User[], obj: Selectable<UserTable>) => {
      arr.push(this.convert(obj))
      return arr
    }, [])
  }


  static convert<T extends Selectable<UserTable> | Selectable<UserTable>[]>(
    user: T
  ): ConvertReturn<T, User> {
    type ReturnT = ConvertReturn<T, User>;
    if (Array.isArray(user)) {
      return this._convertArrayObjects(user) as ReturnT
    }
    return new this(user) as ReturnT
  }

  canAccessPrivateFields(): boolean {
    return this.role === 'admin'
  }
}
