import { Role } from '../config/roles'

class BaseModel {
  private_fields: Array<string> = []
  role: Role = 'user'

  constructor(role: Role = 'user') {
    this.role = role
  }
  static _convertArrayObjects(array: any) {
    return array.reduce((arr: any, obj: any) => {
      arr.push(new this(obj))
      return arr
    }, [])
  }

  static async convert(object: any) {
    if (Array.isArray(object)) {
      return this._convertArrayObjects(object)
    }
    return new this(object)
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
