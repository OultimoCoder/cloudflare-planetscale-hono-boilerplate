import { Role } from '../config/roles'

abstract class BaseModel {
  private_fields: Array<string> = []
  role: Role = 'user'

  constructor(role: Role = 'user') {
    this.role = role
  }

  toJSON() {
    const properties = Object.getOwnPropertyNames(this);
    const publicProperties = properties.filter(property => {
      return (
        (!this.private_fields.includes(property) || this.role === 'admin') &&
        property !== 'private_fields'
      )
    })
    const json = publicProperties.reduce((obj: any, key: any) => {
      obj[key] = this[key as keyof BaseModel]
      return obj
    }, {})
    return json
  }
}

export {
  BaseModel
}
