const roleRights = {
  user: [],
  admin: ['getUsers', 'manageUsers']
} as const

const roles = Object.keys(roleRights) as Role[]

type Permission = typeof roleRights[keyof typeof roleRights][number]
type Role = keyof typeof roleRights

export {
  roles,
  roleRights,
  Permission,
  Role
}
