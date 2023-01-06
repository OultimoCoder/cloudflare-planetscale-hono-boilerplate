export type ConvertReturn<T, V> = T extends unknown[] ? V[] : V

export abstract class BaseModel {
  private_fields: string[]
  constructor() {
    this.private_fields = []
  }

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