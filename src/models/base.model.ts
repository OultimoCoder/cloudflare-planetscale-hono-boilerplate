export abstract class BaseModel {
  abstract private_fields: string[]
  abstract canAccessPrivateFields(): boolean

  toJSON() {
    const properties = Object.getOwnPropertyNames(this)
    const publicProperties = properties.filter((property) => {
      return (
        (!this.private_fields.includes(property) || this.canAccessPrivateFields()) &&
        property !== 'private_fields'
      )
    })
    const json = publicProperties.reduce((obj: Record<string, unknown>, key: string) => {
      obj[key] = this[key as keyof typeof this]
      return obj
    }, {})
    return json
  }
}
