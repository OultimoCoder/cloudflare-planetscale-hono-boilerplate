const functionPick = (func, keys) => {
  const obj = {}
  return keys.reduce((obj, key) => {
    if (func && func(key)) {
      // eslint-disable-next-line no-param-reassign
      obj[key] = func(key)
    }
    return obj
  }, {})
}

const objectPick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      // eslint-disable-next-line no-param-reassign
      obj[key] = object[key]
    }
    return obj
  }, {})
}

const pick = (funcOrObject, keys) => {
  if (typeof(funcOrObject) === 'function') {
    return functionPick(funcOrObject, keys)
  }
  return objectPick(funcOrObject, keys)
}



export default pick
