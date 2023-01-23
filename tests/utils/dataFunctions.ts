export const omit = <T extends object, K extends (keyof T)[]>(
  obj: T,
  keys: K
): Omit<T, K[number]> => {
  type ObjectType = Omit<T, K[number]>

  const newObj: ObjectType = {} as ObjectType

  Object.entries(obj).forEach(([key, value]) => {
    if (keys.includes(key as keyof T)) return
    newObj[key as keyof ObjectType] = value
  })

  return newObj
}

export const pick = <T extends object, K extends (keyof T)[]>(
  obj: T,
  keys: K
): Pick<T, K[number]> => {
  type ObjectType = Pick<T, K[number]>

  const newObj: ObjectType = {} as ObjectType

  Object.entries(obj).forEach(([key, value]) => {
    if (!keys.includes(key as keyof T)) return
    newObj[key as keyof ObjectType] = value
  })

  return newObj
}
